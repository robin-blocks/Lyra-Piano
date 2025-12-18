'use client'

import { useState, useCallback } from 'react'
import { Orb } from '@/components/ui/orb'
import { cn } from '@/lib/utils'

type AgentState = 'idle' | 'listening' | 'talking' | null
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'disconnecting'

interface LyraOrbProps {
  status: ConnectionStatus
  agentState: AgentState
  onConnect: () => void
  onDisconnect: () => void
  getInputVolume?: () => number
  getOutputVolume?: () => number
  message?: string
}

export function LyraOrb({
  status,
  agentState,
  onConnect,
  onDisconnect,
  getInputVolume,
  getOutputVolume,
  message,
}: LyraOrbProps) {
  const [isHovered, setIsHovered] = useState(false)

  const handleClick = useCallback(() => {
    if (status === 'connected') {
      onDisconnect()
    } else if (status === 'disconnected') {
      onConnect()
    }
  }, [status, onConnect, onDisconnect])

  const isConnected = status === 'connected'
  const isConnecting = status === 'connecting'
  const isDisconnecting = status === 'disconnecting'

  return (
    <div className="flex flex-col items-center gap-6 overflow-visible">
      {/* Orb container with transition */}
      <div
        className={cn(
          'relative cursor-pointer transition-all duration-500 ease-out overflow-visible',
          isConnected ? 'w-48 h-48 md:w-64 md:h-64' : 'w-32 h-32 md:w-40 md:h-40',
        )}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Animated gradient glow behind orb */}
        <div
          className="absolute inset-0 -z-10 rounded-full"
          style={{
            filter: 'blur(40px)',
            background: 'linear-gradient(90deg, #C4B5FD, #A78BFA, #DDD6FE, #C4B5FD)',
            backgroundSize: '300% 300%',
            animation: 'animateGlow 24s ease-in-out infinite',
          }}
        />

        {/* Connect button (shown when disconnected) */}
        {!isConnected && !isConnecting && (
          <div
            className={cn(
              'absolute inset-0 rounded-full flex items-center justify-center',
              'bg-gradient-to-br from-lyra-orb-1/20 to-lyra-orb-2/20',
              'border-2 border-lyra-orb-1/40',
              'transition-all duration-300',
              isHovered && 'border-lyra-orb-1/60 scale-105',
            )}
          >
            <span className="text-lyra-text font-semibold text-lg md:text-xl tracking-wide">
              Connect
            </span>
          </div>
        )}

        {/* Connecting/Disconnecting state */}
        {(isConnecting || isDisconnecting) && (
          <div className="absolute inset-0 rounded-full flex items-center justify-center bg-gradient-to-br from-lyra-orb-1/20 to-lyra-orb-2/20 border-2 border-lyra-orb-1/40">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-lyra-orb-1 animate-pulse" />
              <span className="text-lyra-text font-medium">
                {isConnecting ? 'Connecting...' : 'Disconnecting...'}
              </span>
            </div>
          </div>
        )}

        {/* Orb (shown when connected) */}
        {isConnected && (
          <div className="absolute -inset-8 transition-opacity duration-500 opacity-100 overflow-visible">
            <Orb
              agentState={agentState}
              getInputVolume={getInputVolume}
              getOutputVolume={getOutputVolume}
              colors={['#DDD6FE', '#C4B5FD', '#F5F3FF']}
            />
          </div>
        )}
      </div>

      {/* Message display */}
      <div className="h-8 flex items-center justify-center">
        {message && (
          <p className="text-lyra-muted text-sm md:text-base animate-fade-in">
            {message}
          </p>
        )}
        {isConnected && !message && (
          <p className="text-lyra-muted text-sm md:text-base">
            {agentState === 'listening' && "I'm listening..."}
            {agentState === 'talking' && "Speaking..."}
            {agentState === 'idle' && "Ready to help"}
            {!agentState && "Hello! I'm ready to play."}
          </p>
        )}
      </div>

      {/* Disconnect hint when connected */}
      {isConnected && (
        <button
          onClick={onDisconnect}
          className="text-lyra-muted/60 text-xs hover:text-lyra-muted transition-colors"
        >
          Click orb to disconnect
        </button>
      )}
    </div>
  )
}

export default LyraOrb
