'use client'

import { useState, useCallback, useRef, useMemo } from 'react'

export interface MidiEvent {
  type: 'noteOn' | 'noteOff'
  midiNote: number
  velocity: number
  timestamp: number
}

export interface MusicalPhrase {
  notes: MidiEvent[]
  startTime: number
  endTime: number
}

interface ChordCluster {
  notes: MidiEvent[]
  timestamp: number
}

// Configuration for phrase detection
const CHORD_CLUSTER_THRESHOLD_MS = 50 // Notes within 50ms = same chord
const PHRASE_SILENCE_THRESHOLD_MS = 1500 // Silence > 1.5s = phrase boundary

interface UseMidiCaptureReturn {
  /** Whether capture is currently active */
  isCapturing: boolean
  /** Current phrase being captured */
  currentPhrase: MusicalPhrase | null
  /** Start capturing MIDI events. Optionally provide a callback for when a phrase is detected (silence). */
  startCapture: (options?: { onPhraseEnd?: () => void }) => void
  /** End capture and return the captured phrase */
  endCapture: () => MusicalPhrase | null
  /** Record a note event */
  recordNoteEvent: (type: 'noteOn' | 'noteOff', midiNote: number, velocity?: number) => void
  /** Clear the current capture without returning */
  clearCapture: () => void
  /** Get grouped chord clusters from current phrase */
  getChordClusters: () => ChordCluster[]
}

/**
 * Hook for capturing MIDI note events and grouping them into musical phrases
 */
export function useMidiCapture(): UseMidiCaptureReturn {
  const [isCapturing, setIsCapturing] = useState(false)
  const [currentPhrase, setCurrentPhrase] = useState<MusicalPhrase | null>(null)

  const phraseRef = useRef<MusicalPhrase | null>(null)

  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const onPhraseEndRef = useRef<(() => void) | null>(null)

  // Start capturing
  const startCapture = useCallback((options?: { onPhraseEnd?: () => void }) => {
    // Clear any existing timeout
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }

    // specific callback for this capture session
    if (options?.onPhraseEnd) {
      onPhraseEndRef.current = options.onPhraseEnd
    } else {
      onPhraseEndRef.current = null
    }

    const now = Date.now()
    const newPhrase: MusicalPhrase = {
      notes: [],
      startTime: now,
      endTime: now,
    }

    phraseRef.current = newPhrase
    setCurrentPhrase(newPhrase)
    setIsCapturing(true)
  }, [])

  // End capture and return phrase
  const endCapture = useCallback((): MusicalPhrase | null => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }

    const phrase = phraseRef.current

    // Update end time if we have notes
    if (phrase && phrase.notes.length > 0) {
      phrase.endTime = Date.now()
    }

    onPhraseEndRef.current = null
    phraseRef.current = null
    setCurrentPhrase(null)
    setIsCapturing(false)

    return phrase
  }, [])

  // Clear capture without returning
  const clearCapture = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }

    phraseRef.current = null
    setCurrentPhrase(null)
    setIsCapturing(false)
  }, [])

  // Record a note event
  const recordNoteEvent = useCallback((
    type: 'noteOn' | 'noteOff',
    midiNote: number,
    velocity: number = 80
  ) => {
    if (!phraseRef.current) return

    const now = Date.now()
    const event: MidiEvent = {
      type,
      midiNote,
      velocity,
      timestamp: now,
    }

    phraseRef.current.notes.push(event)
    phraseRef.current.endTime = now

    // Update state for reactivity
    setCurrentPhrase({ ...phraseRef.current })

    // Reset silence timeout on noteOn events
    if (type === 'noteOn') {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
      }

      // Auto-end phrase after silence threshold
      silenceTimeoutRef.current = setTimeout(() => {
        console.log('Silence detected - phrase may be complete')
        if (onPhraseEndRef.current) {
          onPhraseEndRef.current()
        }
      }, PHRASE_SILENCE_THRESHOLD_MS)
    }
  }, [])

  // Group notes into chord clusters
  const getChordClusters = useCallback((): ChordCluster[] => {
    if (!phraseRef.current || phraseRef.current.notes.length === 0) {
      return []
    }

    const noteOnEvents = phraseRef.current.notes.filter(n => n.type === 'noteOn')
    if (noteOnEvents.length === 0) return []

    const clusters: ChordCluster[] = []
    let currentCluster: ChordCluster = {
      notes: [noteOnEvents[0]],
      timestamp: noteOnEvents[0].timestamp,
    }

    for (let i = 1; i < noteOnEvents.length; i++) {
      const event = noteOnEvents[i]
      const timeDiff = event.timestamp - currentCluster.timestamp

      if (timeDiff <= CHORD_CLUSTER_THRESHOLD_MS) {
        // Same chord cluster
        currentCluster.notes.push(event)
      } else {
        // New chord cluster
        clusters.push(currentCluster)
        currentCluster = {
          notes: [event],
          timestamp: event.timestamp,
        }
      }
    }

    // Push the last cluster
    clusters.push(currentCluster)

    return clusters
  }, [])

  return useMemo<UseMidiCaptureReturn>(() => ({
    isCapturing,
    currentPhrase,
    startCapture,
    endCapture,
    recordNoteEvent,
    clearCapture,
    getChordClusters,
  }), [
    isCapturing,
    currentPhrase,
    startCapture,
    endCapture,
    recordNoteEvent,
    clearCapture,
    getChordClusters,
  ])
}

export default useMidiCapture
