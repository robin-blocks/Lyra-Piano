'use client'

import { useEffect, useRef } from 'react'

interface UseMusicalTypingConfig {
  /** Whether musical typing is enabled */
  enabled: boolean
  /** Callback when a note starts playing */
  onNoteOn: (midiNote: number, velocity: number) => void
  /** Callback when a note stops playing */
  onNoteOff: (midiNote: number) => void
}

/**
 * Standard musical typing key layout (GarageBand/Ableton style)
 * Maps keyboard keys to MIDI note numbers
 * Focused on middle C octave (C4-C5) for simplicity
 */
const KEY_TO_MIDI: Record<string, number> = {
  // Main octave - A row (C4-B4, MIDI 60-71)
  'a': 60,  // C4 (middle C)
  's': 62,  // D4
  'd': 64,  // E4
  'f': 65,  // F4
  'g': 67,  // G4
  'h': 69,  // A4
  'j': 71,  // B4

  // Black keys - Q row
  'w': 61,  // C#4
  'e': 63,  // D#4
  't': 66,  // F#4
  'y': 68,  // G#4
  'u': 70,  // A#4

  // Extension (C5)
  'k': 72,  // C5
}

/**
 * Reverse mapping: MIDI note to keyboard key
 * Used for displaying key hints on the piano
 */
export const MIDI_TO_KEY: Record<number, string> = Object.fromEntries(
  Object.entries(KEY_TO_MIDI).map(([key, midi]) => [midi, key])
)

/**
 * Hook for musical typing - play piano with computer keyboard
 *
 * Uses standard DAW layout (one octave):
 * - A row: white keys C4-B4 (A S D F G H J)
 * - Q row: black keys C#4-A#4 (W E T Y U)
 * - K: C5 (upper extension)
 */
export function useMusicalTyping({
  enabled,
  onNoteOn,
  onNoteOff,
}: UseMusicalTypingConfig) {
  // Track currently pressed keys to prevent repeat triggers
  const pressedKeysRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!enabled) {
      // Clear any pressed keys when disabled
      pressedKeysRef.current.clear()
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      const key = e.key.toLowerCase()
      const midiNote = KEY_TO_MIDI[key]

      // Check if this key maps to a note and isn't already pressed
      if (midiNote !== undefined && !pressedKeysRef.current.has(key)) {
        pressedKeysRef.current.add(key)
        onNoteOn(midiNote, 80) // Fixed velocity for typing
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const midiNote = KEY_TO_MIDI[key]

      if (midiNote !== undefined && pressedKeysRef.current.has(key)) {
        pressedKeysRef.current.delete(key)
        onNoteOff(midiNote)
      }
    }

    // Handle window blur - release all notes
    const handleBlur = () => {
      pressedKeysRef.current.forEach((key) => {
        const midiNote = KEY_TO_MIDI[key]
        if (midiNote !== undefined) {
          onNoteOff(midiNote)
        }
      })
      pressedKeysRef.current.clear()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)

      // Release any held notes on cleanup
      pressedKeysRef.current.forEach((key) => {
        const midiNote = KEY_TO_MIDI[key]
        if (midiNote !== undefined) {
          onNoteOff(midiNote)
        }
      })
      pressedKeysRef.current.clear()
    }
  }, [enabled, onNoteOn, onNoteOff])
}

export default useMusicalTyping
