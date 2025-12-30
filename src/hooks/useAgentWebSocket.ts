'use client'

import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import type {
  QueueItem,
  ToolQueueItem,
  AgentState,
  ConnectionStatus,
  ToolHandler,
  ToolContext,
  ServerEvent,
  ClientToolResultMessage,
  PongMessage,
} from '@/types/elevenlabs-websocket'
import { getAudioPlayer } from '@/lib/AudioPlayer'

const WEBSOCKET_URL = 'wss://api.elevenlabs.io/v1/convai/conversation'

interface UseAgentWebSocketConfig {
  agentId: string
  toolHandlers: Record<string, ToolHandler>
  onUserTranscript?: (transcript: string) => void
  onAgentResponse?: (response: string) => void
  onError?: (error: Error) => void
}

export function useAgentWebSocket({
  agentId,
  toolHandlers,
  onUserTranscript,
  onAgentResponse,
  onError,
}: UseAgentWebSocketConfig) {
  // Connection state
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [agentState, setAgentState] = useState<AgentState>(null)

  // Refs for persistent state across renders
  const wsRef = useRef<WebSocket | null>(null)
  const queueRef = useRef<QueueItem[]>([])
  const isProcessingRef = useRef(false)

  // Separate tool queue for immediate execution (avoids timeout)
  const toolQueueRef = useRef<ToolQueueItem[]>([])
  const isProcessingToolsRef = useRef(false)

  // Queue empty promise resolver (for waitForQueueEmpty)
  const queueEmptyResolversRef = useRef<Array<() => void>>([])
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioWorkletRef = useRef<AudioWorkletNode | null>(null)
  const micAudioContextRef = useRef<AudioContext | null>(null)
  const inputVolumeRef = useRef(0)
  const toolHandlersRef = useRef(toolHandlers)
  const triggerAudioRef = useRef<((url: string) => Promise<void>) | null>(null)

  // Keep toolHandlers ref updated
  useEffect(() => {
    toolHandlersRef.current = toolHandlers
  }, [toolHandlers])

  // Get audio player singleton
  const audioPlayer = getAudioPlayer()

  /**
   * Send a message through WebSocket
   */
  const sendMessage = useCallback((message: ClientToolResultMessage | PongMessage | object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  /**
   * Process the audio/action queue sequentially
   */
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || queueRef.current.length === 0) {
      return
    }

    isProcessingRef.current = true

    while (queueRef.current.length > 0) {
      const item = queueRef.current.shift()!

      if (item.type === 'audio') {
        // Set agent state to speaking
        setAgentState('speaking')

        try {
          // Play audio and wait for completion
          await audioPlayer.playChunk(item.audioBase64)
          console.log(`[Queue] Played audio chunk ${item.eventId}`)
        } catch (error) {
          console.error('Error playing audio:', error)
        }
      } else if (item.type === 'action') {
        // Execute deferred action (e.g., play piano notes after audio)
        console.log(`[Queue] Executing action: ${item.description}`)
        try {
          await item.callback()
          console.log(`[Queue] Action completed: ${item.description}`)
        } catch (error) {
          console.error(`Error executing action ${item.description}:`, error)
        }
      }
    }

    // Queue empty - back to idle/listening state
    if (status === 'connected') {
      setAgentState('listening')
    }

    isProcessingRef.current = false

    // Resolve any waitForQueueEmpty promises
    if (queueEmptyResolversRef.current.length > 0) {
      const resolvers = queueEmptyResolversRef.current
      queueEmptyResolversRef.current = []
      resolvers.forEach(resolve => resolve())
    }
  }, [audioPlayer, status])

  /**
   * Queue an action to be executed after current audio finishes
   * This allows tool handlers to defer side-effects while responding immediately
   */
  const queueAction = useCallback((callback: () => Promise<void>, description: string) => {
    queueRef.current.push({ type: 'action', callback, description })
    processQueue()
  }, [processQueue])

  /**
   * Wait for the audio/action queue to be empty
   * Useful for tools that need to wait for demos to finish before starting their work
   */
  const waitForQueueEmpty = useCallback((): Promise<void> => {
    // If queue is already empty and not processing, resolve immediately
    if (queueRef.current.length === 0 && !isProcessingRef.current) {
      return Promise.resolve()
    }

    // Otherwise, add resolver to be called when queue empties
    return new Promise<void>((resolve) => {
      queueEmptyResolversRef.current.push(resolve)
    })
  }, [])

  /**
   * Process tool calls immediately (not queued behind audio)
   * Handlers can use queueAction to defer side-effects
   */
  const processToolQueue = useCallback(async () => {
    if (isProcessingToolsRef.current || toolQueueRef.current.length === 0) {
      return
    }

    isProcessingToolsRef.current = true

    while (toolQueueRef.current.length > 0) {
      const item = toolQueueRef.current.shift()!

      console.log(`[ToolQueue] Executing tool: ${item.toolName}`, item.parameters)

      try {
        const handler = toolHandlersRef.current[item.toolName]
        let result: string

        if (handler) {
          // Pass context so handlers can defer side-effects or wait for queue
          const triggerAudioFn = triggerAudioRef.current || (async () => {})
          const context: ToolContext = { queueAction, waitForQueueEmpty, triggerAudio: triggerAudioFn }
          const handlerResult = await handler(item.parameters, context)
          result = typeof handlerResult === 'string' ? handlerResult : JSON.stringify(handlerResult)
        } else {
          console.warn(`No handler for tool: ${item.toolName}`)
          result = JSON.stringify({ error: 'UNKNOWN_TOOL', message: `No handler for ${item.toolName}` })
        }

        // Send result back to server immediately
        sendMessage({
          type: 'client_tool_result',
          tool_call_id: item.toolCallId,
          result,
          is_error: false,
        })

        console.log(`[ToolQueue] Tool ${item.toolName} completed`)
      } catch (error) {
        console.error(`Error executing tool ${item.toolName}:`, error)

        // Send error result
        sendMessage({
          type: 'client_tool_result',
          tool_call_id: item.toolCallId,
          result: JSON.stringify({
            error: 'EXECUTION_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
          }),
          is_error: true,
        })
      }
    }

    isProcessingToolsRef.current = false
  }, [sendMessage, queueAction])

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as ServerEvent

        switch (data.type) {
          case 'audio':
            // Queue audio for sequential playback
            queueRef.current.push({
              type: 'audio',
              audioBase64: data.audio_event.audio_base_64,
              eventId: data.audio_event.event_id,
            })
            processQueue()
            break

          case 'client_tool_call':
            // Route to tool queue for immediate execution (avoids timeout)
            console.log('[WS] Received tool call:', data.client_tool_call.tool_name)
            toolQueueRef.current.push({
              toolName: data.client_tool_call.tool_name,
              toolCallId: data.client_tool_call.tool_call_id,
              parameters: data.client_tool_call.parameters,
            })
            processToolQueue()
            break

          case 'agent_response':
            onAgentResponse?.(data.agent_response_event.agent_response)
            break

          case 'user_transcript':
            onUserTranscript?.(data.user_transcription_event.user_transcript)
            break

          case 'interruption':
            // User interrupted - clear queue and stop playback
            console.log('[WS] Interruption at event:', data.interruption_event.event_id)
            queueRef.current = []
            audioPlayer.stop()
            setAgentState('listening')
            break

          case 'ping':
            // Respond with pong
            sendMessage({
              type: 'pong',
              event_id: data.ping_event.event_id,
            })
            break

          case 'conversation_initiation_metadata':
            console.log('[WS] Conversation initialized:', data.conversation_initiation_metadata_event.conversation_id)
            break
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    },
    [processQueue, processToolQueue, audioPlayer, sendMessage, onAgentResponse, onUserTranscript]
  )

  /**
   * Setup microphone input and stream to WebSocket
   */
  const setupMicrophone = useCallback(async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      mediaStreamRef.current = stream

      // Create audio context for processing
      const audioContext = new AudioContext({ sampleRate: 16000 })
      micAudioContextRef.current = audioContext

      // Create source from microphone
      const source = audioContext.createMediaStreamSource(stream)

      // Create analyser for input volume
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)

      // Create script processor for PCM data
      // Note: ScriptProcessorNode is deprecated but widely supported
      // AudioWorklet would be better but more complex to set up
      const processor = audioContext.createScriptProcessor(4096, 1, 1)

      const volumeData = new Uint8Array(analyser.frequencyBinCount)

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return

        // Get PCM data
        const inputData = e.inputBuffer.getChannelData(0)

        // Convert Float32 to Int16
        const int16Data = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]))
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff
        }

        // Convert to base64
        const base64 = btoa(
          String.fromCharCode(...new Uint8Array(int16Data.buffer))
        )

        // Send to WebSocket
        wsRef.current.send(
          JSON.stringify({
            user_audio_chunk: base64,
          })
        )

        // Update input volume
        analyser.getByteFrequencyData(volumeData)
        let sum = 0
        for (let i = 0; i < volumeData.length; i++) {
          sum += volumeData[i] * volumeData[i]
        }
        inputVolumeRef.current = Math.min(1, Math.sqrt(sum / volumeData.length) / 128)
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      console.log('[Mic] Microphone setup complete')
    } catch (error) {
      console.error('Error setting up microphone:', error)
      onError?.(error instanceof Error ? error : new Error('Microphone setup failed'))
    }
  }, [onError])

  /**
   * Cleanup microphone resources
   */
  const cleanupMicrophone = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    if (micAudioContextRef.current) {
      micAudioContextRef.current.close()
      micAudioContextRef.current = null
    }
    if (audioWorkletRef.current) {
      audioWorkletRef.current.disconnect()
      audioWorkletRef.current = null
    }
    inputVolumeRef.current = 0
  }, [])

  /**
   * Connect to the agent
   */
  const connect = useCallback(async () => {
    if (status !== 'disconnected') {
      console.warn('Already connected or connecting')
      return
    }

    setStatus('connecting')

    try {
      // Initialize audio player first (needs user gesture)
      await audioPlayer.initialize()

      // Build WebSocket URL with signed URL
      // For now, connect directly with agent ID (may need signed URL from backend)
      const wsUrl = `${WEBSOCKET_URL}?agent_id=${agentId}`

      console.log('[WS] Connecting to:', wsUrl)

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[WS] Connected')
        setStatus('connected')
        setAgentState('listening')

        // Setup microphone after connection
        setupMicrophone()
      }

      ws.onmessage = handleMessage

      ws.onerror = (error) => {
        console.error('[WS] Error:', error)
        onError?.(new Error('WebSocket error'))
      }

      ws.onclose = (event) => {
        console.log('[WS] Closed:', event.code, event.reason)
        setStatus('disconnected')
        setAgentState(null)
        cleanupMicrophone()
        queueRef.current = []
        toolQueueRef.current = []
        isProcessingRef.current = false
        isProcessingToolsRef.current = false
      }
    } catch (error) {
      console.error('Connection error:', error)
      setStatus('disconnected')
      onError?.(error instanceof Error ? error : new Error('Connection failed'))
    }
  }, [status, agentId, audioPlayer, handleMessage, setupMicrophone, cleanupMicrophone, onError])

  /**
   * Disconnect from the agent
   */
  const disconnect = useCallback(() => {
    if (status === 'disconnected') return

    setStatus('disconnecting')

    // Clear queues and stop playback
    queueRef.current = []
    toolQueueRef.current = []
    audioPlayer.stop()

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    // Cleanup microphone
    cleanupMicrophone()

    setStatus('disconnected')
    setAgentState(null)
  }, [status, audioPlayer, cleanupMicrophone])

  /**
   * Get input volume (0-1)
   */
  const getInputVolume = useCallback(() => {
    return inputVolumeRef.current
  }, [])

  /**
   * Get output volume (0-1)
   */
  const getOutputVolume = useCallback(() => {
    return audioPlayer.getOutputVolume()
  }, [audioPlayer])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
      audioPlayer.dispose()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Inject audio into the stream
   */
  const triggerAudio = useCallback(async (url: string) => {
    if (status !== 'connected' || !wsRef.current) return

    try {
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()

      // Always use a new context for decoding to avoid state issues
      const ctx = new AudioContext({ sampleRate: 16000 })
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)

      // Get channel data (mono)
      const channelData = audioBuffer.getChannelData(0)

      // Convert to Int16
      const int16Data = new Int16Array(channelData.length)
      for (let i = 0; i < channelData.length; i++) {
        const s = Math.max(-1, Math.min(1, channelData[i]))
        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff
      }

      // Send in chunks to avoid message size limits
      const CHUNK_SIZE = 4096 // 4KB chunks
      for (let i = 0; i < int16Data.length; i += CHUNK_SIZE) {
        const chunk = int16Data.slice(i, i + CHUNK_SIZE)
        const base64 = btoa(
          String.fromCharCode(...new Uint8Array(chunk.buffer))
        )

        wsRef.current.send(JSON.stringify({
          user_audio_chunk: base64
        }))

        // Small delay to prevent flooding
        await new Promise(r => setTimeout(r, 10))
      }

      await ctx.close()
      console.log('[Audio] Injected trigger:', url)
    } catch (err) {
      console.error('Failed to inject audio:', err)
    }
  }, [status])

  /**
   * Inject raw PCM audio data into the stream
   * Used by NoteInjector to send speech clips
   */
  const injectPCM = useCallback(async (pcmData: Int16Array) => {
    if (status !== 'connected' || !wsRef.current) return

    try {
      // Send in chunks to avoid message size limits
      const CHUNK_SIZE = 4096 // 4KB chunks
      for (let i = 0; i < pcmData.length; i += CHUNK_SIZE) {
        const chunk = pcmData.slice(i, i + CHUNK_SIZE)
        const base64 = btoa(
          String.fromCharCode(...new Uint8Array(chunk.buffer))
        )

        wsRef.current.send(JSON.stringify({
          user_audio_chunk: base64
        }))

        // Small delay to prevent flooding
        if (i + CHUNK_SIZE < pcmData.length) {
          await new Promise(r => setTimeout(r, 5))
        }
      }

      console.log('[Audio] Injected PCM:', pcmData.length, 'samples')
    } catch (err) {
      console.error('Failed to inject PCM:', err)
    }
  }, [status])

  // Keep triggerAudio ref updated for use in tool context
  useEffect(() => {
    triggerAudioRef.current = triggerAudio
  }, [triggerAudio])

  // Memoize return object to avoid infinite loops in consumers
  return useMemo(() => ({
    connect,
    disconnect,
    status,
    agentState,
    getInputVolume,
    getOutputVolume,
    triggerAudio,
    injectPCM,
  }), [
    connect,
    disconnect,
    status,
    agentState,
    getInputVolume,
    getOutputVolume,
    triggerAudio,
    injectPCM,
  ])
}

export default useAgentWebSocket
