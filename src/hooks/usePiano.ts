'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { getPianoAudio, PianoAudio } from '@/lib/PianoAudio'

interface UsePianoOptions {
  /** Auto-initialize on mount (requires user interaction first) */
  autoInit?: boolean
}

interface UsePianoReturn {
  /** Set of currently pressed MIDI note numbers */
  pressedKeys: Set<number>
  /** Set of highlighted MIDI note numbers (for demos) */
  highlightedKeys: Set<number>
  /** Whether piano audio is initialized */
  isInitialized: boolean
  /** Whether piano is currently initializing */
  isLoading: boolean
  /** Initialize the piano audio (call on user interaction) */
  initialize: () => Promise<void>
  /** Play a note */
  playNote: (midiNote: number, velocity?: number) => void
  /** Stop a note */
  stopNote: (midiNote: number) => void
  /** Highlight specific keys (for demonstrations) */
  highlightKeys: (midiNotes: number[]) => void
  /** Clear all highlighted keys */
  clearHighlights: () => void
  /** Set sustain pedal state */
  setSustain: (active: boolean) => void
  /** Stop all notes */
  stopAll: () => void
}

/**
 * Hook for managing piano state and audio
 */
export function usePiano(options: UsePianoOptions = {}): UsePianoReturn {
  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set())
  const [highlightedKeys, setHighlightedKeys] = useState<Set<number>>(new Set())
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const pianoRef = useRef<PianoAudio | null>(null)

  // Get piano instance on mount and preload on first user interaction
  useEffect(() => {
    pianoRef.current = getPianoAudio()
    setIsInitialized(pianoRef.current.initialized)

    // Preload piano on first user interaction anywhere on the page
    const handleFirstInteraction = () => {
      if (pianoRef.current && !pianoRef.current.initialized) {
        setIsLoading(true)
        pianoRef.current.initialize().then(() => {
          setIsInitialized(true)
          setIsLoading(false)
        }).catch(() => {
          setIsLoading(false)
        })
      }
      // Remove listeners after first interaction
      document.removeEventListener('click', handleFirstInteraction)
      document.removeEventListener('touchstart', handleFirstInteraction)
      document.removeEventListener('keydown', handleFirstInteraction)
    }

    document.addEventListener('click', handleFirstInteraction)
    document.addEventListener('touchstart', handleFirstInteraction)
    document.addEventListener('keydown', handleFirstInteraction)

    return () => {
      document.removeEventListener('click', handleFirstInteraction)
      document.removeEventListener('touchstart', handleFirstInteraction)
      document.removeEventListener('keydown', handleFirstInteraction)
    }
  }, [])

  // Initialize piano audio
  const initialize = useCallback(async () => {
    if (!pianoRef.current || isInitialized || isLoading) return

    setIsLoading(true)
    try {
      await pianoRef.current.initialize()
      setIsInitialized(true)
    } catch (error) {
      console.error('Failed to initialize piano:', error)
    } finally {
      setIsLoading(false)
    }
  }, [isInitialized, isLoading])

  // Play a note
  const playNote = useCallback((midiNote: number, velocity: number = 80) => {
    if (!pianoRef.current) return

    // PianoAudio now auto-initializes on first play
    pianoRef.current.playNote(midiNote, velocity)

    // Update initialized state after first play
    if (!isInitialized) {
      setIsInitialized(true)
    }

    // Update pressed keys state
    setPressedKeys((prev) => {
      const next = new Set(prev)
      next.add(midiNote)
      return next
    })
  }, [isInitialized])

  // Stop a note
  const stopNote = useCallback((midiNote: number) => {
    if (!pianoRef.current) return

    pianoRef.current.stopNote(midiNote)

    // Update pressed keys state
    setPressedKeys((prev) => {
      const next = new Set(prev)
      next.delete(midiNote)
      return next
    })
  }, [])

  // Highlight keys for demonstrations
  const highlightKeys = useCallback((midiNotes: number[]) => {
    setHighlightedKeys(new Set(midiNotes))
  }, [])

  // Clear highlights
  const clearHighlights = useCallback(() => {
    setHighlightedKeys(new Set())
  }, [])

  // Set sustain pedal
  const setSustain = useCallback((active: boolean) => {
    pianoRef.current?.setSustain(active)
  }, [])

  // Stop all notes
  const stopAll = useCallback(() => {
    pianoRef.current?.stopAll()
    setPressedKeys(new Set())
  }, [])

  return {
    pressedKeys,
    highlightedKeys,
    isInitialized,
    isLoading,
    initialize,
    playNote,
    stopNote,
    highlightKeys,
    clearHighlights,
    setSustain,
    stopAll,
  }
}

export default usePiano
