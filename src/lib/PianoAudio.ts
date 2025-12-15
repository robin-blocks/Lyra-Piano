import { SplendidGrandPiano } from 'smplr'

/**
 * PianoAudio - Wrapper for SplendidGrandPiano sampler
 * Adapted from Museverse IWSDK project
 */
export class PianoAudio {
  private audioContext: AudioContext | null = null
  private piano: SplendidGrandPiano | null = null
  private sustainActive: boolean = false
  private sustainedNotes: Set<number> = new Set()
  private isInitialized: boolean = false
  private isLoading: boolean = false
  private loadPromise: Promise<void> | null = null

  /**
   * Initialize the audio context and piano sampler
   * Must be called after a user interaction (click/touch) due to browser autoplay policies
   */
  async initialize(): Promise<void> {
    // If already fully initialized and context is running, we're good
    if (this.isInitialized && this.audioContext?.state === 'running') {
      return
    }

    // If context exists but is suspended, try to resume it
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume()
        // Re-check state after resume (TypeScript needs this pattern)
        const ctx = this.audioContext
        if (ctx.state === 'running' && this.piano) {
          this.isInitialized = true
          this.isLoading = false
          return
        }
      } catch (e) {
        // Resume failed, will need to recreate
        console.log('Failed to resume AudioContext, recreating...')
      }
    }

    // If currently loading, wait for it
    if (this.isLoading && this.loadPromise) {
      await this.loadPromise
      // After loading, try to resume if suspended
      if (this.audioContext?.state === 'suspended') {
        await this.audioContext.resume()
      }
      return
    }

    this.isLoading = true
    this.loadPromise = this._doInitialize()
    return this.loadPromise
  }

  private async _doInitialize(): Promise<void> {
    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

      // Resume immediately
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      // Create piano sampler
      this.piano = new SplendidGrandPiano(this.audioContext)

      // Wait for samples to load
      await this.piano.load

      this.isInitialized = true
      this.isLoading = false
      console.log('PianoAudio initialized successfully')
    } catch (error) {
      this.isLoading = false
      console.error('Failed to initialize PianoAudio:', error)
      throw error
    }
  }

  /**
   * Resume audio context if suspended (needed for iOS/Safari)
   */
  resume(): void {
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume()
    }
  }

  /**
   * Play a note
   * @param midiNote - MIDI note number (21-108 for 88-key piano)
   * @param velocity - Note velocity (0-127, default 80)
   */
  playNote(midiNote: number, velocity: number = 80): void {
    // Auto-initialize on first play if needed
    if (!this.isInitialized && !this.isLoading) {
      this.initialize().then(() => {
        this._playNote(midiNote, velocity)
      })
      return
    }

    // If still loading, queue the note
    if (this.isLoading && this.loadPromise) {
      this.loadPromise.then(() => {
        this._playNote(midiNote, velocity)
      })
      return
    }

    this._playNote(midiNote, velocity)
  }

  private _playNote(midiNote: number, velocity: number): void {
    if (!this.piano) {
      console.warn('PianoAudio not ready')
      return
    }

    // Resume context if needed (async but don't wait)
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().catch(() => {
        console.warn('Could not resume AudioContext - needs user gesture')
      })
    }

    // Remove from sustained notes if replaying
    this.sustainedNotes.delete(midiNote)

    // Clamp velocity to valid range (0-127)
    const clampedVelocity = Math.max(0, Math.min(127, velocity))

    // Play the note
    this.piano.start({ note: midiNote, velocity: clampedVelocity })
  }

  /**
   * Stop a note
   * @param midiNote - MIDI note number
   */
  stopNote(midiNote: number): void {
    if (!this.piano || !this.isInitialized) return

    if (this.sustainActive) {
      // If sustain is active, add to sustained notes instead of stopping
      this.sustainedNotes.add(midiNote)
    } else {
      this.piano.stop(midiNote)
    }
  }

  /**
   * Set sustain pedal state
   * @param active - Whether sustain pedal is pressed
   */
  setSustain(active: boolean): void {
    this.sustainActive = active

    if (!active && this.piano) {
      // Release all sustained notes when pedal is released
      this.sustainedNotes.forEach((midiNote) => {
        this.piano?.stop(midiNote)
      })
      this.sustainedNotes.clear()
    }
  }

  /**
   * Stop all currently playing notes
   */
  stopAll(): void {
    if (!this.piano) return

    // Stop all 88 keys (MIDI 21-108)
    for (let note = 21; note <= 108; note++) {
      this.piano.stop(note)
    }
    this.sustainedNotes.clear()
  }

  /**
   * Check if audio is initialized
   */
  get initialized(): boolean {
    return this.isInitialized
  }

  /**
   * Dispose of audio resources
   */
  dispose(): void {
    this.stopAll()
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    this.piano = null
    this.isInitialized = false
    this.isLoading = false
    this.loadPromise = null
  }
}

// Singleton instance for global access
let pianoAudioInstance: PianoAudio | null = null

export function getPianoAudio(): PianoAudio {
  if (!pianoAudioInstance) {
    pianoAudioInstance = new PianoAudio()
  }
  return pianoAudioInstance
}

export default PianoAudio
