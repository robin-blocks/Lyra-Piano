/**
 * Musical patterns library for Lyra piano lessons
 * All notes are MIDI note numbers (C4 = 60)
 */

export type PatternType = 'scale' | 'chord' | 'arpeggio' | 'melody'

export interface ExpectedPattern {
  id: string
  name: string
  description: string
  notes: number[] // MIDI note numbers in order
  type: PatternType
  /** Timing hints for demonstration (milliseconds between notes) */
  timing?: number[]
  /** Difficulty level 1-5 */
  difficulty: number
}

// Helper to generate scale notes
function generateScale(root: number, intervals: number[], octaves: number = 1): number[] {
  const notes: number[] = []
  for (let oct = 0; oct < octaves; oct++) {
    for (const interval of intervals) {
      notes.push(root + oct * 12 + interval)
    }
  }
  // Add the final note of the scale
  notes.push(root + octaves * 12)
  return notes
}

// Scale intervals
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11]
const MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10]
const PENTATONIC_MAJOR_INTERVALS = [0, 2, 4, 7, 9]
const PENTATONIC_MINOR_INTERVALS = [0, 3, 5, 7, 10]
const CHROMATIC_INTERVALS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

// Chord intervals from root
const MAJOR_CHORD = [0, 4, 7]
const MINOR_CHORD = [0, 3, 7]
const DIMINISHED_CHORD = [0, 3, 6]
const AUGMENTED_CHORD = [0, 4, 8]
const MAJOR_SEVENTH = [0, 4, 7, 11]
const MINOR_SEVENTH = [0, 3, 7, 10]
const DOMINANT_SEVENTH = [0, 4, 7, 10]

/**
 * Pre-defined musical patterns organized by category
 */
