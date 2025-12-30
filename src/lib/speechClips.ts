/**
 * Speech Clips Library
 * Loads, caches, and concatenates pre-generated speech WAV files
 * for injecting piano note information into the ElevenLabs audio stream.
 */

// Cache for loaded PCM data
const clipCache: Map<string, Int16Array> = new Map()

/**
 * Parse a WAV file buffer and extract the PCM data as Int16Array.
 * Expects 16-bit PCM WAV format.
 */
function parseWavToPCM(buffer: ArrayBuffer): Int16Array {
  const view = new DataView(buffer)

  // Verify RIFF header
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))
  if (riff !== 'RIFF') {
    throw new Error('Invalid WAV file: missing RIFF header')
  }

  // Verify WAVE format
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))
  if (wave !== 'WAVE') {
    throw new Error('Invalid WAV file: missing WAVE format')
  }

  // Find the data chunk
  let offset = 12
  while (offset < buffer.byteLength - 8) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    )
    const chunkSize = view.getUint32(offset + 4, true) // little-endian

    if (chunkId === 'data') {
      // Found the data chunk - extract PCM samples
      const dataStart = offset + 8
      const dataLength = chunkSize

      // Create Int16Array view of the PCM data
      // Note: We need to handle alignment, so copy to a new buffer
      const pcmBuffer = new ArrayBuffer(dataLength)
      const pcmView = new Uint8Array(pcmBuffer)
      const sourceView = new Uint8Array(buffer, dataStart, dataLength)
      pcmView.set(sourceView)

      return new Int16Array(pcmBuffer)
    }

    offset += 8 + chunkSize
    // Ensure word alignment
    if (chunkSize % 2 !== 0) offset++
  }

  throw new Error('Invalid WAV file: data chunk not found')
}

/**
 * Load a speech clip by name. Returns cached version if available.
 * @param clipName - Name of the clip without extension (e.g., "c4", "c-sharp-4", "chord")
 */
export async function loadClip(clipName: string): Promise<Int16Array> {
  // Check cache first
  if (clipCache.has(clipName)) {
    return clipCache.get(clipName)!
  }

  // Fetch the WAV file
  const response = await fetch(`/speech/${clipName}.wav`)
  if (!response.ok) {
    throw new Error(`Failed to load clip: ${clipName} (${response.status})`)
  }

  const buffer = await response.arrayBuffer()
  const pcm = parseWavToPCM(buffer)

  // Cache for future use
  clipCache.set(clipName, pcm)

  return pcm
}

// Trailing silence in samples (at 16kHz) to prevent last word from being cut off
const TRAILING_SILENCE_SAMPLES = 12800 // 800ms

/**
 * Load multiple clips and concatenate them into a single PCM buffer.
 * Adds trailing silence to prevent the last word from being cut off by VAD.
 * @param clipNames - Array of clip names to concatenate
 */
export async function loadAndConcatenateClips(clipNames: string[]): Promise<Int16Array> {
  if (clipNames.length === 0) {
    return new Int16Array(0)
  }

  // Load all clips in parallel
  const clips = await Promise.all(clipNames.map(name => loadClip(name)))

  // Calculate total length including trailing silence
  const clipsLength = clips.reduce((sum, clip) => sum + clip.length, 0)
  const totalLength = clipsLength + TRAILING_SILENCE_SAMPLES

  // Create output buffer and copy clips (trailing silence is already zeros)
  const result = new Int16Array(totalLength)
  let offset = 0

  for (const clip of clips) {
    result.set(clip, offset)
    offset += clip.length
  }

  return result
}

/**
 * Convert MIDI note number to clip name.
 * Uses sharps only (C#, not Db).
 * @param midi - MIDI note number (0-127)
 */
export function midiToClipName(midi: number): string {
  const noteNames = [
    'c', 'c-sharp', 'd', 'd-sharp', 'e', 'f',
    'f-sharp', 'g', 'g-sharp', 'a', 'a-sharp', 'b'
  ]
  const octave = Math.floor(midi / 12) - 1
  const noteIndex = midi % 12
  return `${noteNames[noteIndex]}${octave}`
}

/**
 * Preload all clips for the full 88-key piano range (A0 to C8).
 * Call this on app init for faster response times.
 */
export async function preloadClips(): Promise<void> {
  const clipNames: string[] = ['chord']

  const noteNames = [
    'c', 'c-sharp', 'd', 'd-sharp', 'e', 'f',
    'f-sharp', 'g', 'g-sharp', 'a', 'a-sharp', 'b'
  ]

  // Octave 0: Only A, A#, B (piano starts at A0)
  clipNames.push('a0', 'a-sharp0', 'b0')

  // Octaves 1-7: All 12 notes
  for (let octave = 1; octave <= 7; octave++) {
    for (const note of noteNames) {
      clipNames.push(`${note}${octave}`)
    }
  }

  // Octave 8: Only C (piano ends at C8)
  clipNames.push('c8')

  // Load all in parallel
  await Promise.all(clipNames.map(name => loadClip(name).catch(err => {
    console.warn(`Failed to preload clip ${name}:`, err)
  })))

  console.log(`[SpeechClips] Preloaded ${clipCache.size} clips`)
}

/**
 * Clear the clip cache (useful for testing or memory management)
 */
export function clearClipCache(): void {
  clipCache.clear()
}
