import { BaseCanvas2DScene } from '../../base/BaseCanvas2DScene'
import {
  buildHypnoticRings,
  buildLoopMotionState,
  computeRippleBoost,
  lerp,
  type HypnoticRingSpec,
  type HypnoticVariantCore,
  hueToColor,
} from './hypnoticShared'

interface PixelTunnelVariant extends HypnoticVariantCore {
  id: 'calm' | 'energetic' | 'deep-hypnosis'
  cellSize: number
}

const TAU = Math.PI * 2
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
  private rings: HypnoticRingSpec[] = []

  protected override afterResize(): void {
    this.rings = buildHypnoticRings(this.variant.ringCount, this.variant, {
      radiusStart: 0.12,
      radiusSpan: 0.76,
      minParticles: 20,
      particleSpan: 64,
      easingExponent: 0.88,
      phaseSpan: 0.82,
      hueSpan: 92,
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

    const { loopProgress, breathScale, brightnessBreathProgress, baseHue } = buildLoopMotionState(
      this.elapsedMs,
      this.variant,
      {
        baseHue: 205,
        brightnessPhaseOffsetRad: -0.3 * Math.PI,
      },
    )

    for (const ring of this.rings) {
      const ringRadius = ring.radiusRatio * maxRadius * breathScale
      const ringProgress = ring.radiusRatio
      const ringPhase =
        ring.direction * loopProgress * ring.cyclesPerLoop + ring.phaseOffset + loopProgress * 0.15
      const rippleBoost = computeRippleBoost(
        ringProgress,
        loopProgress,
        this.variant.rippleCenters,
        10.2,
        28,
        0.14,
      )

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

        context.fillStyle = hueToColor(baseHue + ring.hueOffset + particleProgress * 20, alpha, 70)
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
