'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useConversation } from '@elevenlabs/react'
import { LyraOrb } from '@/components/LyraOrb'
import { PianoKeyboard } from '@/components/Piano'
import { usePiano } from '@/hooks/usePiano'
import { useMidiCapture } from '@/hooks/useMidiCapture'
import { getPianoAudio } from '@/lib/PianoAudio'
import { DemoPlayer } from '@/lib/DemoPlayer'
import { getPatternById, searchPatterns, PATTERNS } from '@/lib/patterns'
import { evaluate } from '@/lib/MidiEvaluator'

// Environment variable for agent ID - will be set in .env.local
const AGENT_ID = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID

type AgentState = 'idle' | 'listening' | 'talking' | null
type ListeningState = 'not_listening' | 'listening_for_piano' | 'processing'

export function Lyra() {
  const [agentState, setAgentState] = useState<AgentState>(null)
  const [message, setMessage] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [listeningForPiano, setListeningForPiano] = useState<ListeningState>('not_listening')

  // Piano state and audio
  const {
    pressedKeys,
    highlightedKeys,
    playNote,
    stopNote,
    highlightKeys,
    clearHighlights,
    isInitialized: pianoInitialized,
  } = usePiano()

  // MIDI capture for recording user playing
  const midiCapture = useMidiCapture()

  // Demo player reference
  const demoPlayerRef = useRef<DemoPlayer | null>(null)

  // Initialize demo player when piano is ready
  useEffect(() => {
    if (pianoInitialized && !demoPlayerRef.current) {
      const pianoAudio = getPianoAudio()
      demoPlayerRef.current = new DemoPlayer(pianoAudio, {
        onKeyHighlight: (note) => highlightKeys([note]),
        onKeyUnhighlight: () => clearHighlights(),
      })
    }
  }, [pianoInitialized, highlightKeys, clearHighlights])

  // Client tools for the ElevenLabs agent
  const clientTools = {
    // Start listening for user piano input
    startListeningToUser: async () => {
      console.log('Agent: Starting to listen for user piano input')
      midiCapture.startCapture()
      setListeningForPiano('listening_for_piano')
      return 'Now listening for piano input. Tell me when you\'re done playing.'
    },

    // Stop listening and evaluate the user's playing
    evaluateUserPlaying: async (params: { patternId: string }) => {
      console.log('Agent: Evaluating user playing for pattern:', params.patternId)
      setListeningForPiano('processing')

      const phrase = midiCapture.endCapture()
      if (!phrase || phrase.notes.length === 0) {
        setListeningForPiano('not_listening')
        return JSON.stringify({
          error: 'No notes were captured',
          feedback: 'I didn\'t hear any notes. Try playing something on the piano.',
        })
      }

      const pattern = getPatternById(params.patternId)
      if (!pattern) {
        setListeningForPiano('not_listening')
        return JSON.stringify({
          error: 'Pattern not found',
          feedback: 'I couldn\'t find that pattern. Let\'s try something else.',
        })
      }

      const result = evaluate(phrase, pattern)
      setListeningForPiano('not_listening')

      return JSON.stringify(result)
    },

    // Demonstrate a pattern on the piano
    demonstratePattern: async (params: { patternId: string }) => {
      console.log('Agent: Demonstrating pattern:', params.patternId)

      const pattern = getPatternById(params.patternId)
      if (!pattern) {
        return 'Pattern not found'
      }

      if (!demoPlayerRef.current) {
        // Initialize on demand
        const pianoAudio = getPianoAudio()
        await pianoAudio.initialize()
        demoPlayerRef.current = new DemoPlayer(pianoAudio, {
          onKeyHighlight: (note) => highlightKeys([note]),
          onKeyUnhighlight: () => clearHighlights(),
        })
      }

      await demoPlayerRef.current.play(pattern)
      return `Demonstrated ${pattern.name}`
    },

    // Highlight specific keys on the piano
    highlightKeys: async (params: { midiNotes: number[] }) => {
      console.log('Agent: Highlighting keys:', params.midiNotes)
      highlightKeys(params.midiNotes)
      return 'Keys highlighted'
    },

    // Clear key highlights
    clearHighlights: async () => {
      console.log('Agent: Clearing highlights')
      clearHighlights()
      return 'Highlights cleared'
    },

    // Get available patterns
    getAvailablePatterns: async (params: { type?: string; difficulty?: number; search?: string }) => {
      console.log('Agent: Getting available patterns', params)

      let patterns = Object.values(PATTERNS)

      if (params.type) {
        patterns = patterns.filter(p => p.type === params.type)
      }

      if (params.difficulty !== undefined) {
        const maxDifficulty = params.difficulty
        patterns = patterns.filter(p => p.difficulty <= maxDifficulty)
      }

      if (params.search) {
        patterns = searchPatterns(params.search)
      }

      // Return simplified list
      const result = patterns.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type,
        difficulty: p.difficulty,
        description: p.description,
      }))

      return JSON.stringify(result)
    },

    // Get pattern details
    getPatternDetails: async (params: { patternId: string }) => {
      const pattern = getPatternById(params.patternId)
      if (!pattern) {
        return JSON.stringify({ error: 'Pattern not found' })
      }
      return JSON.stringify({
        id: pattern.id,
        name: pattern.name,
        type: pattern.type,
        difficulty: pattern.difficulty,
        description: pattern.description,
        noteCount: pattern.notes.length,
      })
    },
  }

  const conversation = useConversation({
    clientTools,
    onConnect: () => {
      console.log('Connected to Lyra')
      setMessage("Hello! I'm ready to play.")
      setAgentState('idle')
    },
    onDisconnect: () => {
      console.log('Disconnected from Lyra')
      setAgentState(null)
      setMessage('')
      setListeningForPiano('not_listening')
      midiCapture.clearCapture()
    },
    onMessage: (messagePayload) => {
      console.log('Message received:', messagePayload)
      // Messages contain transcript data - could be used for display
    },
    onModeChange: (mode) => {
      console.log('Mode changed:', mode)
      if (mode.mode === 'speaking') {
        setAgentState('talking')
      } else if (mode.mode === 'listening') {
        setAgentState('listening')
      } else {
        setAgentState('idle')
      }
    },
    onError: (error) => {
      console.error('Conversation error:', error)
      setError('Connection error. Please try again.')
    },
  })

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const handleConnect = useCallback(async () => {
    if (!AGENT_ID) {
      setError('Agent ID not configured. Please set NEXT_PUBLIC_ELEVENLABS_AGENT_ID in .env.local')
      return
    }

    try {
      setMessage('Connecting...')
      await conversation.startSession({
        agentId: AGENT_ID,
        connectionType: 'websocket',
      })
    } catch (err) {
      console.error('Failed to connect:', err)
      setError('Failed to connect. Please check your configuration.')
    }
  }, [conversation])

  const handleDisconnect = useCallback(async () => {
    try {
      await conversation.endSession()
    } catch (err) {
      console.error('Failed to disconnect:', err)
    }
  }, [conversation])

  // Get volume levels for Orb audio reactivity
  const getInputVolume = useCallback(() => {
    return conversation.getInputVolume?.() ?? 0
  }, [conversation])

  const getOutputVolume = useCallback(() => {
    return conversation.getOutputVolume?.() ?? 0
  }, [conversation])

  // Enhanced note handlers that also capture for evaluation
  const handleNoteOn = useCallback((midiNote: number, velocity: number = 80) => {
    playNote(midiNote, velocity)

    // Record to MIDI capture if we're listening
    if (midiCapture.isCapturing) {
      midiCapture.recordNoteEvent('noteOn', midiNote, velocity)
    }
  }, [playNote, midiCapture])

  const handleNoteOff = useCallback((midiNote: number) => {
    stopNote(midiNote)

    // Record to MIDI capture if we're listening
    if (midiCapture.isCapturing) {
      midiCapture.recordNoteEvent('noteOff', midiNote)
    }
  }, [stopNote, midiCapture])

  // Handle "Done" button - tell the agent user finished playing
  const handleDonePlaying = useCallback(() => {
    // The agent will call evaluateUserPlaying when it receives this message
    // For now, we just notify via console - the voice interaction handles this
    console.log('User indicated they are done playing')
    // In a real scenario, you might send a signal to the agent here
  }, [])

  return (
    <div className="flex-1 flex flex-col items-center justify-between py-8 px-4">
      {/* Header */}
      <header className="w-full max-w-4xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lyra-orb-1 font-bold text-xl">Lyra</span>
        </div>
        <nav>
          <button className="p-2 hover:bg-lyra-surface rounded-lg transition-colors">
            <svg
              className="w-6 h-6 text-lyra-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center gap-8 w-full max-w-4xl">
        {/* Headline */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-5xl font-bold text-lyra-text">
            Play piano with Lyra.
          </h1>
          <p className="text-lyra-muted text-lg md:text-xl">
            Your AI companion for mastering the keys.
          </p>
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-red-400">
            {error}
          </div>
        )}

        {/* Orb */}
        <LyraOrb
          status={conversation.status}
          agentState={agentState}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          getInputVolume={getInputVolume}
          getOutputVolume={getOutputVolume}
          message={message}
        />
      </main>

      {/* Piano Keyboard */}
      <footer className="w-full">
        <div className="bg-lyra-surface/50 rounded-t-xl border-t border-lyra-accent/20 p-2 md:p-4">
          {/* Listening for piano indicator */}
          {listeningForPiano === 'listening_for_piano' && (
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lyra-orb-1 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-lyra-orb-1"></span>
              </span>
              <p className="text-lyra-orb-1 text-sm font-medium">
                Listening... Play your notes, then say "I'm done" or click Done
              </p>
              <button
                onClick={handleDonePlaying}
                className="ml-2 px-3 py-1 text-xs font-medium bg-lyra-orb-1/20 text-lyra-orb-1 rounded-full hover:bg-lyra-orb-1/30 transition-colors"
              >
                Done
              </button>
            </div>
          )}
          {listeningForPiano === 'processing' && (
            <div className="flex items-center justify-center gap-2 mb-2">
              <svg className="animate-spin h-4 w-4 text-lyra-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-lyra-muted text-sm">Evaluating your playing...</p>
            </div>
          )}
          {/* Piano loading indicator */}
          {!pianoInitialized && listeningForPiano === 'not_listening' && (
            <p className="text-lyra-muted text-xs text-center mb-2">
              Click a key to load piano sounds...
            </p>
          )}
          {/* Piano keyboard - show 2 octaves on mobile, full on desktop */}
          <div className="md:hidden">
            <PianoKeyboard
              pressedKeys={pressedKeys}
              highlightedKeys={highlightedKeys}
              onNoteOn={handleNoteOn}
              onNoteOff={handleNoteOff}
              startNote={48}  // C3
              endNote={72}    // C5 (2 octaves)
            />
          </div>
          <div className="hidden md:block">
            <PianoKeyboard
              pressedKeys={pressedKeys}
              highlightedKeys={highlightedKeys}
              onNoteOn={handleNoteOn}
              onNoteOff={handleNoteOff}
              startNote={36}  // C2
              endNote={96}    // C7 (5 octaves)
            />
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Lyra
