'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sphere, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

type AgentState = 'idle' | 'listening' | 'talking' | null

interface OrbMeshProps {
  colors: [string, string]
  agentState: AgentState
  getInputVolume?: () => number
  getOutputVolume?: () => number
}

function OrbMesh({ colors, agentState, getInputVolume, getOutputVolume }: OrbMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  // Create gradient colors
  const [color1, color2] = useMemo(() => {
    return [new THREE.Color(colors[0]), new THREE.Color(colors[1])]
  }, [colors])

  // State for dynamic color
  const currentColor = useRef(new THREE.Color(colors[0]))

  useFrame((state) => {
    if (!meshRef.current) return

    const time = state.clock.getElapsedTime()

    // Get volume levels for audio reactivity
    const inputVolume = getInputVolume?.() ?? 0
    const outputVolume = getOutputVolume?.() ?? 0

    // Base breathing animation
    let scale = 1 + Math.sin(time * 0.5) * 0.05

    // State-based animations
    if (agentState === 'listening') {
      // Pulse with input volume when listening
      scale += inputVolume * 0.3
      meshRef.current.rotation.y = time * 0.2
    } else if (agentState === 'talking') {
      // More active animation when talking
      scale += outputVolume * 0.4
      meshRef.current.rotation.y = time * 0.5
      meshRef.current.rotation.x = Math.sin(time * 2) * 0.1
    } else {
      // Gentle idle rotation
      meshRef.current.rotation.y = time * 0.1
    }

    meshRef.current.scale.setScalar(scale)

    // Color blend based on state
    const blendFactor = agentState === 'talking'
      ? 0.5 + Math.sin(time * 3) * 0.5
      : 0.5 + Math.sin(time) * 0.3
    currentColor.current.lerpColors(color1, color2, blendFactor)
  })

  // Distort speed based on state
  const distortSpeed = agentState === 'talking' ? 4 : agentState === 'listening' ? 2 : 1
  const distort = agentState === 'talking' ? 0.5 : agentState === 'listening' ? 0.4 : 0.3

  return (
    <Sphere ref={meshRef} args={[1, 64, 64]}>
      <MeshDistortMaterial
        color={colors[0]}
        attach="material"
        distort={distort}
        speed={distortSpeed}
        roughness={0.4}
        metalness={0.1}
        emissive={colors[1]}
        emissiveIntensity={0.15}
      />
    </Sphere>
  )
}

interface OrbProps {
  colors?: [string, string]
  agentState?: AgentState
  getInputVolume?: () => number
  getOutputVolume?: () => number
  className?: string
}

export function Orb({
  colors = ['#DDD6FE', '#C4B5FD'],
  agentState = null,
  getInputVolume,
  getOutputVolume,
  className,
}: OrbProps) {
  return (
    <div className={className} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent', overflow: 'visible' }}
      >
        <ambientLight intensity={1.2} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <pointLight position={[-10, -10, -10]} intensity={0.8} color="#C4B5FD" />
        <pointLight position={[0, 10, 5]} intensity={1} color="#E9D5FF" />
        <OrbMesh
          colors={colors}
          agentState={agentState}
          getInputVolume={getInputVolume}
          getOutputVolume={getOutputVolume}
        />
      </Canvas>
    </div>
  )
}

export default Orb
