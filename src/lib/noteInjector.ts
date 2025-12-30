/**
 * Note Injector
 *
 * Real-time MIDI note to speech injection system.
 * Collects notes as they're played, detects chords (notes within 50ms),
 * and injects speech audio clips into the ElevenLabs conversation stream.
 */

import { loadAndConcatenateClips, midiToClipName } from './speechClips'

const CHORD_WINDOW_MS = 50 // Notes within 50ms are treated as a chord

export type InjectPCMFunction = (pcm: Int16Array) => Promise<void>

export class NoteInjector {
  private pendingNotes: number[] = []
  private flushTimeout: ReturnType<typeof setTimeout> | null = null
  private injectPCM: InjectPCMFunction
  private isProcessing: boolean = false

  constructor(injectPCM: InjectPCMFunction) {
    this.injectPCM = injectPCM
  }

  /**
   * Called when a note is played (noteOn event).
   * Collects notes and flushes after the chord window expires.
   */
  onNoteOn(midiNote: number): void {
    this.pendingNotes.push(midiNote)

    // Reset the flush timer - wait for more notes in the chord window
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout)
    }

    this.flushTimeout = setTimeout(() => {
      this.flush()
    }, CHORD_WINDOW_MS)
  }

  /**
   * Process pending notes and inject the corresponding speech audio.
   */
  private async flush(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      return
    }

    const notes = [...this.pendingNotes]
    this.pendingNotes = []
    this.flushTimeout = null

    if (notes.length === 0) {
      return
    }

    this.isProcessing = true

    try {
      // Sort notes low to high for consistent ordering
      notes.sort((a, b) => a - b)

      // Build the list of clips to concatenate
      const clipNames: string[] = []

      if (notes.length >= 2) {
        // Multiple notes = chord, add "chord" prefix
        clipNames.push('chord')
      }

      // Add individual note clips
      for (const note of notes) {
        clipNames.push(midiToClipName(note))
      }

      console.log('[NoteInjector] Injecting:', clipNames.join(' + '))

      // Load, concatenate, and inject
      const pcmData = await loadAndConcatenateClips(clipNames)
      await this.injectPCM(pcmData)

    } catch (error) {
      console.error('[NoteInjector] Error injecting speech:', error)
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Force flush any pending notes immediately.
   * Useful when disconnecting or cleaning up.
   */
  forceFlush(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout)
      this.flushTimeout = null
    }

    if (this.pendingNotes.length > 0) {
      this.flush()
    }
  }

  /**
   * Clear pending notes without injecting.
   * Useful when the connection is lost.
   */
  clear(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout)
      this.flushTimeout = null
    }
    this.pendingNotes = []
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    this.clear()
  }
}

export default NoteInjector
