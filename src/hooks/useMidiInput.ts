'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export interface MidiDevice {
  id: string
  name: string
  manufacturer: string
}

interface UseMidiInputOptions {
  /** Callback when a note is pressed */
  onNoteOn?: (midiNote: number, velocity: number) => void
  /** Callback when a note is released */
  onNoteOff?: (midiNote: number) => void
  /** Callback when sustain pedal changes */
  onSustain?: (active: boolean) => void
  /** Auto-connect to first available device */
  autoConnect?: boolean
}

interface UseMidiInputReturn {
  /** Whether Web MIDI is supported */
  isSupported: boolean
  /** Whether MIDI access has been granted */
  hasAccess: boolean
  /** List of available MIDI input devices */
  devices: MidiDevice[]
  /** Currently connected device */
  connectedDevice: MidiDevice | null
  /** Request MIDI access from browser */
  requestAccess: () => Promise<boolean>
  /** Connect to a specific device */
  connectDevice: (deviceId: string) => void
  /** Disconnect from current device */
  disconnect: () => void
  /** Error message if any */
  error: string | null
}

/**
 * Hook for handling MIDI input from hardware devices
 */
export function useMidiInput(options: UseMidiInputOptions = {}): UseMidiInputReturn {
  const { onNoteOn, onNoteOff, onSustain, autoConnect = true } = options

  const [isSupported] = useState(() => typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator)
  const [hasAccess, setHasAccess] = useState(false)
  const [devices, setDevices] = useState<MidiDevice[]>([])
  const [connectedDevice, setConnectedDevice] = useState<MidiDevice | null>(null)
  const [error, setError] = useState<string | null>(null)

  const midiAccessRef = useRef<MIDIAccess | null>(null)
  const connectedInputRef = useRef<MIDIInput | null>(null)

  // Store callbacks in refs to avoid re-subscribing on every render
  const callbacksRef = useRef({ onNoteOn, onNoteOff, onSustain })
  useEffect(() => {
    callbacksRef.current = { onNoteOn, onNoteOff, onSustain }
  }, [onNoteOn, onNoteOff, onSustain])

  // Handle MIDI messages
  const handleMidiMessage = useCallback((event: MIDIMessageEvent) => {
    const [status, data1, data2] = event.data || []

    // Extract message type (high nibble) and channel (low nibble)
    const messageType = status & 0xf0
    // const channel = status & 0x0f

    switch (messageType) {
      case 0x90: // Note On
        if (data2 > 0) {
          callbacksRef.current.onNoteOn?.(data1, data2)
        } else {
          // Note On with velocity 0 is treated as Note Off
          callbacksRef.current.onNoteOff?.(data1)
        }
        break

      case 0x80: // Note Off
        callbacksRef.current.onNoteOff?.(data1)
        break

      case 0xb0: // Control Change
        if (data1 === 64) {
          // Sustain pedal (CC 64)
          callbacksRef.current.onSustain?.(data2 >= 64)
        }
        break
    }
  }, [])

  // Update device list from MIDI access
  const updateDevices = useCallback(() => {
    if (!midiAccessRef.current) return

    const inputDevices: MidiDevice[] = []
    midiAccessRef.current.inputs.forEach((input) => {
      inputDevices.push({
        id: input.id,
        name: input.name || 'Unknown Device',
        manufacturer: input.manufacturer || 'Unknown',
      })
    })
    setDevices(inputDevices)

    // Auto-connect to first device if enabled and not already connected
    if (autoConnect && inputDevices.length > 0 && !connectedInputRef.current) {
      const firstDevice = inputDevices[0]
      connectToDevice(firstDevice.id)
    }
  }, [autoConnect])

  // Connect to a specific device
  const connectToDevice = useCallback((deviceId: string) => {
    if (!midiAccessRef.current) return

    // Disconnect from current device
    if (connectedInputRef.current) {
      connectedInputRef.current.onmidimessage = null
      connectedInputRef.current = null
      setConnectedDevice(null)
    }

    // Find and connect to new device
    const input = midiAccessRef.current.inputs.get(deviceId)
    if (input) {
      input.onmidimessage = handleMidiMessage
      connectedInputRef.current = input
      setConnectedDevice({
        id: input.id,
        name: input.name || 'Unknown Device',
        manufacturer: input.manufacturer || 'Unknown',
      })
      console.log(`MIDI: Connected to ${input.name}`)
    }
  }, [handleMidiMessage])

  // Request MIDI access
  const requestAccess = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Web MIDI is not supported in this browser')
      return false
    }

    try {
      const access = await navigator.requestMIDIAccess({ sysex: false })
      midiAccessRef.current = access
      setHasAccess(true)
      setError(null)

      // Listen for device changes
      access.onstatechange = () => {
        updateDevices()
      }

      // Initial device scan
      updateDevices()

      console.log('MIDI: Access granted')
      return true
    } catch (err) {
      console.error('MIDI: Access denied', err)
      setError('MIDI access denied. Please allow MIDI access in your browser.')
      return false
    }
  }, [isSupported, updateDevices])

  // Disconnect from current device
  const disconnect = useCallback(() => {
    if (connectedInputRef.current) {
      connectedInputRef.current.onmidimessage = null
      connectedInputRef.current = null
      setConnectedDevice(null)
      console.log('MIDI: Disconnected')
    }
  }, [])

  // Auto-request access on mount if supported
  useEffect(() => {
    if (isSupported && autoConnect) {
      requestAccess()
    }

    return () => {
      disconnect()
    }
  }, [isSupported, autoConnect, requestAccess, disconnect])

  return {
    isSupported,
    hasAccess,
    devices,
    connectedDevice,
    requestAccess,
    connectDevice: connectToDevice,
    disconnect,
    error,
  }
}

export default useMidiInput
