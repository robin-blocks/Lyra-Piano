/**
 * ElevenLabs Conversational AI WebSocket Types
 * Based on the AsyncAPI specification
 */

// =============================================================================
// Server → Client Events
// =============================================================================

export interface AudioEvent {
  type: 'audio'
  audio_event: {
    audio_base_64: string
    event_id: number
  }
}

export interface ClientToolCallEvent {
  type: 'client_tool_call'
  client_tool_call: {
    tool_name: string
    tool_call_id: string
    parameters: Record<string, unknown>
  }
}

export interface AgentResponseEvent {
  type: 'agent_response'
  agent_response_event: {
    agent_response: string
  }
}

export interface UserTranscriptEvent {
  type: 'user_transcript'
  user_transcription_event: {
    user_transcript: string
  }
}

export interface InterruptionEvent {
  type: 'interruption'
  interruption_event: {
    event_id: number
  }
}

export interface PingEvent {
  type: 'ping'
  ping_event: {
    event_id: number
  }
}

export interface ConversationInitiationMetadataEvent {
  type: 'conversation_initiation_metadata'
  conversation_initiation_metadata_event: {
    conversation_id: string
    agent_output_audio_format: string
  }
}

export type ServerEvent =
  | AudioEvent
  | ClientToolCallEvent
  | AgentResponseEvent
  | UserTranscriptEvent
  | InterruptionEvent
  | PingEvent
  | ConversationInitiationMetadataEvent

// =============================================================================
// Client → Server Events
// =============================================================================

export interface UserAudioChunkMessage {
  user_audio_chunk: string // base64 encoded PCM audio
}

export interface ClientToolResultMessage {
  type: 'client_tool_result'
  tool_call_id: string
  result: string
  is_error: boolean
}

export interface PongMessage {
  type: 'pong'
  event_id: number
}

export interface ConversationInitiationClientData {
  type: 'conversation_initiation_client_data'
  conversation_initiation_client_data: {
    conversation_config_override?: {
      agent?: {
        prompt?: {
          prompt?: string
        }
        first_message?: string
        language?: string
      }
      tts?: {
        voice_id?: string
      }
    }
    custom_llm_extra_body?: Record<string, unknown>
    dynamic_variables?: Record<string, string>
  }
}

export type ClientMessage =
  | UserAudioChunkMessage
  | ClientToolResultMessage
  | PongMessage
  | ConversationInitiationClientData

// =============================================================================
// Queue Types for Sequential Processing
// =============================================================================

export type QueueItem =
  | { type: 'audio'; audioBase64: string; eventId: number }
  | { type: 'action'; callback: () => Promise<void>; description: string }

export interface ToolQueueItem {
  toolName: string
  toolCallId: string
  parameters: Record<string, unknown>
}

// =============================================================================
// Hook Types
// =============================================================================

export type AgentState = 'idle' | 'listening' | 'speaking' | null
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'disconnecting'

export interface ToolContext {
  queueAction: (callback: () => Promise<void>, description: string) => void
}

export type ToolHandler = (
  parameters: Record<string, unknown>,
  context: ToolContext
) => Promise<string | object> | string | object

export interface AgentWebSocketConfig {
  agentId: string
  onStatusChange?: (status: ConnectionStatus) => void
  onAgentStateChange?: (state: AgentState) => void
  onUserTranscript?: (transcript: string) => void
  onAgentResponse?: (response: string) => void
  onError?: (error: Error) => void
}

export interface AgentWebSocketReturn {
  connect: () => Promise<void>
  disconnect: () => void
  status: ConnectionStatus
  agentState: AgentState
  getInputVolume: () => number
  getOutputVolume: () => number
}
