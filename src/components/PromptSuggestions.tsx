'use client'

import { useState, useEffect } from 'react'

export interface Suggestion {
  title: string
  prompt: string
}

interface PromptSuggestionsProps {
  suggestions: Suggestion[]
  visible: boolean
}

export const DEFAULT_SUGGESTIONS: Suggestion[] = [
  {
    title: 'Teach me a Chord',
    prompt: 'Teach me how to play an A minor chord',
  },
  {
    title: 'Teach me a Scale',
    prompt: 'Teach me to play a C Major scale',
  },
  {
    title: 'Teach me a Song',
    prompt: 'Teach me how to play a simple song',
  },
  {
    title: 'What Chord is This?',
    prompt: 'What chord is this?',
  },
]

// Randomly pick n items from an array
function pickRandom<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

export function PromptSuggestions({ suggestions, visible }: PromptSuggestionsProps) {
  // Start with first 3 for SSR consistency, then randomize on client
  const [displaySuggestions, setDisplaySuggestions] = useState(() =>
    suggestions.slice(0, 3)
  )

  // Randomize on mount and when suggestions change
  useEffect(() => {
    setDisplaySuggestions(pickRandom(suggestions, 3))
  }, [suggestions])
  return (
    <div
      className={`
        hidden md:flex gap-4 w-full max-w-[1184px] px-4
        transition-all duration-300 ease-in-out
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}
      `}
    >
      {displaySuggestions.map((suggestion, index) => (
        <div
          key={index}
          className="
            flex-1 bg-lyra-surface/50 border border-lyra-accent/20
            rounded-xl p-4 md:p-5
            transition-colors duration-200
            hover:bg-lyra-surface/70 hover:border-lyra-accent/30
          "
        >
          <h3 className="text-lyra-text font-semibold text-base md:text-lg mb-2">
            {suggestion.title}
          </h3>
          <p className="text-lyra-muted text-sm md:text-base leading-relaxed">
            {suggestion.prompt}
          </p>
        </div>
      ))}
    </div>
  )
}

export default PromptSuggestions
