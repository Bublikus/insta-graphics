import { BaseCanvas2DScene } from '../../base/BaseCanvas2DScene'
import { COLOR_STOPS, withAlpha } from './palette'

interface VerticalSpinParticle {
  x: number
  y: number
  speed: number
  size: number
  angle: number
  spinSpeed: number
  swayAmplitude: number
  swaySpeed: number
  phase: number
  trailLength: number
  colorOffset: number
}

const PARTICLE_COUNT = 34
const TAU = Math.PI * 2

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export class DemoGradientVerticalSpinScene extends BaseCanvas2DScene {
  private elapsedMs = 0
  private particles: VerticalSpinParticle[] = []

  protected override afterResize(): void {
    this.particles = Array.from({ length: PARTICLE_COUNT }, (_, index) => {
      const seed = index + 1
      return this.createParticle(seed, true)
    })
  }

  protected override update(deltaMs: number, elapsedMs: number): void {
    this.elapsedMs = elapsedMs
    const deltaSeconds = deltaMs / 1000
    const { height } = this.viewport

    for (const [index, particle] of this.particles.entries()) {
      particle.y -= particle.speed * deltaSeconds
      particle.angle += particle.spinSpeed * deltaSeconds

      if (particle.y + particle.trailLength < 0) {
        this.particles[index] = this.createParticle(index + 100, false)
      }
    }

    if (height <= 0) {
      return
    }
  }

  protected override render(): void {
    const context = this.context
    if (context === null) {
      return
    }

    const { width, height } = this.viewport
    const time = this.elapsedMs * 0.001

    context.clearRect(0, 0, width, height)

    const background = context.createLinearGradient(0, 0, 0, height)
    COLOR_STOPS.forEach((color, index) => {
      const stop = index / (COLOR_STOPS.length - 1)
      background.addColorStop(stop, withAlpha(color, 0.96))
    })
    context.fillStyle = background
    context.fillRect(0, 0, width, height)

    const verticalBeam = context.createLinearGradient(width * 0.2, 0, width * 0.8, 0)
    verticalBeam.addColorStop(0, withAlpha('#ffffff', 0))
    verticalBeam.addColorStop(0.5, withAlpha('#ffffff', 0.14))
    verticalBeam.addColorStop(1, withAlpha('#ffffff', 0))
    context.fillStyle = verticalBeam
    context.fillRect(0, 0, width, height)

    context.strokeStyle = withAlpha('#ffffff', 0.12)
    context.lineWidth = 1.6
    context.lineCap = 'round'
    context.beginPath()
    context.moveTo(width * 0.22, height)
    context.bezierCurveTo(
      width * 0.27,
      height * 0.7 + Math.sin(time * 1.1) * 40,
      width * 0.29,
      height * 0.3 + Math.cos(time * 1.3) * 50,
      width * 0.34,
      0,
    )
    context.moveTo(width * 0.66, height)
    context.bezierCurveTo(
      width * 0.71,
      height * 0.75 + Math.cos(time * 0.9 + 0.4) * 40,
      width * 0.73,
      height * 0.34 + Math.sin(time * 1.2 + 0.9) * 46,
      width * 0.78,
      0,
    )
    context.stroke()

    for (const [index, particle] of this.particles.entries()) {
      const sway = Math.sin(time * particle.swaySpeed + particle.phase) * particle.swayAmplitude
      const x = particle.x + sway
      const y = particle.y
      const pulse = 0.45 + Math.sin(time * 3.2 + particle.phase + index * 0.18) * 0.5
      const size = particle.size * (0.75 + pulse * 0.55)
      const colorA = COLOR_STOPS[(index + particle.colorOffset) % COLOR_STOPS.length] ?? '#ffffff'
      const colorB = COLOR_STOPS[(index + particle.colorOffset + 2) % COLOR_STOPS.length] ?? '#ffffff'

      const trail = context.createLinearGradient(x, y, x, y + particle.trailLength)
      trail.addColorStop(0, withAlpha(colorA, 0.42 + pulse * 0.24))
      trail.addColorStop(1, withAlpha(colorB, 0))
      context.strokeStyle = trail
      context.lineWidth = Math.max(1.2, size * 0.72)
      context.beginPath()
      context.moveTo(x, y)
      context.lineTo(x, y + particle.trailLength)
      context.stroke()

      const glow = context.createRadialGradient(x, y, 0, x, y, size * 5)
      glow.addColorStop(0, withAlpha('#ffffff', 0.86))
      glow.addColorStop(0.28, withAlpha(colorA, 0.5 + pulse * 0.2))
      glow.addColorStop(1, withAlpha(colorB, 0))
      context.fillStyle = glow
      context.beginPath()
      context.arc(x, y, size * 5, 0, TAU)
      context.fill()

      context.save()
      context.translate(x, y)
      context.rotate(particle.angle + Math.sin(time * 2 + particle.phase) * 0.2)
      context.fillStyle = withAlpha('#ffffff', 0.88)
      context.beginPath()
      context.roundRect(-size * 0.7, -size * 1.1, size * 1.4, size * 2.2, size * 0.6)
      context.fill()
      context.restore()
    }
  }

  private createParticle(seed: number, useViewportSpread: boolean): VerticalSpinParticle {
    const { width, height } = this.viewport
    const lane = pseudoRandom(seed * 1.41)
    const yRange = useViewportSpread ? height : 0

    return {
      x: width * (0.14 + lane * 0.72),
      y: height + pseudoRandom(seed * 3.3) * yRange + 20,
      speed: 72 + pseudoRandom(seed * 2.9) * 130,
      size: 2.2 + pseudoRandom(seed * 5.7) * 5.4,
      angle: pseudoRandom(seed * 7.1) * TAU,
      spinSpeed: -2.2 + pseudoRandom(seed * 9.4) * 4.4,
      swayAmplitude: 2 + pseudoRandom(seed * 11.6) * 7,
      swaySpeed: 0.6 + pseudoRandom(seed * 13.8) * 1.6,
      phase: pseudoRandom(seed * 15.2) * TAU,
      trailLength: 30 + pseudoRandom(seed * 17.3) * 110,
      colorOffset: Math.floor(pseudoRandom(seed * 19.5) * COLOR_STOPS.length),
    }
  }
}
