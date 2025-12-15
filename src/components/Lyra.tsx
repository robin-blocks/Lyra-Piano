'use client'

import { useState, useCallback, useEffect } from 'react'
import { useConversation } from '@elevenlabs/react'
import { LyraOrb } from '@/components/LyraOrb'

// Environment variable for agent ID - will be set in .env.local
const AGENT_ID = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID

type AgentState = 'idle' | 'listening' | 'talking' | null

export function Lyra() {
  const [agentState, setAgentState] = useState<AgentState>(null)
  const [message, setMessage] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to Lyra')
      setMessage("Hello! I'm ready to play.")
      setAgentState('idle')
    },
    onDisconnect: () => {
      console.log('Disconnected from Lyra')
      setAgentState(null)
      setMessage('')
    },
    onMessage: (messagePayload) => {
      console.log('Message received:', messagePayload)
      // Messages contain transcript data - could be used for display
    },
    onModeChange: (mode) => {
      console.log('Mode changed:', mode)
      if (mode.mode === 'speaking') {
        setAgentState('talking')
      } else if (mode.mode === 'listening') {
        setAgentState('listening')
      } else {
        setAgentState('idle')
      }
    },
    onError: (error) => {
      console.error('Conversation error:', error)
      setError('Connection error. Please try again.')
    },
  })

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const handleConnect = useCallback(async () => {
    if (!AGENT_ID) {
      setError('Agent ID not configured. Please set NEXT_PUBLIC_ELEVENLABS_AGENT_ID in .env.local')
      return
    }

    try {
      setMessage('Connecting...')
      await conversation.startSession({
        agentId: AGENT_ID,
        connectionType: 'websocket',
      })
    } catch (err) {
      console.error('Failed to connect:', err)
      setError('Failed to connect. Please check your configuration.')
    }
  }, [conversation])

  const handleDisconnect = useCallback(async () => {
    try {
      await conversation.endSession()
    } catch (err) {
      console.error('Failed to disconnect:', err)
    }
  }, [conversation])

  // Get volume levels for Orb audio reactivity
  const getInputVolume = useCallback(() => {
    return conversation.getInputVolume?.() ?? 0
  }, [conversation])

  const getOutputVolume = useCallback(() => {
    return conversation.getOutputVolume?.() ?? 0
  }, [conversation])

  return (
    <div className="flex-1 flex flex-col items-center justify-between py-8 px-4">
      {/* Header */}
      <header className="w-full max-w-4xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lyra-orb-1 font-bold text-xl">Lyra</span>
        </div>
        <nav>
          <button className="p-2 hover:bg-lyra-surface rounded-lg transition-colors">
            <svg
              className="w-6 h-6 text-lyra-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center gap-8 w-full max-w-4xl">
        {/* Headline */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-5xl font-bold text-lyra-text">
            Play piano with Lyra.
          </h1>
          <p className="text-lyra-muted text-lg md:text-xl">
            Your AI companion for mastering the keys.
          </p>
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-red-400">
            {error}
          </div>
        )}

        {/* Orb */}
        <LyraOrb
          status={conversation.status}
          agentState={agentState}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          getInputVolume={getInputVolume}
          getOutputVolume={getOutputVolume}
          message={message}
        />
      </main>

      {/* Piano placeholder (will be implemented in Phase 2) */}
      <footer className="w-full">
        <div className="h-32 md:h-40 bg-lyra-surface/50 rounded-t-xl flex items-center justify-center border-t border-lyra-accent/20">
          <p className="text-lyra-muted text-sm">
            Piano keyboard coming soon...
          </p>
        </div>
      </footer>
    </div>
  )
}

export default Lyra