export const PATTERNS: Record<string, ExpectedPattern> = {
  // ============= SCALES =============

  // C Major Scale (most common starting point)
  C_MAJOR_SCALE: {
    id: 'C_MAJOR_SCALE',
    name: 'C Major Scale',
    description: 'The foundational scale with all white keys',
    notes: generateScale(60, MAJOR_SCALE_INTERVALS, 1), // C4 to C5
    type: 'scale',
    timing: [300, 300, 300, 300, 300, 300, 300, 300],
    difficulty: 1,
  },

  C_MAJOR_SCALE_2_OCTAVES: {
    id: 'C_MAJOR_SCALE_2_OCTAVES',
    name: 'C Major Scale (2 Octaves)',
    description: 'C Major scale spanning two octaves',
    notes: generateScale(60, MAJOR_SCALE_INTERVALS, 2),
    type: 'scale',
    difficulty: 2,
  },

  G_MAJOR_SCALE: {
    id: 'G_MAJOR_SCALE',
    name: 'G Major Scale',
    description: 'Major scale starting on G with one sharp (F#)',
    notes: generateScale(55, MAJOR_SCALE_INTERVALS, 1), // G3 to G4
    type: 'scale',
    difficulty: 2,
  },

  D_MAJOR_SCALE: {
    id: 'D_MAJOR_SCALE',
    name: 'D Major Scale',
    description: 'Major scale starting on D with two sharps',
    notes: generateScale(62, MAJOR_SCALE_INTERVALS, 1), // D4 to D5
    type: 'scale',
    difficulty: 2,
  },

  F_MAJOR_SCALE: {
    id: 'F_MAJOR_SCALE',
    name: 'F Major Scale',
    description: 'Major scale starting on F with one flat',
    notes: generateScale(53, MAJOR_SCALE_INTERVALS, 1), // F3 to F4
    type: 'scale',
    difficulty: 2,
  },

  A_MINOR_SCALE: {
    id: 'A_MINOR_SCALE',
    name: 'A Natural Minor Scale',
    description: 'The relative minor of C major - all white keys',
    notes: generateScale(57, MINOR_SCALE_INTERVALS, 1), // A3 to A4
    type: 'scale',
    difficulty: 1,
  },

  C_PENTATONIC: {
    id: 'C_PENTATONIC',
    name: 'C Major Pentatonic',
    description: 'Five-note scale great for improvisation',
    notes: [...generateScale(60, PENTATONIC_MAJOR_INTERVALS, 1).slice(0, -1), 72],
    type: 'scale',
    difficulty: 1,
  },

  A_MINOR_PENTATONIC: {
    id: 'A_MINOR_PENTATONIC',
    name: 'A Minor Pentatonic',
    description: 'Classic blues/rock scale',
    notes: [...generateScale(57, PENTATONIC_MINOR_INTERVALS, 1).slice(0, -1), 69],
    type: 'scale',
    difficulty: 1,
  },

  CHROMATIC_C: {
    id: 'CHROMATIC_C',
    name: 'Chromatic Scale from C',
    description: 'All 12 notes - great for finger exercises',
    notes: generateScale(60, CHROMATIC_INTERVALS, 1),
    type: 'scale',
    difficulty: 3,
  },

  // ============= CHORDS =============

  C_MAJOR_CHORD: {
    id: 'C_MAJOR_CHORD',
    name: 'C Major Chord',
    description: 'C-E-G: The most basic major chord',
    notes: [60, 64, 67], // C-E-G
    type: 'chord',
    difficulty: 1,
  },

  C_MAJOR_CHORD_INVERSIONS: {
    id: 'C_MAJOR_CHORD_INVERSIONS',
    name: 'C Major Chord Inversions',
    description: 'Root position, 1st inversion, 2nd inversion',
    notes: [60, 64, 67, 64, 67, 72, 67, 72, 76], // Root, 1st inv, 2nd inv
    type: 'chord',
    difficulty: 2,
  },

  G_MAJOR_CHORD: {
    id: 'G_MAJOR_CHORD',
    name: 'G Major Chord',
    description: 'G-B-D: Common chord in many songs',
    notes: [55, 59, 62], // G-B-D
    type: 'chord',
    difficulty: 1,
  },

  F_MAJOR_CHORD: {
    id: 'F_MAJOR_CHORD',
    name: 'F Major Chord',
    description: 'F-A-C: Another essential chord',
    notes: [53, 57, 60], // F-A-C
    type: 'chord',
    difficulty: 1,
  },

  A_MINOR_CHORD: {
    id: 'A_MINOR_CHORD',
    name: 'A Minor Chord',
    description: 'A-C-E: Basic minor chord',
    notes: [57, 60, 64], // A-C-E
    type: 'chord',
    difficulty: 1,
  },

  D_MINOR_CHORD: {
    id: 'D_MINOR_CHORD',
    name: 'D Minor Chord',
    description: 'D-F-A: Beautiful minor chord',
    notes: [62, 65, 69], // D-F-A
    type: 'chord',
    difficulty: 1,
  },

  E_MINOR_CHORD: {
    id: 'E_MINOR_CHORD',
    name: 'E Minor Chord',
    description: 'E-G-B: Common in pop and rock',
    notes: [52, 55, 59], // E-G-B
    type: 'chord',
    difficulty: 1,
  },

  C_MAJOR_7: {
    id: 'C_MAJOR_7',
    name: 'C Major 7th Chord',
    description: 'C-E-G-B: Jazz voicing',
    notes: [60, 64, 67, 71],
    type: 'chord',
    difficulty: 2,
  },

  G7_CHORD: {
    id: 'G7_CHORD',
    name: 'G Dominant 7th',
    description: 'G-B-D-F: Resolves to C major',
    notes: [55, 59, 62, 65],
    type: 'chord',
    difficulty: 2,
  },

  // ============= ARPEGGIOS =============

  C_MAJOR_ARPEGGIO: {
    id: 'C_MAJOR_ARPEGGIO',
    name: 'C Major Arpeggio',
    description: 'Play C-E-G-C one note at a time',
    notes: [60, 64, 67, 72], // C-E-G-C
    type: 'arpeggio',
    timing: [400, 400, 400, 400],
    difficulty: 1,
  },

  A_MINOR_ARPEGGIO: {
    id: 'A_MINOR_ARPEGGIO',
    name: 'A Minor Arpeggio',
    description: 'Play A-C-E-A one note at a time',
    notes: [57, 60, 64, 69], // A-C-E-A
    type: 'arpeggio',
    timing: [400, 400, 400, 400],
    difficulty: 1,
  },

  C_MAJOR_ARPEGGIO_2_OCTAVES: {
    id: 'C_MAJOR_ARPEGGIO_2_OCTAVES',
    name: 'C Major Arpeggio (2 Octaves)',
    description: 'Extended arpeggio pattern',
    notes: [60, 64, 67, 72, 76, 79, 84],
    type: 'arpeggio',
    difficulty: 2,
  },

  // ============= CHORD PROGRESSIONS =============

  I_IV_V_I_C: {
    id: 'I_IV_V_I_C',
    name: 'I-IV-V-I in C',
    description: 'Classic chord progression: C-F-G-C',
    notes: [
      60, 64, 67, // C
      53, 57, 60, // F
      55, 59, 62, // G
      60, 64, 67, // C
    ],
    type: 'chord',
    timing: [0, 0, 800, 0, 0, 800, 0, 0, 800, 0, 0, 800],
    difficulty: 2,
  },

  I_V_vi_IV_C: {
    id: 'I_V_vi_IV_C',
    name: 'I-V-vi-IV in C (Pop Progression)',
    description: 'The most popular chord progression: C-G-Am-F',
    notes: [
      60, 64, 67, // C
      55, 59, 62, // G
      57, 60, 64, // Am
      53, 57, 60, // F
    ],
    type: 'chord',
    difficulty: 2,
  },

  // ============= SIMPLE MELODIES =============

  MARY_HAD_A_LITTLE_LAMB: {
    id: 'MARY_HAD_A_LITTLE_LAMB',
    name: 'Mary Had a Little Lamb',
    description: 'Classic beginner melody',
    notes: [64, 62, 60, 62, 64, 64, 64, 62, 62, 62, 64, 67, 67], // E-D-C-D-E-E-E...
    type: 'melody',
    timing: [400, 400, 400, 400, 400, 400, 800, 400, 400, 800, 400, 400, 800],
    difficulty: 1,
  },

  TWINKLE_TWINKLE: {
    id: 'TWINKLE_TWINKLE',
    name: 'Twinkle Twinkle (First Line)',
    description: 'First line of Twinkle Twinkle Little Star',
    notes: [60, 60, 67, 67, 69, 69, 67], // C-C-G-G-A-A-G
    type: 'melody',
    timing: [400, 400, 400, 400, 400, 400, 800],
    difficulty: 1,
  },

  ODE_TO_JOY: {
    id: 'ODE_TO_JOY',
    name: 'Ode to Joy (Theme)',
    description: 'Beethoven\'s famous melody',
    notes: [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62],
    type: 'melody',
    timing: [400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 600, 200, 800],
    difficulty: 2,
  },

  // ============= FINGER EXERCISES =============

  FIVE_FINGER_C: {
    id: 'FIVE_FINGER_C',
    name: 'Five-Finger Pattern in C',
    description: 'C-D-E-F-G and back down',
    notes: [60, 62, 64, 65, 67, 65, 64, 62, 60],
    type: 'scale',
    timing: [300, 300, 300, 300, 300, 300, 300, 300, 300],
    difficulty: 1,
  },

  HANON_1: {
    id: 'HANON_1',
    name: 'Hanon Exercise #1',
    description: 'Classic finger independence exercise',
    notes: [60, 62, 64, 65, 67, 65, 64, 62], // Simplified version
    type: 'scale',
    difficulty: 2,
  },
}

/**
 * Get patterns by type
 */
export function getPatternsByType(type: PatternType): ExpectedPattern[] {
  return Object.values(PATTERNS).filter(p => p.type === type)
}

/**
 * Get patterns by difficulty level
 */
export function getPatternsByDifficulty(maxDifficulty: number): ExpectedPattern[] {
  return Object.values(PATTERNS).filter(p => p.difficulty <= maxDifficulty)
}

/**
 * Get beginner-friendly patterns
 */
export function getBeginnerPatterns(): ExpectedPattern[] {
  return getPatternsByDifficulty(1)
}

/**
 * Get pattern by ID
 */
export function getPatternById(id: string): ExpectedPattern | undefined {
  return PATTERNS[id]
}

/**
 * Search patterns by name (case-insensitive)
 */
export function searchPatterns(query: string): ExpectedPattern[] {
  const lowerQuery = query.toLowerCase()
  return Object.values(PATTERNS).filter(p =>
    p.name.toLowerCase().includes(lowerQuery) ||
    p.description.toLowerCase().includes(lowerQuery)
  )
}

export default PATTERNS
