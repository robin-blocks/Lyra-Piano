/**
 * DemoPlayer - Plays back musical patterns for demonstration
 * Used when the AI agent wants to show the user how to play something
 */

import { ExpectedPattern } from './patterns'
import { PianoAudio } from './PianoAudio'

export interface DemoCallbacks {
  /** Called when a key should be visually highlighted */
  onKeyHighlight?: (midiNote: number) => void
  /** Called when multiple keys should be highlighted (for chords) */
  onKeysHighlight?: (midiNotes: number[]) => void
  /** Called when a key highlight should be removed */
  onKeyUnhighlight?: (midiNote: number) => void
  /** Called when demo starts */
  onStart?: () => void
  /** Called when demo ends */
  onEnd?: () => void
}

export interface DemoOptions {
  /** Default timing between notes if pattern doesn't specify (ms) */
  defaultTiming?: number
  /** Note duration as percentage of timing (0-1) */
  noteDurationRatio?: number
  /** Velocity for playback (0-127) */
  velocity?: number
  /** Whether to highlight keys visually */
  highlightKeys?: boolean
}

const DEFAULT_OPTIONS: Required<DemoOptions> = {
  defaultTiming: 400,
  noteDurationRatio: 0.8,
  velocity: 80,
  highlightKeys: true,
}

/**
 * Play a demonstration of a pattern
 */
export async function playDemonstration(
  pattern: ExpectedPattern,
  pianoAudio: PianoAudio,
  callbacks: DemoCallbacks = {},
  options: DemoOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const { notes, timing, type } = pattern

  // Ensure piano is fully ready before playing
  await pianoAudio.ensureReady()

  callbacks.onStart?.()

  if (type === 'chord') {
    // For chords, play all notes simultaneously
    await playChord(notes, pianoAudio, callbacks, opts)
  } else {
    // For scales, arpeggios, melodies - play sequentially
    await playSequence(notes, timing, pianoAudio, callbacks, opts)
  }

  callbacks.onEnd?.()
}

/**
 * Play notes as a chord (simultaneously)
 */
async function playChord(
  notes: number[],
  pianoAudio: PianoAudio,
  callbacks: DemoCallbacks,
  opts: Required<DemoOptions>
): Promise<void> {
  // Highlight all keys
  if (opts.highlightKeys) {
    notes.forEach(note => callbacks.onKeyHighlight?.(note))
  }

  // Play all notes
  notes.forEach(note => pianoAudio.playNote(note, opts.velocity))

  // Hold for a moment
  await sleep(800)

  // Stop all notes and remove highlights
  notes.forEach(note => {
    pianoAudio.stopNote(note)
    if (opts.highlightKeys) {
      callbacks.onKeyUnhighlight?.(note)
    }
  })

  // Small gap after chord
  await sleep(200)
}

/**
 * Play notes in sequence
 */
async function playSequence(
  notes: number[],
  timing: number[] | undefined,
  pianoAudio: PianoAudio,
  callbacks: DemoCallbacks,
  opts: Required<DemoOptions>
): Promise<void> {
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i]
    const noteTimingMs = timing?.[i] ?? opts.defaultTiming
    const noteDuration = noteTimingMs * opts.noteDurationRatio

    // Highlight key
    if (opts.highlightKeys) {
      callbacks.onKeyHighlight?.(note)
    }

    // Play note
    pianoAudio.playNote(note, opts.velocity)

    // Wait for note duration
    await sleep(noteDuration)

    // Stop note and remove highlight
    pianoAudio.stopNote(note)
    if (opts.highlightKeys) {
      callbacks.onKeyUnhighlight?.(note)
    }

    // Wait for remaining time (gap between notes)
    const gapTime = noteTimingMs - noteDuration
    if (gapTime > 0) {
      await sleep(gapTime)
    }
  }
}

/**
 * Highlight keys without playing (for visual guidance)
 */
export function highlightPatternKeys(
  pattern: ExpectedPattern,
  onHighlight: (midiNotes: number[]) => void
): void {
  onHighlight(pattern.notes)
}

/**
 * Play a single note for demonstration
 */
export async function playSingleNote(
  midiNote: number,
  pianoAudio: PianoAudio,
  callbacks: DemoCallbacks = {},
  durationMs: number = 500,
  velocity: number = 80
): Promise<void> {
  callbacks.onKeyHighlight?.(midiNote)
  pianoAudio.playNote(midiNote, velocity)

  await sleep(durationMs)

  pianoAudio.stopNote(midiNote)
  callbacks.onKeyUnhighlight?.(midiNote)
}

