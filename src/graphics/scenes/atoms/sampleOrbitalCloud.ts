import {
  densityToColor,
  normalizeSuperpositionCoefficients,
  superpositionProbabilityDensity,
  type CartesianPoint,
  type QuantumState,
} from './hydrogenPhysics'

export interface OrbitalSamplePoint extends CartesianPoint {
  density: number
  color: [number, number, number]
}

export interface SampleOrbitalCloudOptions {
  states: QuantumState[]
  targetCount: number
  /** Large envelope — must exceed the natural |ψ|² support so no geometric clipping occurs. */
  sampleRadius: number
  maxAttemptsMultiplier?: number
}

function randomPointInCube(radius: number): CartesianPoint {
  return {
    x: (Math.random() * 2 - 1) * radius,
    y: (Math.random() * 2 - 1) * radius,
    z: (Math.random() * 2 - 1) * radius,
  }
}

function estimateMaxDensity(states: QuantumState[], radius: number): number {
  const gridSteps = 22
  let maxDensity = 0
  const step = (2 * radius) / gridSteps

  for (let ix = 0; ix <= gridSteps; ix += 1) {
    for (let iy = 0; iy <= gridSteps; iy += 1) {
      for (let iz = 0; iz <= gridSteps; iz += 1) {
        const point = {
          x: -radius + ix * step,
          y: -radius + iy * step,
          z: -radius + iz * step,
        }
        const density = superpositionProbabilityDensity(states, point)
        if (density > maxDensity) {
          maxDensity = density
        }
      }
    }
  }

  return maxDensity
}

/**
 * Pure |ψ|² rejection sampling. Particle positions follow the wave function only —
 * no spherical/cubic trimming afterward.
 */
export function sampleOrbitalCloud({
  states,
  targetCount,
  sampleRadius,
  maxAttemptsMultiplier = 32,
}: SampleOrbitalCloudOptions): OrbitalSamplePoint[] {
  const normalizedStates = normalizeSuperpositionCoefficients(states)
  const maxDensity = estimateMaxDensity(normalizedStates, sampleRadius) * 1.02
  const samples: OrbitalSamplePoint[] = []
  const maxAttempts = targetCount * maxAttemptsMultiplier
  let attempts = 0

  while (samples.length < targetCount && attempts < maxAttempts) {
    attempts += 1
    const point = randomPointInCube(sampleRadius)
    const density = superpositionProbabilityDensity(normalizedStates, point)
    if (Math.random() * maxDensity > density) {
      continue
    }

    samples.push({
      ...point,
      density,
      color: densityToColor(density, maxDensity),
    })
  }

  return samples
}

function percentileDensity(samples: OrbitalSamplePoint[], percentile: number): number {
  const sorted = samples.map((sample) => sample.density).sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * percentile))
  return sorted[index] ?? 1
}

/** Recolor samples using a percentile reference so lobe cores read as bright white. */
export function recolorOrbitalSamples(
  samples: OrbitalSamplePoint[],
  percentile = 0.985,
): OrbitalSamplePoint[] {
  const referenceDensity = percentileDensity(samples, percentile)
  return samples.map((sample) => ({
    ...sample,
    color: densityToColor(sample.density, referenceDensity),
  }))
}

/** Suggested envelope radius from principal quantum number (atomic units). */
export function sampleRadiusForStates(states: QuantumState[]): number {
  const maxN = Math.max(...states.map((state) => state.n))
  return maxN * maxN * 2.2
}
