export interface HypnoticVariantCore {
  id: string
  ringCount: number
  minBreathScale: number
  maxBreathScale: number
  breathCyclesPerLoop: number
  innerCyclesPerLoop: number
  outerCyclesPerLoop: number
  rippleCenters: number[]
  glowStrength: number
  hueDriftDeg: number
}

export interface HypnoticRingSpec {
  radiusRatio: number
  particleCount: number
  direction: 1 | -1
  cyclesPerLoop: number
  phaseOffset: number
  hueOffset: number
}

interface RingBuildOptions {
  radiusStart: number
  radiusSpan: number
  minParticles: number
  particleSpan: number
  easingExponent: number
  phaseSpan: number
  hueSpan: number
}

interface LoopMotionOptions {
  baseHue: number
  brightnessPhaseOffsetRad: number
}

export interface LoopMotionState {
  loopProgress: number
  breathScale: number
  brightnessBreathProgress: number
  baseHue: number
}

const TAU = Math.PI * 2
const LOOP_MS = 12_000

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function lerp(min: number, max: number, progress: number): number {
  return min + (max - min) * progress
}

export function hueToColor(hueDeg: number, alpha: number, lightnessPct = 72): string {
  const hue = ((hueDeg % 360) + 360) % 360
  return `hsla(${hue.toFixed(1)} 96% ${lightnessPct}% / ${clamp01(alpha).toFixed(3)})`
}

export function buildHypnoticRings(
  ringCount: number,
  variant: Pick<HypnoticVariantCore, 'innerCyclesPerLoop' | 'outerCyclesPerLoop'>,
  options: RingBuildOptions,
): HypnoticRingSpec[] {
  return Array.from({ length: ringCount }, (_, index) => {
    const progress = ringCount <= 1 ? 0 : index / (ringCount - 1)
    const easedProgress = Math.pow(progress, options.easingExponent)
    return {
      radiusRatio: options.radiusStart + easedProgress * options.radiusSpan,
      particleCount: Math.max(options.minParticles, Math.round(options.minParticles + easedProgress * options.particleSpan)),
      direction: index % 2 === 0 ? 1 : -1,
      cyclesPerLoop: Math.max(
        1,
        Math.round(
          variant.innerCyclesPerLoop +
            (variant.outerCyclesPerLoop - variant.innerCyclesPerLoop) * easedProgress,
        ),
      ),
      phaseOffset: progress * options.phaseSpan,
      hueOffset: progress * options.hueSpan,
    }
  })
}

export function buildLoopMotionState(
  elapsedMs: number,
  variant: Pick<
    HypnoticVariantCore,
    'breathCyclesPerLoop' | 'minBreathScale' | 'maxBreathScale' | 'hueDriftDeg'
  >,
  options: LoopMotionOptions,
): LoopMotionState {
  const loopProgress = (elapsedMs % LOOP_MS) / LOOP_MS
  const breathProgress = (Math.sin(loopProgress * TAU * variant.breathCyclesPerLoop) + 1) * 0.5
  const brightnessBreathProgress =
    (Math.sin(
      loopProgress * TAU * variant.breathCyclesPerLoop + options.brightnessPhaseOffsetRad,
    ) +
      1) *
    0.5

  return {
    loopProgress,
    breathScale: lerp(variant.minBreathScale, variant.maxBreathScale, breathProgress),
    brightnessBreathProgress,
    baseHue: options.baseHue + Math.sin(loopProgress * TAU) * variant.hueDriftDeg,
  }
}

export function computeRippleBoost(
  ringProgress: number,
  loopProgress: number,
  rippleCenters: number[],
  spatialScale: number,
  temporalScale: number,
  weight: number,
): number {
  let rippleBoost = 0
  for (const center of rippleCenters) {
    const spatialDistance = Math.abs(ringProgress - center)
    const wrappedSpatialDistance = Math.min(spatialDistance, 1 - spatialDistance)
    const spatialFalloff = Math.exp(-Math.pow(wrappedSpatialDistance * spatialScale, 2))
    const temporalDistance = Math.min(Math.abs(loopProgress - center), 1 - Math.abs(loopProgress - center))
    const temporalFalloff = Math.exp(-Math.pow(temporalDistance * temporalScale, 2))
    rippleBoost += weight * spatialFalloff * temporalFalloff
  }
  return rippleBoost
}