/**
 * Utility: Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Class-based DemoPlayer for more control
 */
export class DemoPlayer {
  private pianoAudio: PianoAudio
  private callbacks: DemoCallbacks
  private options: Required<DemoOptions>
  private isPlaying: boolean = false
  private shouldStop: boolean = false

  constructor(
    pianoAudio: PianoAudio,
    callbacks: DemoCallbacks = {},
    options: DemoOptions = {}
  ) {
    this.pianoAudio = pianoAudio
    this.callbacks = callbacks
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: DemoCallbacks): void {
    this.callbacks = callbacks
  }

  /**
   * Check if currently playing
   */
  get playing(): boolean {
    return this.isPlaying
  }

  /**
   * Play a pattern
   */
  async play(pattern: ExpectedPattern): Promise<boolean> {
    if (this.isPlaying) {
      console.warn('DemoPlayer: Already playing')
      return false
    }

    this.isPlaying = true
    this.shouldStop = false

    try {
      await playDemonstration(pattern, this.pianoAudio, this.callbacks, this.options)
      return !this.shouldStop
    } finally {
      this.isPlaying = false
    }
  }

  /**
   * Stop playback
   */
  stop(): void {
    this.shouldStop = true
    this.pianoAudio.stopAll()
  }

  /**
   * Play a single note
   */
  async playNote(midiNote: number, durationMs: number = 500): Promise<void> {
    await playSingleNote(
      midiNote,
      this.pianoAudio,
      this.callbacks,
      durationMs,
      this.options.velocity
    )
  }
}

/**
 * Custom sequence types for agent-generated content
 */
export interface SequenceNote {
  midiNote: number
  duration?: number  // ms, defaults to 400
  velocity?: number  // 0-127, defaults to 80
}

export interface CustomSequenceOptions {
  /** Play all notes simultaneously as a chord */
  asChord?: boolean
  /** Default duration for chord or notes without duration (ms) */
  duration?: number
  /** Default velocity (0-127) */
  velocity?: number
}

export interface CustomSequenceResult {
  notesPlayed: number
  durationMs: number
  midiNotes: number[]
  type: 'chord' | 'melody'
}

/**
 * Play a custom sequence of notes (for agent-generated content)
 * Supports both melodies (sequential) and chords (simultaneous)
 */
export async function playCustomSequence(
  notes: SequenceNote[],
  pianoAudio: PianoAudio,
  callbacks: DemoCallbacks = {},
  options: CustomSequenceOptions = {}
): Promise<CustomSequenceResult> {
  const {
    asChord = false,
    duration: defaultDuration = 400,
    velocity: defaultVelocity = 80
  } = options

  const midiNotes = notes.map(n => n.midiNote)

  // Ensure piano is fully ready before playing
  await pianoAudio.ensureReady()

  callbacks.onStart?.()

  let totalDuration = 0

  if (asChord) {
    // Play all notes simultaneously
    const chordDuration = options.duration ?? 800

    // Highlight all keys at once (use batch callback if available)
    if (callbacks.onKeysHighlight) {
      callbacks.onKeysHighlight(midiNotes)
    } else {
      midiNotes.forEach(note => callbacks.onKeyHighlight?.(note))
    }

    // Play all notes
    notes.forEach(n => {
      pianoAudio.playNote(n.midiNote, n.velocity ?? defaultVelocity)
    })

    // Hold chord
    await sleep(chordDuration)

    // Stop all notes and clear highlights
    midiNotes.forEach(note => {
      pianoAudio.stopNote(note)
    })
    callbacks.onKeyUnhighlight?.(0) // Signal to clear all

    totalDuration = chordDuration
  } else {
    // Play notes sequentially as melody
    for (const note of notes) {
      const noteDuration = note.duration ?? defaultDuration
      const noteVelocity = note.velocity ?? defaultVelocity

      // Highlight
      callbacks.onKeyHighlight?.(note.midiNote)

      // Play
      pianoAudio.playNote(note.midiNote, noteVelocity)

      // Wait for 80% of duration (note sounds)
      await sleep(noteDuration * 0.8)

      // Stop note
      pianoAudio.stopNote(note.midiNote)
      callbacks.onKeyUnhighlight?.(note.midiNote)

      // Wait for remaining 20% (gap between notes)
      await sleep(noteDuration * 0.2)

      totalDuration += noteDuration
    }
  }

  callbacks.onEnd?.()

  return {
    notesPlayed: notes.length,
    durationMs: totalDuration,
    midiNotes,
    type: asChord ? 'chord' : 'melody'
  }
}

export default DemoPlayer
