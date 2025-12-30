'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { LyraOrb } from '@/components/LyraOrb'
import { PianoKeyboard } from '@/components/Piano'
import { PromptSuggestions, DEFAULT_SUGGESTIONS, type Suggestion } from '@/components/PromptSuggestions'
import { usePiano } from '@/hooks/usePiano'
import { useMidiInput } from '@/hooks/useMidiInput'
import { useAgentWebSocket } from '@/hooks/useAgentWebSocket'
import { getPianoAudio } from '@/lib/PianoAudio'
import { DemoPlayer, playCustomSequence, type SequenceNote } from '@/lib/DemoPlayer'
import { getPatternById, searchPatterns, PATTERNS } from '@/lib/patterns'
import { NoteInjector } from '@/lib/noteInjector'
import { preloadClips } from '@/lib/speechClips'
import { Note } from 'tonal'
import type { ToolHandler } from '@/types/elevenlabs-websocket'

// Environment variable for agent ID - will be set in .env.local
const AGENT_ID = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || ''

// Map WebSocket agent state to orb state
type OrbAgentState = 'idle' | 'listening' | 'talking' | null
function mapAgentState(wsState: 'idle' | 'listening' | 'speaking' | null): OrbAgentState {
  if (wsState === 'speaking') return 'talking'
  return wsState
}

