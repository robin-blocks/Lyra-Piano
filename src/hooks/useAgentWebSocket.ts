'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import type {
  QueueItem,
  AgentState,
  ConnectionStatus,
  ToolHandler,
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
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioWorkletRef = useRef<AudioWorkletNode | null>(null)
  const micAudioContextRef = useRef<AudioContext | null>(null)
  const inputVolumeRef = useRef(0)
  const toolHandlersRef = useRef(toolHandlers)

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
   * Process the event queue sequentially
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
      } else if (item.type === 'tool_call') {
        console.log(`[Queue] Executing tool: ${item.toolName}`, item.parameters)

        try {
          // Execute the tool handler
          const handler = toolHandlersRef.current[item.toolName]
          let result: string

          if (handler) {
            const handlerResult = await handler(item.parameters)
            result = typeof handlerResult === 'string' ? handlerResult : JSON.stringify(handlerResult)
          } else {
            console.warn(`No handler for tool: ${item.toolName}`)
            result = JSON.stringify({ error: 'UNKNOWN_TOOL', message: `No handler for ${item.toolName}` })
          }

          // Send result back to server
          sendMessage({
            type: 'client_tool_result',
            tool_call_id: item.toolCallId,
            result,
            is_error: false,
          })

          console.log(`[Queue] Tool ${item.toolName} completed`)
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
    }

    // Queue empty - back to idle/listening state
    if (status === 'connected') {
      setAgentState('listening')
    }

    isProcessingRef.current = false
  }, [audioPlayer, sendMessage, status])

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
            // Queue tool call for sequential execution
            console.log('[WS] Received tool call:', data.client_tool_call.tool_name)
            queueRef.current.push({
              type: 'tool_call',
              toolName: data.client_tool_call.tool_name,
              toolCallId: data.client_tool_call.tool_call_id,
              parameters: data.client_tool_call.parameters,
            })
            processQueue()
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
    [processQueue, audioPlayer, sendMessage, onAgentResponse, onUserTranscript]
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
        isProcessingRef.current = false
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

    // Clear queue and stop playback
    queueRef.current = []
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

  return {
    connect,
    disconnect,
    status,
    agentState,
    getInputVolume,
    getOutputVolume,
  }
}

export default useAgentWebSocket
