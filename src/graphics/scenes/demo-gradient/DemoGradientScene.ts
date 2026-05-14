import { BaseCanvas2DScene } from '../../base/BaseCanvas2DScene'
import { COLOR_STOPS, withAlpha } from './palette'

interface Particle {
  x: number
  y: number
  radius: number
  speed: number
  phase: number
}

const PARTICLE_COUNT = 24

export class DemoGradientScene extends BaseCanvas2DScene {
  private particles: Particle[] = []
  private elapsedMs = 0

  protected override afterResize(): void {
    this.particles = Array.from({ length: PARTICLE_COUNT }, (_, index) =>
      this.createParticle(index / PARTICLE_COUNT),
    )
  }

  protected override update(deltaMs: number, elapsedMs: number): void {
    this.elapsedMs = elapsedMs
    const deltaSeconds = deltaMs / 1000

    for (const particle of this.particles) {
      particle.y -= particle.speed * deltaSeconds

      if (particle.y + particle.radius < 0) {
        particle.y = this.viewport.height + particle.radius
      }
    }
  }

  protected override render(): void {
    const context = this.context
    if (context === null) {
      return
    }

    const { width, height } = this.viewport
    context.clearRect(0, 0, width, height)

    const gradient = context.createLinearGradient(0, 0, width, height)
    COLOR_STOPS.forEach((color, index) => {
      gradient.addColorStop(index / (COLOR_STOPS.length - 1), color)
    })

    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)

    const waveOffset = Math.sin(this.elapsedMs * 0.0008) * 40
    context.fillStyle = withAlpha('#ffffff', 0.1)
    context.beginPath()
    context.moveTo(0, height * 0.7 + waveOffset)
    context.quadraticCurveTo(
      width * 0.5,
      height * 0.45 + waveOffset,
      width,
      height * 0.7 + waveOffset,
    )
    context.lineTo(width, height)
    context.lineTo(0, height)
    context.closePath()
    context.fill()

    for (const particle of this.particles) {
      const pulse = 0.35 + Math.sin(this.elapsedMs * 0.0012 + particle.phase) * 0.3
      context.fillStyle = withAlpha('#ffffff', pulse)
      context.beginPath()
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
      context.fill()
    }
  }

  private createParticle(seed: number): Particle {
    return {
      x: this.viewport.width * (0.1 + seed * 0.8),
      y: this.viewport.height * Math.random(),
      radius: 3 + Math.random() * 10,
      speed: 8 + Math.random() * 22,
      phase: Math.random() * Math.PI * 2,
    }
  }
}
