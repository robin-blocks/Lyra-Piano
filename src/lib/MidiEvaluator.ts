/**
 * MIDI Evaluator - Evaluates user's piano playing against expected patterns
 * Returns structured feedback for the AI agent to interpret
 */

import { MusicalPhrase, MidiEvent } from '@/hooks/useMidiCapture'
import { ExpectedPattern } from './patterns'

export interface EvaluationResult {
  /** Pattern that was evaluated against */
  patternId: string
  patternName: string
  patternType: string

  /** Overall score 0-100 */
  score: number

  /** Note accuracy */
  correctNotes: number[]
  missingNotes: number[]
  extraNotes: number[]
  outOfOrderNotes: number[]

  /** Statistics */
  totalExpectedNotes: number
  totalPlayedNotes: number
  accuracyPercent: number

  /** Timing score (0-100) if pattern has timing info */
  timingScore?: number

  /** Human-readable feedback summary */
  feedback: string

  /** Detailed feedback for the agent */
  details: string[]

  /** Whether the attempt was successful (score >= 70) */
  passed: boolean
}

/**
 * Extract unique note numbers played (noteOn events only)
 */
function extractPlayedNotes(phrase: MusicalPhrase): number[] {
  return phrase.notes
    .filter(e => e.type === 'noteOn')
    .map(e => e.midiNote)
}

/**
 * Extract played notes in order without duplicates from consecutive same notes
 */
function extractPlayedSequence(phrase: MusicalPhrase): number[] {
  const noteOnEvents = phrase.notes.filter(e => e.type === 'noteOn')
  const sequence: number[] = []

  for (const event of noteOnEvents) {
    // Add note if it's different from the last one (allows repeated notes with gap)
    if (sequence.length === 0 || sequence[sequence.length - 1] !== event.midiNote) {
      sequence.push(event.midiNote)
    }
  }

  return sequence
}

/**
 * Find the longest common subsequence length between two arrays
 */
function lcsLength(arr1: number[], arr2: number[]): number {
  const m = arr1.length
  const n = arr2.length
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1] === arr2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  return dp[m][n]
}

/**
 * Evaluate timing accuracy if pattern has timing hints
 */
function evaluateTiming(phrase: MusicalPhrase, pattern: ExpectedPattern): number | undefined {
  if (!pattern.timing || pattern.timing.length === 0) {
    return undefined
  }

  const noteOnEvents = phrase.notes.filter(e => e.type === 'noteOn')
  if (noteOnEvents.length < 2) return undefined

  // Calculate actual intervals between notes
  const actualIntervals: number[] = []
  for (let i = 1; i < noteOnEvents.length; i++) {
    actualIntervals.push(noteOnEvents[i].timestamp - noteOnEvents[i - 1].timestamp)
  }

  // Compare with expected intervals
  const expectedIntervals = pattern.timing.slice(0, actualIntervals.length)
  if (expectedIntervals.length === 0) return undefined

  let totalDeviation = 0
  const comparisons = Math.min(actualIntervals.length, expectedIntervals.length)

  for (let i = 0; i < comparisons; i++) {
    const expected = expectedIntervals[i]
    const actual = actualIntervals[i]
    // Calculate percentage deviation, cap at 100%
    const deviation = Math.min(Math.abs(actual - expected) / expected, 1)
    totalDeviation += deviation
  }

  const avgDeviation = totalDeviation / comparisons
  // Convert deviation to score (0% deviation = 100, 100% deviation = 0)
  return Math.round((1 - avgDeviation) * 100)
}

/**
 * Generate human-readable feedback based on evaluation
 */
function generateFeedback(result: Omit<EvaluationResult, 'feedback' | 'details'>): { feedback: string; details: string[] } {
  const details: string[] = []
  let feedback: string

  const { score, missingNotes, extraNotes, outOfOrderNotes, accuracyPercent, timingScore } = result

  // Overall assessment
  if (score >= 95) {
    feedback = 'Excellent! That was nearly perfect!'
  } else if (score >= 85) {
    feedback = 'Great job! Just a few small things to polish.'
  } else if (score >= 70) {
    feedback = 'Good effort! You\'re getting the hang of it.'
  } else if (score >= 50) {
    feedback = 'Nice try! Let\'s work on a few things.'
  } else {
    feedback = 'Keep practicing! Let me help you with this.'
  }

  // Specific feedback
  if (missingNotes.length > 0) {
    const noteNames = missingNotes.map(midiToNoteName).join(', ')
    details.push(`Missing notes: ${noteNames}`)
  }

  if (extraNotes.length > 0) {
    const noteNames = extraNotes.map(midiToNoteName).join(', ')
    details.push(`Extra notes played: ${noteNames}`)
  }

  if (outOfOrderNotes.length > 0) {
    details.push(`Some notes were played out of order`)
  }

  if (timingScore !== undefined) {
    if (timingScore >= 80) {
      details.push('Great timing!')
    } else if (timingScore >= 60) {
      details.push('Try to keep a steadier rhythm')
    } else {
      details.push('Work on playing with a consistent tempo')
    }
  }

  if (accuracyPercent === 100 && missingNotes.length === 0 && extraNotes.length === 0) {
    details.push('All the right notes!')
  }

  return { feedback, details }
}

