import { BaseCanvas2DScene } from '../../base/BaseCanvas2DScene'

interface PixelTunnelVariant {
  id: 'calm' | 'energetic' | 'deep-hypnosis'
  ringCount: number
  cellSize: number
  minBreathScale: number
  maxBreathScale: number
  breathCyclesPerLoop: number
  innerCyclesPerLoop: number
  outerCyclesPerLoop: number
  rippleCenters: number[]
  glowStrength: number
  hueDriftDeg: number
}

interface RingSpec {
  radiusRatio: number
  particleCount: number
  direction: 1 | -1
  cyclesPerLoop: number
  phaseOffset: number
  hueOffset: number
}

const TAU = Math.PI * 2
const LOOP_MS = 12_000
const BG_COLOR = '#05060a'
const SELECTED_VARIANT_ID: PixelTunnelVariant['id'] = 'deep-hypnosis'

const PIXEL_TUNNEL_VARIANTS: readonly PixelTunnelVariant[] = [
  {
    id: 'calm',
    ringCount: 8,
    cellSize: 10,
    minBreathScale: 0.93,
    maxBreathScale: 1.07,
    breathCyclesPerLoop: 3,
    innerCyclesPerLoop: 2,
    outerCyclesPerLoop: 1,
    rippleCenters: [0.66],
    glowStrength: 0.8,
    hueDriftDeg: 14,
  },
  {
    id: 'energetic',
    ringCount: 10,
    cellSize: 8,
    minBreathScale: 0.9,
    maxBreathScale: 1.1,
    breathCyclesPerLoop: 5,
    innerCyclesPerLoop: 4,
    outerCyclesPerLoop: 2,
    rippleCenters: [0.35, 0.82],
    glowStrength: 0.96,
    hueDriftDeg: 24,
  },
  {
    id: 'deep-hypnosis',
    ringCount: 12,
    cellSize: 9,
    minBreathScale: 0.92,
    maxBreathScale: 1.08,
    breathCyclesPerLoop: 4,
    innerCyclesPerLoop: 3,
    outerCyclesPerLoop: 1,
    rippleCenters: [0.74],
    glowStrength: 1,
    hueDriftDeg: 18,
  },
]

