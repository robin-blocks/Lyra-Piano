/**
 * AudioPlayer - Handles streaming audio playback with completion detection
 * Used for playing ElevenLabs agent voice output
 */

export class AudioPlayer {
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private gainNode: GainNode | null = null
  private currentSource: AudioBufferSourceNode | null = null
  private isInitialized = false
  private volumeData: Uint8Array<ArrayBuffer> | null = null

  /**
   * Initialize the audio context (must be called after user interaction)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.audioContext?.state === 'running') {
      return
    }

    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume()
    }

    // Check if now running after potential resume
    if (this.audioContext?.state === 'running') {
      this.isInitialized = true
      return
    }

    // Create audio context
    this.audioContext = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

    // Create analyser for volume monitoring
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 256
    this.volumeData = new Uint8Array(this.analyser.frequencyBinCount)

    // Create gain node for volume control
    this.gainNode = this.audioContext.createGain()
    this.gainNode.connect(this.analyser)
    this.analyser.connect(this.audioContext.destination)

    this.isInitialized = true
    console.log('AudioPlayer initialized')
  }

  /**
   * Decode base64 audio and return ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  /**
   * Convert PCM data to AudioBuffer
   * ElevenLabs sends 16-bit PCM at 16kHz mono
   */
  private pcmToAudioBuffer(pcmData: ArrayBuffer, sampleRate = 16000): AudioBuffer {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized')
    }

    const int16Array = new Int16Array(pcmData)
    const float32Array = new Float32Array(int16Array.length)

    // Convert 16-bit PCM to float32 (-1 to 1)
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768
    }

    // Create audio buffer
    const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, sampleRate)
    audioBuffer.getChannelData(0).set(float32Array)

    return audioBuffer
  }

  /**
   * Play a base64-encoded audio chunk and return a promise that resolves when done
   */
  async playChunk(base64Audio: string): Promise<void> {
    if (!this.audioContext || !this.gainNode) {
      await this.initialize()
    }

    if (!this.audioContext || !this.gainNode) {
      throw new Error('Failed to initialize audio context')
    }

    // Resume context if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    return new Promise((resolve, reject) => {
      try {
        // Decode base64 to PCM
        const pcmData = this.base64ToArrayBuffer(base64Audio)

        // Convert PCM to AudioBuffer
        const audioBuffer = this.pcmToAudioBuffer(pcmData)

        // Create source node
        const source = this.audioContext!.createBufferSource()
        source.buffer = audioBuffer
        source.connect(this.gainNode!)

        // Track current source for potential interruption
        this.currentSource = source

        // Resolve when audio finishes
        source.onended = () => {
          this.currentSource = null
          resolve()
        }

        // Start playback
        source.start()
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Stop current playback
   */
  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop()
      } catch {
        // Source may have already stopped
      }
      this.currentSource = null
    }
  }

  /**
   * Get current output volume (0-1)
   */
  getOutputVolume(): number {
    if (!this.analyser || !this.volumeData) {
      return 0
    }

    this.analyser.getByteFrequencyData(this.volumeData)

    // Calculate RMS volume
    let sum = 0
    for (let i = 0; i < this.volumeData.length; i++) {
      sum += this.volumeData[i] * this.volumeData[i]
    }
    const rms = Math.sqrt(sum / this.volumeData.length)

    // Normalize to 0-1 range
    return Math.min(1, rms / 128)
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume))
    }
  }

  /**
   * Check if initialized
   */
  get initialized(): boolean {
    return this.isInitialized
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stop()
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    this.analyser = null
    this.gainNode = null
    this.isInitialized = false
  }
}

// Singleton instance
let audioPlayerInstance: AudioPlayer | null = null

export function getAudioPlayer(): AudioPlayer {
  if (!audioPlayerInstance) {
    audioPlayerInstance = new AudioPlayer()
  }
  return audioPlayerInstance
}

export default AudioPlayer
