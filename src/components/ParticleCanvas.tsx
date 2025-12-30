'use client'

import { useRef, useEffect, useCallback } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  life: number
  spawnY: number // Track spawn position to calculate midpoint
}

interface OrbPosition {
  x: number
  y: number
  radius: number
}

interface ParticleCanvasProps {
  pressedKeys: Set<number>
  getKeyPosition: (midiNote: number) => { x: number; y: number } | null
  orbPosition: OrbPosition | null
}

// Particle settings
const PARTICLE_COLOR_START = { r: 224, g: 90, b: 0 } // #e05a00 (orange)
const PARTICLE_COLOR_END = { r: 255, g: 255, b: 255 } // white
const MAX_PARTICLES = 300
const SPAWN_RATE = 50 // ms between spawns per key
const PARTICLE_SIZE_MIN = 2
const PARTICLE_SIZE_MAX = 4
const VELOCITY_Y_MIN = -3
const VELOCITY_Y_MAX = -5
const VELOCITY_X_SPREAD = 0.5
const GRAVITY_STRENGTH = 0.15 // How strongly particles curve toward orb

export function ParticleCanvas({
  pressedKeys,
  getKeyPosition,
  orbPosition,
}: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const lastSpawnTimeRef = useRef<Map<number, number>>(new Map())
  const animationFrameRef = useRef<number | null>(null)

  // Spawn a particle at a key position
  const spawnParticle = useCallback((x: number, y: number) => {
    if (particlesRef.current.length >= MAX_PARTICLES) return

    const particle: Particle = {
      x: x + (Math.random() - 0.5) * 10, // Random spread
      y: y,
      vx: (Math.random() - 0.5) * VELOCITY_X_SPREAD,
      vy: VELOCITY_Y_MIN + Math.random() * (VELOCITY_Y_MAX - VELOCITY_Y_MIN),
      size: PARTICLE_SIZE_MIN + Math.random() * (PARTICLE_SIZE_MAX - PARTICLE_SIZE_MIN),
      alpha: 0.8 + Math.random() * 0.2,
      life: 1,
      spawnY: y,
    }

    particlesRef.current.push(particle)
  }, [])

  // Update and draw particles
  const animate = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const now = performance.now()
    const particles = particlesRef.current

    // Spawn new particles for pressed keys
    pressedKeys.forEach((midiNote) => {
      const lastSpawn = lastSpawnTimeRef.current.get(midiNote) || 0
      if (now - lastSpawn >= SPAWN_RATE) {
        const pos = getKeyPosition(midiNote)
        if (pos) {
          spawnParticle(pos.x, pos.y)
          lastSpawnTimeRef.current.set(midiNote, now)
        }
      }
    })

    // Update and draw particles
    const aliveParticles: Particle[] = []

    for (const p of particles) {
      // Update position
      p.x += p.vx
      p.y += p.vy

      // Calculate midpoint between spawn position and orb
      if (orbPosition) {
        const midpointY = (p.spawnY + orbPosition.y) / 2

        // Once past midpoint (closer to orb than piano), apply gravity and fade
        if (p.y < midpointY) {
          const dx = orbPosition.x - p.x
          const dy = orbPosition.y - p.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          // Normalize direction and apply gravity
          if (dist > 1) {
            p.vx += (dx / dist) * GRAVITY_STRENGTH
            p.vy += (dy / dist) * GRAVITY_STRENGTH * 0.5
          }

          // Calculate progress from midpoint to orb (0 = at midpoint, 1 = at orb center)
          const totalDistance = midpointY - orbPosition.y
          const distanceFromMidpoint = midpointY - p.y
          const progress = Math.min(1, distanceFromMidpoint / totalDistance)

          // Fade based on progress - accelerate fade as we get closer
          const fadeRate = 0.92 + (1 - progress) * 0.06 // 0.98 at midpoint, 0.92 near orb
          p.alpha *= fadeRate

          // Kill particle when very close to orb center
          if (dist < orbPosition.radius * 0.8) {
            p.alpha = 0
          }
        }
      }

      // Slow lifetime decay (mostly for particles that never reach orb)
      p.life -= 0.002

      // Remove dead particles
      if (p.alpha <= 0.01 || p.life <= 0 || p.y < -50) {
        continue
      }

      aliveParticles.push(p)

      // Calculate color transition progress (0 = orange, 1 = white)
      let colorProgress = 0
      if (orbPosition) {
        const midpointY = (p.spawnY + orbPosition.y) / 2
        if (p.y < midpointY) {
          const totalDistance = midpointY - orbPosition.y
          const distanceFromMidpoint = midpointY - p.y
          colorProgress = Math.min(1, distanceFromMidpoint / totalDistance)
        }
      }

      // Lerp between orange and white
      const r = Math.round(PARTICLE_COLOR_START.r + (PARTICLE_COLOR_END.r - PARTICLE_COLOR_START.r) * colorProgress)
      const g = Math.round(PARTICLE_COLOR_START.g + (PARTICLE_COLOR_END.g - PARTICLE_COLOR_START.g) * colorProgress)
      const b = Math.round(PARTICLE_COLOR_START.b + (PARTICLE_COLOR_END.b - PARTICLE_COLOR_START.b) * colorProgress)

      // Draw particle with glow effect
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2)
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${p.alpha})`)
      gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${p.alpha * 0.6})`)
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)

      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()

      // Core bright center (also transitions to white)
      const coreR = Math.round(255 + (255 - 255) * colorProgress)
      const coreG = Math.round(180 + (255 - 180) * colorProgress)
      const coreB = Math.round(100 + (255 - 100) * colorProgress)
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${coreR}, ${coreG}, ${coreB}, ${p.alpha})`
      ctx.fill()
    }

    particlesRef.current = aliveParticles

    // Continue animation
    animationFrameRef.current = requestAnimationFrame(animate)
  }, [pressedKeys, getKeyPosition, orbPosition, spawnParticle])

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Start/stop animation loop
  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [animate])

  // Clear spawn times when keys are released
  useEffect(() => {
    const currentKeys = new Set(pressedKeys)
    lastSpawnTimeRef.current.forEach((_, key) => {
      if (!currentKeys.has(key)) {
        lastSpawnTimeRef.current.delete(key)
      }
    })
  }, [pressedKeys])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-10"
      style={{ background: 'transparent' }}
    />
  )
}

export default ParticleCanvas