function getVariantById(id: PixelTunnelVariant['id']): PixelTunnelVariant {
  const byId = PIXEL_TUNNEL_VARIANTS.find((variant) => variant.id === id)
  if (byId !== undefined) {
    return byId
  }

  const fallback = PIXEL_TUNNEL_VARIANTS[0]
  if (fallback === undefined) {
    throw new Error('Pixel tunnel variants are not configured')
  }

  return fallback
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function lerp(min: number, max: number, progress: number): number {
  return min + (max - min) * progress
}

function hueToColor(hueDeg: number, alpha: number): string {
  const hue = ((hueDeg % 360) + 360) % 360
  return `hsla(${hue.toFixed(1)} 96% 70% / ${clamp01(alpha).toFixed(3)})`
}

function squarePerimeterPoint(radius: number, progress: number): { x: number; y: number } {
  const normalized = ((progress % 1) + 1) % 1
  const segment = normalized * 4
  const segmentIndex = Math.floor(segment)
  const local = segment - segmentIndex

  if (segmentIndex === 0) {
    return { x: lerp(-radius, radius, local), y: -radius }
  }

  if (segmentIndex === 1) {
    return { x: radius, y: lerp(-radius, radius, local) }
  }

  if (segmentIndex === 2) {
    return { x: lerp(radius, -radius, local), y: radius }
  }

  return { x: -radius, y: lerp(radius, -radius, local) }
}

function quantize(value: number, cellSize: number): number {
  return Math.round(value / cellSize) * cellSize
}

export class PixelMoireTunnelScene extends BaseCanvas2DScene {
  private readonly variant = getVariantById(SELECTED_VARIANT_ID)
  private elapsedMs = 0
  private rings: RingSpec[] = []

  protected override afterResize(): void {
    const ringCount = this.variant.ringCount
    this.rings = Array.from({ length: ringCount }, (_, index) => {
      const progress = ringCount <= 1 ? 0 : index / (ringCount - 1)
      const easedProgress = Math.pow(progress, 0.88)

      return {
        radiusRatio: 0.12 + easedProgress * 0.76,
        particleCount: Math.max(20, Math.round(28 + easedProgress * 64)),
        direction: index % 2 === 0 ? 1 : -1,
        cyclesPerLoop: Math.max(
          1,
          Math.round(
            this.variant.innerCyclesPerLoop +
              (this.variant.outerCyclesPerLoop - this.variant.innerCyclesPerLoop) * easedProgress,
          ),
        ),
        phaseOffset: progress * 0.82,
        hueOffset: progress * 92,
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

    context.clearRect(0, 0, width, height)
    context.fillStyle = BG_COLOR
    context.fillRect(0, 0, width, height)

    const loopProgress = (this.elapsedMs % LOOP_MS) / LOOP_MS
    const breathProgress = (Math.sin(loopProgress * TAU * this.variant.breathCyclesPerLoop) + 1) * 0.5
    const breathScale = lerp(this.variant.minBreathScale, this.variant.maxBreathScale, breathProgress)
    const brightnessBreathProgress =
      (Math.sin(loopProgress * TAU * this.variant.breathCyclesPerLoop - 0.3 * Math.PI) + 1) * 0.5
    const baseHue = 205 + Math.sin(loopProgress * TAU) * this.variant.hueDriftDeg

    for (const ring of this.rings) {
      const ringRadius = ring.radiusRatio * maxRadius * breathScale
      const ringProgress = ring.radiusRatio
      const ringPhase =
        ring.direction * loopProgress * ring.cyclesPerLoop + ring.phaseOffset + loopProgress * 0.15

      let rippleBoost = 0
      for (const center of this.variant.rippleCenters) {
        const spatialDistance = Math.abs(ringProgress - center)
        const wrappedSpatialDistance = Math.min(spatialDistance, 1 - spatialDistance)
        const spatialFalloff = Math.exp(-Math.pow(wrappedSpatialDistance * 10.2, 2))
        const temporalDistance = Math.min(Math.abs(loopProgress - center), 1 - Math.abs(loopProgress - center))
        const temporalFalloff = Math.exp(-Math.pow(temporalDistance * 28, 2))
        rippleBoost += 0.14 * spatialFalloff * temporalFalloff
      }

      const ringBlockSize =
        this.variant.cellSize * (0.55 + ringProgress * 0.8 + brightnessBreathProgress * 0.2 + rippleBoost * 2.2)

      for (let index = 0; index < ring.particleCount; index += 1) {
        const particleProgress = index / ring.particleCount
        const perimeterProgress = particleProgress + ringPhase
        const point = squarePerimeterPoint(ringRadius, perimeterProgress)
        const jitterSeed = ring.phaseOffset * 17.3 + particleProgress * 44.7
        const jitterX = Math.sin(loopProgress * TAU * 23 + jitterSeed) * 0.75
        const jitterY = Math.cos(loopProgress * TAU * 27 + jitterSeed * 1.2) * 0.75

        const x = quantize(centerX + point.x + jitterX, this.variant.cellSize)
        const y = quantize(centerY + point.y + jitterY, this.variant.cellSize)

        const particlePulse =
          (Math.sin(loopProgress * TAU * 19 + particleProgress * TAU * 2.9 + ring.phaseOffset) + 1) * 0.5
        const alpha =
          0.16 +
          brightnessBreathProgress * 0.35 +
          particlePulse * 0.22 +
          rippleBoost * 1.9 * this.variant.glowStrength

        const blockSize = Math.max(
          this.variant.cellSize * 0.6,
          ringBlockSize + this.variant.cellSize * particlePulse * 0.5,
        )

        context.fillStyle = hueToColor(baseHue + ring.hueOffset + particleProgress * 20, alpha)
        context.fillRect(x - blockSize * 0.5, y - blockSize * 0.5, blockSize, blockSize)
      }
    }

    const vignette = context.createRadialGradient(
      centerX,
      centerY,
      maxRadius * 0.24,
      centerX,
      centerY,
      maxRadius * 1.3,
    )
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.56)')
    context.fillStyle = vignette
    context.fillRect(0, 0, width, height)
  }
}
