'use client'

import { useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'

// Piano key configuration
const WHITE_KEY_WIDTH = 24
const WHITE_KEY_HEIGHT = 120
const BLACK_KEY_WIDTH = 14
const BLACK_KEY_HEIGHT = 75

// 88-key piano: A0 (MIDI 21) to C8 (MIDI 108)
const FIRST_MIDI_NOTE = 21
const LAST_MIDI_NOTE = 108

// Pattern of black keys within an octave (0 = C, 1 = C#, etc.)
const BLACK_KEY_PATTERN = [1, 3, 6, 8, 10] // C#, D#, F#, G#, A#

// Note names for reference
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

interface KeyInfo {
  midiNote: number
  isBlack: boolean
  noteName: string
  octave: number
  xPosition: number
}

/**
 * Generate key information for all 88 keys
 */
function generateKeys(): KeyInfo[] {
  const keys: KeyInfo[] = []
  let whiteKeyIndex = 0

  for (let midiNote = FIRST_MIDI_NOTE; midiNote <= LAST_MIDI_NOTE; midiNote++) {
    const noteInOctave = midiNote % 12
    const octave = Math.floor(midiNote / 12) - 1
    const isBlack = BLACK_KEY_PATTERN.includes(noteInOctave)
    const noteName = NOTE_NAMES[noteInOctave]

    if (isBlack) {
      // Black key positioned relative to previous white key
      const xPosition = whiteKeyIndex * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2
      keys.push({ midiNote, isBlack, noteName, octave, xPosition })
    } else {
      // White key
      const xPosition = whiteKeyIndex * WHITE_KEY_WIDTH
      keys.push({ midiNote, isBlack, noteName, octave, xPosition })
      whiteKeyIndex++
    }
  }

  return keys
}

const ALL_KEYS = generateKeys()
const WHITE_KEYS = ALL_KEYS.filter((k) => !k.isBlack)
const BLACK_KEYS = ALL_KEYS.filter((k) => k.isBlack)
const TOTAL_WIDTH = WHITE_KEYS.length * WHITE_KEY_WIDTH

interface PianoKeyboardProps {
  /** Set of currently pressed MIDI notes */
  pressedKeys?: Set<number>
  /** Set of highlighted MIDI notes (for demos) */
  highlightedKeys?: Set<number>
  /** Callback when a note starts playing */
  onNoteOn?: (midiNote: number, velocity: number) => void
  /** Callback when a note stops playing */
  onNoteOff?: (midiNote: number) => void
  /** Optional className for the container */
  className?: string
  /** Starting MIDI note to display (for smaller displays) */
  startNote?: number
  /** Ending MIDI note to display (for smaller displays) */
  endNote?: number
}

export function PianoKeyboard({
  pressedKeys = new Set(),
  highlightedKeys = new Set(),
  onNoteOn,
  onNoteOff,
  className,
  startNote = FIRST_MIDI_NOTE,
  endNote = LAST_MIDI_NOTE,
}: PianoKeyboardProps) {
  const activeNotesRef = useRef<Set<number>>(new Set())

  // Filter keys to display range
  const displayKeys = ALL_KEYS.filter(
    (k) => k.midiNote >= startNote && k.midiNote <= endNote
  )
  const displayWhiteKeys = displayKeys.filter((k) => !k.isBlack)
  const displayBlackKeys = displayKeys.filter((k) => k.isBlack)

  // Calculate offset for display range
  const firstWhiteKey = displayWhiteKeys[0]
  const xOffset = firstWhiteKey ? firstWhiteKey.xPosition : 0
  const displayWidth = displayWhiteKeys.length * WHITE_KEY_WIDTH

  // Handle note on
  const handleNoteOn = useCallback(
    (midiNote: number, e: React.PointerEvent) => {
      e.preventDefault()
      if (activeNotesRef.current.has(midiNote)) return

      activeNotesRef.current.add(midiNote)
      // Velocity based on vertical position (higher = louder)
      const velocity = 80
      onNoteOn?.(midiNote, velocity)
    },
    [onNoteOn]
  )

  // Handle note off
  const handleNoteOff = useCallback(
    (midiNote: number) => {
      if (!activeNotesRef.current.has(midiNote)) return

      activeNotesRef.current.delete(midiNote)
      onNoteOff?.(midiNote)
    },
    [onNoteOff]
  )

  // Handle pointer leave (stop note if dragging out)
  const handlePointerLeave = useCallback(
    (midiNote: number, e: React.PointerEvent) => {
      if (e.buttons > 0) {
        handleNoteOff(midiNote)
      }
    },
    [handleNoteOff]
  )

  // Handle pointer enter while dragging
  const handlePointerEnter = useCallback(
    (midiNote: number, e: React.PointerEvent) => {
      if (e.buttons > 0) {
        handleNoteOn(midiNote, e)
      }
    },
    [handleNoteOn]
  )

  // Get key colors - static colors only
  const getKeyColors = (key: KeyInfo) => {
    if (key.isBlack) {
      return {
        fill: '#1a1a2e',
        stroke: '#2a2a3e',
      }
    } else {
      return {
        fill: '#f0f0f8',
        stroke: '#c8c8d0',
      }
    }
  }

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <svg
        viewBox={`0 0 ${displayWidth} ${WHITE_KEY_HEIGHT}`}
        className="w-full h-auto min-h-[100px] max-h-[160px]"
        style={{ touchAction: 'none' }}
      >
        {/* Gradient definitions */}
        <defs>
          <linearGradient id="pressedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0fffc1" />
            <stop offset="50%" stopColor="#7e0fff" />
            <stop offset="100%" stopColor="#CADCFC" />
          </linearGradient>
          <linearGradient id="whiteKeyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f8f8ff" />
            <stop offset="100%" stopColor="#e0e0e8" />
          </linearGradient>
          <linearGradient id="blackKeyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2a2a3e" />
            <stop offset="100%" stopColor="#1a1a2e" />
          </linearGradient>
        </defs>

        {/* White keys (render first, behind black keys) */}
        {displayWhiteKeys.map((key) => {
          const colors = getKeyColors(key)
          const isPressed = pressedKeys.has(key.midiNote)
          return (
            <rect
              key={key.midiNote}
              x={key.xPosition - xOffset}
              y={0}
              width={WHITE_KEY_WIDTH - 1}
              height={WHITE_KEY_HEIGHT}
              rx={3}
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth={1}
              className="cursor-pointer"
              onPointerDown={(e) => handleNoteOn(key.midiNote, e)}
              onPointerUp={() => handleNoteOff(key.midiNote)}
              onPointerLeave={(e) => handlePointerLeave(key.midiNote, e)}
              onPointerEnter={(e) => handlePointerEnter(key.midiNote, e)}
              onPointerCancel={() => handleNoteOff(key.midiNote)}
            />
          )
        })}

        {/* Black keys (render on top) */}
        {displayBlackKeys.map((key) => {
          const colors = getKeyColors(key)
          const isPressed = pressedKeys.has(key.midiNote)
          return (
            <rect
              key={key.midiNote}
              x={key.xPosition - xOffset}
              y={0}
              width={BLACK_KEY_WIDTH}
              height={BLACK_KEY_HEIGHT}
              rx={2}
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth={1}
              className="cursor-pointer"
              onPointerDown={(e) => handleNoteOn(key.midiNote, e)}
              onPointerUp={() => handleNoteOff(key.midiNote)}
              onPointerLeave={(e) => handlePointerLeave(key.midiNote, e)}
              onPointerEnter={(e) => handlePointerEnter(key.midiNote, e)}
              onPointerCancel={() => handleNoteOff(key.midiNote)}
            />
          )
        })}

        {/* Indicators (render on top of everything) */}
        {displayKeys.map((key) => {
          const isPressed = pressedKeys.has(key.midiNote)
          const isHighlighted = highlightedKeys.has(key.midiNote)

          if (!isPressed && !isHighlighted) return null

          // Priority: Pressed (User) > Highlighted (Agent)
          const isUser = isPressed

          // Center X
          const width = key.isBlack ? BLACK_KEY_WIDTH : WHITE_KEY_WIDTH
          const cx = (key.xPosition - xOffset) + width / 2

          // Center Y
          // White key dot near bottom
          // Black key dot near bottom of black key
          const cy = key.isBlack ? (BLACK_KEY_HEIGHT - 10) : (WHITE_KEY_HEIGHT - 12)

          // Colors
          // User: Orange theme
          // Agent: Slate/Blue theme (from image)
          const fill = isUser ? '#e05a00' : '#4b4b5e'
          const stroke = isUser ? '#ffaa55' : '#7a7a8f'

          return (
            <circle
              key={`dot-${key.midiNote}`}
              cx={cx}
              cy={cy}
              r={key.isBlack ? 3.5 : 4.5}
              fill={fill}
              stroke={stroke}
              strokeWidth={2}
              style={{ pointerEvents: 'none' }}
            />
          )
        })}
      </svg>
    </div>
  )
}

export default PianoKeyboard

// Export constants for use elsewhere
export { FIRST_MIDI_NOTE, LAST_MIDI_NOTE, NOTE_NAMES }