export function Lyra() {
  const [message, setMessage] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  // Prompt suggestions state
  const [suggestions, setSuggestions] = useState<Suggestion[]>(DEFAULT_SUGGESTIONS)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const conversationContextRef = useRef<string[]>([])
  const hasInteractedRef = useRef(false)
  const turnCountRef = useRef(0)
  const lastTurnCountRef = useRef(0)

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

  // Demo player reference
  const demoPlayerRef = useRef<DemoPlayer | null>(null)

  // Note injector for real-time MIDI-to-speech
  const noteInjectorRef = useRef<NoteInjector | null>(null)

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

  // Helper to play a single note with highlighting
  const playNoteWithHighlight = async (
    midiNote: number,
    velocity: number = 80,
    durationMs: number = 500
  ): Promise<void> => {
    const pianoAudio = getPianoAudio()
    await pianoAudio.initialize()

    highlightKeys([midiNote])
    pianoAudio.playNote(midiNote, velocity)

    await new Promise(resolve => setTimeout(resolve, durationMs))

    pianoAudio.stopNote(midiNote)
    clearHighlights()
  }

  // Tool handlers for the WebSocket agent
  // Memoized to maintain stable reference for the hook
  const toolHandlers = useMemo<Record<string, ToolHandler>>(() => ({
    // Play a single note by name (e.g., "C4", "F#3", "Bb5")
    playNote: async (params, { queueAction }) => {
      const { note, velocity = 80, duration = 500 } = params as { note: string; velocity?: number; duration?: number }
      console.log('Agent: Playing note:', note)

      const midiNote = Note.midi(note)
      if (midiNote === null) {
        return JSON.stringify({
          error: 'INVALID_NOTE',
          message: `Note '${note}' is not valid. Use format like C4, F#3, Bb5.`
        })
      }

      // Queue the actual playing to happen after audio finishes
      queueAction(async () => {
        await playNoteWithHighlight(midiNote, velocity, duration)
      }, `playNote: ${note}`)

      return JSON.stringify({
        status: 'scheduled',
        note,
        midiNote
      })
    },

    // Play a sequence of notes (melody or chord)
    playSequence: async (params, { queueAction }) => {
      const { notes, asChord, duration } = params as {
        notes: Array<string | { note: string; duration?: number }>;
        asChord?: boolean;
        duration?: number;
      }
      console.log('Agent: Playing sequence:', params)

      // Convert note names to MIDI numbers (validation happens immediately)
      const sequenceNotes: SequenceNote[] = []
      const noteNames: string[] = []

      for (const item of notes) {
        const noteName = typeof item === 'string' ? item : item.note
        const itemDuration = typeof item === 'string' ? undefined : item.duration

        const midiNote = Note.midi(noteName)
        if (midiNote === null) {
          return JSON.stringify({
            error: 'INVALID_NOTE',
            message: `Note '${noteName}' is not valid. Use format like C4, F#3, Bb5.`
          })
        }

        sequenceNotes.push({
          midiNote,
          duration: itemDuration,
        })
        noteNames.push(noteName)
      }

      // Queue the actual playing to happen after audio finishes
      queueAction(async () => {
        const pianoAudio = getPianoAudio()
        await pianoAudio.initialize()

        await playCustomSequence(
          sequenceNotes,
          pianoAudio,
          {
            onKeyHighlight: (note) => highlightKeys([note]),
            onKeysHighlight: (notes) => highlightKeys(notes),
            onKeyUnhighlight: () => clearHighlights(),
          },
          {
            asChord,
            duration,
          }
        )
      }, `playSequence: ${noteNames.join(', ')}`)

      return JSON.stringify({
        status: 'scheduled',
        notes: noteNames,
        asChord: !!asChord,
      })
    },

    // Demonstrate a pattern on the piano
    demonstratePattern: async (params, { queueAction }) => {
      const { patternId } = params as { patternId: string }
      console.log('Agent: Demonstrating pattern:', patternId)

      const pattern = getPatternById(patternId)
      if (!pattern) {
        return 'Pattern not found'
      }

      // Queue the demonstration to happen after audio finishes
      queueAction(async () => {
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
      }, `demonstratePattern: ${pattern.name}`)

      return JSON.stringify({
        status: 'scheduled',
        patternId,
        patternName: pattern.name,
      })
    },

    // Highlight specific keys on the piano
    highlightKeys: async (params) => {
      const { midiNotes } = params as { midiNotes: number[] }
      console.log('Agent: Highlighting keys:', midiNotes)
      highlightKeys(midiNotes)
      return 'Keys highlighted'
    },

    // Clear key highlights
    clearHighlights: async () => {
      console.log('Agent: Clearing highlights')
      clearHighlights()
      return 'Highlights cleared'
    },

    // Get available patterns
    getAvailablePatterns: async (params) => {
      const { type, difficulty, search } = params as { type?: string; difficulty?: number; search?: string }
      console.log('Agent: Getting available patterns', params)

      let patterns = Object.values(PATTERNS)

      if (type) {
        patterns = patterns.filter(p => p.type === type)
      }

      if (difficulty !== undefined) {
        const maxDifficulty = difficulty
        patterns = patterns.filter(p => p.difficulty <= maxDifficulty)
      }

      if (search) {
        patterns = searchPatterns(search)
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
    getPatternDetails: async (params) => {
      const { patternId } = params as { patternId: string }
      const pattern = getPatternById(patternId)
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
  }), [highlightKeys, clearHighlights, playNoteWithHighlight])

  // Use the custom WebSocket hook for interleaved audio/tool processing
  const {
    connect,
    disconnect,
    status,
    agentState: wsAgentState,
    getInputVolume,
    getOutputVolume,
    injectPCM,
  } = useAgentWebSocket({
    agentId: AGENT_ID,
    toolHandlers,
    onUserTranscript: (transcript) => {
      console.log('User transcript:', transcript)
      // Track conversation for contextual suggestions
      conversationContextRef.current.push(`User: ${transcript}`)
      // Hide suggestions when user starts prompting
      if (!hasInteractedRef.current) {
        hasInteractedRef.current = true
      }
      setShowSuggestions(false)
      turnCountRef.current += 1
    },
    onAgentResponse: (response) => {
      console.log('Agent response:', response)
      // Track conversation for contextual suggestions
      conversationContextRef.current.push(`Lyra: ${response}`)
      // Count agent turn (for tracking complete exchanges)
      if (hasInteractedRef.current) {
        turnCountRef.current += 1
      }
    },
    onError: (err) => {
      console.error('WebSocket error:', err)
      setError('Connection error. Please try again.')
    },
  })

  // Initialize NoteInjector when connected
  useEffect(() => {
    if (status === 'connected') {
      // Create the note injector with the injectPCM function
      noteInjectorRef.current = new NoteInjector(injectPCM)
      console.log('[Lyra] NoteInjector initialized')

      // Preload speech clips for faster response (full keyboard range)
      preloadClips(2, 7).catch(err => {
        console.warn('[Lyra] Failed to preload speech clips:', err)
      })
    }

    return () => {
      if (noteInjectorRef.current) {
        noteInjectorRef.current.dispose()
        noteInjectorRef.current = null
      }
    }
  }, [status, injectPCM])

  // Map WebSocket agent state to orb-compatible state
  const agentState = mapAgentState(wsAgentState)

  // Fetch contextual suggestions from Gemini
  const fetchSuggestions = useCallback(async () => {
    if (conversationContextRef.current.length < 2) return // Need some context first

    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationContext: conversationContextRef.current }),
      })

      if (!response.ok) {
        console.warn('[Lyra] Failed to fetch suggestions:', response.status)
        return
      }

      const data = await response.json()
      if (data.suggestions && Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions)
      }
    } catch (err) {
      console.warn('[Lyra] Error fetching suggestions:', err)
    }
  }, [])

  // Show suggestions when first connected
  useEffect(() => {
    if (status === 'connected' && !hasInteractedRef.current) {
      // Small delay after connection for agent greeting
      const timer = setTimeout(() => {
        setShowSuggestions(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [status])

  // Control suggestion visibility based on conversation flow
  // Show suggestions again after a complete exchange (user spoke + agent responded)
  useEffect(() => {
    if (agentState === 'idle' && hasInteractedRef.current) {
      // Check if we've had a complete exchange since last time
      if (turnCountRef.current >= 2 && turnCountRef.current > lastTurnCountRef.current) {
        lastTurnCountRef.current = turnCountRef.current
        // Small delay to let conversation settle
        const timer = setTimeout(() => {
          setShowSuggestions(true)
          // Fetch new contextual suggestions
          fetchSuggestions()
        }, 1500)
        return () => clearTimeout(timer)
      }
    }
  }, [agentState, fetchSuggestions])

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
      await connect()
      setMessage("Hello! I'm ready to play.")
    } catch (err) {
      console.error('Failed to connect:', err)
      setError('Failed to connect. Please check your configuration.')
    }
  }, [connect])

  const handleDisconnect = useCallback(() => {
    disconnect()
    setMessage('')
    // NoteInjector cleanup happens in the useEffect
  }, [disconnect])

  // Note handlers - play sound and inject to agent via NoteInjector
  const handleNoteOn = useCallback((midiNote: number, velocity: number = 80) => {
    playNote(midiNote, velocity)

    // Inject note to agent if connected
    noteInjectorRef.current?.onNoteOn(midiNote)
  }, [playNote])

  const handleNoteOff = useCallback((midiNote: number) => {
    stopNote(midiNote)
    // NoteOff doesn't need to be sent to agent
  }, [stopNote])

  // Handle sustain pedal
  const handleSustain = useCallback((active: boolean) => {
    const pianoAudio = getPianoAudio()
    pianoAudio.setSustain(active)
  }, [])

  // Hardware MIDI input
  const {
    connectedDevice: midiDevice,
    isSupported: midiSupported,
  } = useMidiInput({
    onNoteOn: handleNoteOn,
    onNoteOff: handleNoteOff,
    onSustain: handleSustain,
    autoConnect: true,
  })

  return (
    <div className="flex-1 flex flex-col items-center justify-between py-8 px-4">
      {/* Header */}
      <header className="w-full max-w-[496px] md:max-w-[1184px] flex items-center justify-start">
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
          status={status}
          agentState={agentState}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          getInputVolume={getInputVolume}
          getOutputVolume={getOutputVolume}
          message={message}
        />

        {/* Prompt Suggestions */}
        <PromptSuggestions
          suggestions={suggestions}
          visible={showSuggestions}
        />
      </main>

      {/* Piano Keyboard */}
      <footer className="w-full max-w-[496px] md:max-w-[1184px]">
        <div className="bg-lyra-surface/50 rounded-t-xl border-t border-lyra-accent/20 p-2 md:p-4">
          {/* MIDI device indicator */}
          {midiDevice && (
            <div className="flex items-center justify-center gap-1 mb-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-xs text-lyra-muted">Connected to: {midiDevice.name}</span>
            </div>
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