/**
 * Convert MIDI note number to note name
 */
function midiToNoteName(midiNote: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const octave = Math.floor(midiNote / 12) - 1
  const noteName = noteNames[midiNote % 12]
  return `${noteName}${octave}`
}

/**
 * Main evaluation function
 * Evaluates a user's played phrase against an expected pattern
 */
export function evaluatePhrase(
  played: MusicalPhrase,
  expected: ExpectedPattern
): EvaluationResult {
  const playedNotes = extractPlayedNotes(played)
  const playedSequence = extractPlayedSequence(played)
  const expectedNotes = expected.notes

  // Find correct, missing, and extra notes
  const playedSet = new Set(playedNotes)
  const expectedSet = new Set(expectedNotes)

  const correctNotes = expectedNotes.filter(n => playedSet.has(n))
  const missingNotes = expectedNotes.filter(n => !playedSet.has(n))
  const extraNotes = playedNotes.filter(n => !expectedSet.has(n))

  // Check for out-of-order notes using LCS
  const lcs = lcsLength(playedSequence, expectedNotes)
  const orderScore = expectedNotes.length > 0 ? lcs / expectedNotes.length : 1

  // Determine which notes were out of order
  const outOfOrderNotes: number[] = []
  if (orderScore < 1) {
    // Find notes that broke the sequence
    let expectedIdx = 0
    for (const note of playedSequence) {
      if (expectedIdx < expectedNotes.length && note === expectedNotes[expectedIdx]) {
        expectedIdx++
      } else if (expectedSet.has(note)) {
        outOfOrderNotes.push(note)
      }
    }
  }

  // Calculate accuracy
  const accuracyPercent = expectedNotes.length > 0
    ? Math.round((correctNotes.length / expectedNotes.length) * 100)
    : 0

  // Evaluate timing
  const timingScore = evaluateTiming(played, expected)

  // Calculate overall score
  // Weights: Note accuracy (50%), Order (30%), Timing (20% if available, otherwise redistribute)
  let score: number
  if (timingScore !== undefined) {
    score = Math.round(
      (accuracyPercent * 0.5) +
      (orderScore * 100 * 0.3) +
      (timingScore * 0.2)
    )
  } else {
    score = Math.round(
      (accuracyPercent * 0.6) +
      (orderScore * 100 * 0.4)
    )
  }

  // Penalty for extra notes
  const extraPenalty = Math.min(extraNotes.length * 5, 20)
  score = Math.max(0, score - extraPenalty)

  // Build base result
  const baseResult = {
    patternId: expected.id,
    patternName: expected.name,
    patternType: expected.type,
    score,
    correctNotes,
    missingNotes,
    extraNotes,
    outOfOrderNotes,
    totalExpectedNotes: expectedNotes.length,
    totalPlayedNotes: playedNotes.length,
    accuracyPercent,
    timingScore,
    passed: score >= 70,
  }

  // Generate feedback
  const { feedback, details } = generateFeedback(baseResult)

  return {
    ...baseResult,
    feedback,
    details,
  }
}

/**
 * Quick evaluation for chords (order doesn't matter, timing doesn't matter)
 */
export function evaluateChord(
  played: MusicalPhrase,
  expected: ExpectedPattern
): EvaluationResult {
  const playedNotes = new Set(extractPlayedNotes(played))
  const expectedNotes = expected.notes

  const correctNotes = expectedNotes.filter(n => playedNotes.has(n))
  const missingNotes = expectedNotes.filter(n => !playedNotes.has(n))
  const extraNotes = [...playedNotes].filter(n => !expectedNotes.includes(n))

  const accuracyPercent = Math.round((correctNotes.length / expectedNotes.length) * 100)

  // For chords, score is just accuracy minus extra note penalty
  const extraPenalty = Math.min(extraNotes.length * 10, 30)
  const score = Math.max(0, accuracyPercent - extraPenalty)

  const baseResult = {
    patternId: expected.id,
    patternName: expected.name,
    patternType: expected.type,
    score,
    correctNotes,
    missingNotes,
    extraNotes,
    outOfOrderNotes: [], // Order doesn't matter for chords
    totalExpectedNotes: expectedNotes.length,
    totalPlayedNotes: playedNotes.size,
    accuracyPercent,
    timingScore: undefined,
    passed: score >= 70,
  }

  const { feedback, details } = generateFeedback(baseResult)

  return {
    ...baseResult,
    feedback,
    details,
  }
}

/**
 * Auto-detect pattern type and use appropriate evaluation
 */
export function evaluate(
  played: MusicalPhrase,
  expected: ExpectedPattern
): EvaluationResult {
  if (expected.type === 'chord') {
    return evaluateChord(played, expected)
  }
  return evaluatePhrase(played, expected)
}

export default { evaluate, evaluatePhrase, evaluateChord }
