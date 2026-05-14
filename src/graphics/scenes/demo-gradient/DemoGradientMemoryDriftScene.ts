import { BaseCanvas2DScene } from '../../base/BaseCanvas2DScene'
import { COLOR_STOPS, withAlpha } from './palette'

interface MemoryParticle {
  orbitRadius: number
  orbitSpeed: number
  driftSpeed: number
  phase: number
  wobble: number
  size: number
  laneOffset: number
  hueOffset: number
}

const PARTICLE_COUNT = 28
const TAU = Math.PI * 2

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export class DemoGradientMemoryDriftScene extends BaseCanvas2DScene {
  private elapsedMs = 0
  private particles: MemoryParticle[] = []

  protected override afterResize(): void {
    const { width, height } = this.viewport
    const maxRadius = Math.min(width, height) * 0.4

    this.particles = Array.from({ length: PARTICLE_COUNT }, (_, index) => {
      const seed = index + 1
      const spread = 0.18 + index / (PARTICLE_COUNT - 1)
      return {
        orbitRadius: maxRadius * spread,
        orbitSpeed: 0.08 + pseudoRandom(seed * 1.7) * 0.24,
        driftSpeed: 0.22 + pseudoRandom(seed * 3.3) * 0.35,
        phase: pseudoRandom(seed * 5.9) * TAU,
        wobble: 12 + pseudoRandom(seed * 7.4) * 34,
        size: 2.8 + pseudoRandom(seed * 10.2) * 6.5,
        laneOffset: (pseudoRandom(seed * 13.1) - 0.5) * height * 0.36,
        hueOffset: pseudoRandom(seed * 15.5) * 0.6,
      }
    })
  }

  protected override update(_deltaMs: number, elapsedMs: number): void {
    this.elapsedMs = elapsedMs
  }

  protected override render(): void {
    const context = this.context
    if (context === null) {
      return
    }

    const { width, height } = this.viewport
    const centerX = width * 0.5
    const centerY = height * 0.5
    const minDimension = Math.min(width, height)
    const maxRadius = minDimension * 0.46
    const time = this.elapsedMs * 0.001

    context.clearRect(0, 0, width, height)

    const gradient = context.createLinearGradient(0, 0, width, height)
    COLOR_STOPS.forEach((color, index) => {
      gradient.addColorStop(index / (COLOR_STOPS.length - 1), withAlpha(color, 0.94))
    })
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)

    const centerGlow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius * 1.1)
    centerGlow.addColorStop(0, withAlpha('#ffffff', 0.24))
    centerGlow.addColorStop(0.38, withAlpha('#d3d6ff', 0.11))
    centerGlow.addColorStop(1, withAlpha('#0e0820', 0))
    context.fillStyle = centerGlow
    context.fillRect(0, 0, width, height)

    context.lineCap = 'round'
    context.strokeStyle = withAlpha('#f1efff', 0.11)
    context.lineWidth = 2.5
    context.beginPath()
    context.moveTo(width * 0.08, centerY + Math.sin(time * 0.7) * 50)
    context.bezierCurveTo(
      width * 0.26,
      centerY - 170 + Math.sin(time * 0.9 + 1.1) * 50,
      width * 0.66,
      centerY + 200 + Math.cos(time * 0.85 + 0.4) * 65,
      width * 0.92,
      centerY - 60 + Math.sin(time * 0.73 + 2.2) * 55,
    )
    context.stroke()

    context.strokeStyle = withAlpha('#ffffff', 0.08)
    context.lineWidth = 1.5
    context.beginPath()
    context.moveTo(width * 0.07, centerY + 220 + Math.sin(time * 0.6) * 40)
    context.bezierCurveTo(
      width * 0.24,
      centerY - 50 + Math.cos(time * 0.75 + 1.4) * 55,
      width * 0.64,
      centerY + 240 + Math.sin(time * 0.92 + 0.7) * 45,
      width * 0.9,
      centerY - 10 + Math.cos(time * 0.81 + 1.9) * 60,
    )
    context.stroke()

    for (const [index, particle] of this.particles.entries()) {
      const orbitAngle = particle.phase + time * particle.orbitSpeed * TAU
      const driftAngle = particle.phase * 0.6 + time * particle.driftSpeed
      const x =
        centerX +
        Math.cos(orbitAngle) * particle.orbitRadius +
        Math.sin(driftAngle * 1.4 + index * 0.7) * particle.wobble
      const y =
        centerY +
        particle.laneOffset * 0.3 +
        Math.sin(driftAngle + index * 0.5) * (26 + particle.wobble * 0.7) +
        Math.cos(orbitAngle * 0.7) * particle.wobble

      const pulse = 0.5 + Math.sin(time * 3.1 + particle.phase + index * 0.2) * 0.5
      const alpha = 0.2 + pulse * 0.5
      const radius = particle.size * (0.78 + pulse * 0.62)

      const colorA = COLOR_STOPS[index % COLOR_STOPS.length] ?? '#ffffff'
      const colorB = COLOR_STOPS[(index + 2) % COLOR_STOPS.length] ?? '#ffffff'
      const glow = context.createRadialGradient(x, y, 0, x, y, radius * 4.8)
      glow.addColorStop(0, withAlpha(colorA, alpha * 0.88))
      glow.addColorStop(0.5, withAlpha(colorB, alpha * 0.36 + particle.hueOffset * 0.12))
      glow.addColorStop(1, withAlpha('#ffffff', 0))

      context.fillStyle = glow
      context.beginPath()
      context.arc(x, y, radius * 4.8, 0, TAU)
      context.fill()

      context.fillStyle = withAlpha('#ffffff', 0.36 + pulse * 0.42)
      context.beginPath()
      context.arc(x, y, radius, 0, TAU)
      context.fill()
    }
  }
}
