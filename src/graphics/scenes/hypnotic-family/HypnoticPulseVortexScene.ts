import { BaseCanvas2DScene } from '../../base/BaseCanvas2DScene'
import {
  buildHypnoticRings,
  buildLoopMotionState,
  computeRippleBoost,
  type HypnoticRingSpec,
  type HypnoticVariantCore,
  hueToColor,
} from './hypnoticShared'

interface VortexVariant extends HypnoticVariantCore {
  id: 'calm' | 'energetic' | 'deep-hypnosis'
}

const TAU = Math.PI * 2
const BG_COLOR = '#05060e'
const SELECTED_VARIANT_ID: VortexVariant['id'] = 'deep-hypnosis'

const VORTEX_VARIANTS: readonly VortexVariant[] = [
  {
    id: 'calm',
    ringCount: 8,
    breathCyclesPerLoop: 3,
    minBreathScale: 0.93,
    maxBreathScale: 1.07,
    innerCyclesPerLoop: 2,
    outerCyclesPerLoop: 1,
    rippleCenters: [0.66],
    glowStrength: 0.82,
    hueDriftDeg: 16,
  },
  {
    id: 'energetic',
    ringCount: 10,
    breathCyclesPerLoop: 5,
    minBreathScale: 0.9,
    maxBreathScale: 1.1,
    innerCyclesPerLoop: 4,
    outerCyclesPerLoop: 2,
    rippleCenters: [0.35, 0.85],
    glowStrength: 0.96,
    hueDriftDeg: 28,
  },
  {
    id: 'deep-hypnosis',
    ringCount: 12,
    breathCyclesPerLoop: 4,
    minBreathScale: 0.92,
    maxBreathScale: 1.08,
    innerCyclesPerLoop: 3,
    outerCyclesPerLoop: 1,
    rippleCenters: [0.74],
    glowStrength: 1,
    hueDriftDeg: 20,
  },
]

function getVariantById(id: VortexVariant['id']): VortexVariant {
  const byId = VORTEX_VARIANTS.find((variant) => variant.id === id)
  if (byId !== undefined) {
    return byId
  }

  const fallback = VORTEX_VARIANTS[0]
  if (fallback === undefined) {
    throw new Error('Hypnotic pulse vortex variants are not configured')
  }

  return fallback
}

export class HypnoticPulseVortexScene extends BaseCanvas2DScene {
  private readonly variant = getVariantById(SELECTED_VARIANT_ID)
  private elapsedMs = 0
  private rings: HypnoticRingSpec[] = []

  protected override afterResize(): void {
    this.rings = buildHypnoticRings(this.variant.ringCount, this.variant, {
      radiusStart: 0.12,
      radiusSpan: 0.78,
      minParticles: 18,
      particleSpan: 58,
      easingExponent: 0.9,
      phaseSpan: 0.85,
      hueSpan: 88,
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
    const maxRadius = minDimension * 0.45

    context.clearRect(0, 0, width, height)
    context.fillStyle = BG_COLOR
    context.fillRect(0, 0, width, height)

    const { loopProgress, breathScale, brightnessBreathProgress, baseHue } = buildLoopMotionState(
      this.elapsedMs,
      this.variant,
      {
        baseHue: 208,
        brightnessPhaseOffsetRad: -0.68 * Math.PI,
      },
    )

    const centerGlow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius * 0.95)
    centerGlow.addColorStop(0, 'rgba(255, 255, 255, 0.12)')
    centerGlow.addColorStop(0.35, 'rgba(124, 181, 255, 0.09)')
    centerGlow.addColorStop(1, 'rgba(5, 6, 14, 0)')
    context.fillStyle = centerGlow
    context.fillRect(0, 0, width, height)

    for (const ring of this.rings) {
      const ringRadius = ring.radiusRatio * maxRadius * breathScale
      const ringProgress = ring.radiusRatio
      const ringAngleOffset =
        ring.direction * loopProgress * TAU * ring.cyclesPerLoop + ring.phaseOffset * TAU
      const ringRippleBoost = computeRippleBoost(
        ringProgress,
        loopProgress,
        this.variant.rippleCenters,
        10.5,
        28,
        0.13,
      )
      const ringThickness = 0.65 + ringProgress * 1.8

      context.strokeStyle = hueToColor(baseHue + ring.hueOffset, 0.11 + ringRippleBoost * 0.5)
      context.lineWidth = ringThickness
      context.beginPath()
      context.arc(centerX, centerY, ringRadius, 0, TAU)
      context.stroke()

      for (let index = 0; index < ring.particleCount; index += 1) {
        const particleProgress = index / ring.particleCount
        const angle = particleProgress * TAU + ringAngleOffset
        const jitterSeed = ring.phaseOffset * 14.37 + particleProgress * 40.1
        const jitterX = Math.sin(loopProgress * TAU * 29 + jitterSeed) * 0.74
        const jitterY = Math.cos(loopProgress * TAU * 31 + jitterSeed * 1.3) * 0.74

        const x = centerX + Math.cos(angle) * ringRadius + jitterX
        const y = centerY + Math.sin(angle) * ringRadius + jitterY

        const particlePulse =
          (Math.sin(loopProgress * TAU * 17 + particleProgress * TAU * 3.1) + 1) * 0.5
        const particleAlpha =
          0.18 +
          brightnessBreathProgress * 0.38 +
          particlePulse * 0.22 +
          ringRippleBoost * 1.8 * this.variant.glowStrength
        const particleRadius = 0.85 + ringProgress * 2.4 + particlePulse * 1.1 + ringRippleBoost * 5

        context.fillStyle = hueToColor(baseHue + ring.hueOffset + particleProgress * 24, particleAlpha)
        context.beginPath()
        context.arc(x, y, particleRadius, 0, TAU)
        context.fill()
      }
    }

    const vignette = context.createRadialGradient(
      centerX,
      centerY,
      maxRadius * 0.28,
      centerX,
      centerY,
      maxRadius * 1.28,
    )
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.52)')
    context.fillStyle = vignette
    context.fillRect(0, 0, width, height)
  }
}
