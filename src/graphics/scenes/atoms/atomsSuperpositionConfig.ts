import type { QuantumState } from './hydrogenPhysics'

export interface AtomsSuperpositionSceneConfig {
  id: string
  superpositionStates: QuantumState[]
  particleCount: number
  bohrSceneScale: number
  targetOrbitalRadius: number
  viewMargin: number
  pointSize: number
  cameraZoom: number
  cameraElevation: number
  superpositionYAngularVelocity: number
  metropolisStep: number
  metropolisBatch: number
  recolorPercentile: number
  weightCutoff: number
  visibleRadiusFactor: number
  pointsOpacity: number
  useRefinedColors: boolean
  /**
   * When true, the crisp rejection-sampled cloud is rigidly rotated about Y each frame.
   * For a single-l superposition this is exactly R_y(β)|ψ⟩, so the shape stays sharp.
   * When false, particles drift via Metropolis toward the evolving |ψ(β)|².
   */
  rigidYRotationMode: boolean
  /**
   * Differential ("vortex") rotation from the quantum probability current.
   * Azimuthal velocity v_φ = ℏm/(m_e·s) ⇒ angular velocity ω(s) = ℏm/(m_e·s²),
   * regularized with a Rankine-style finite core. Takes precedence over the other modes.
   */
  vortexMode: boolean
  /** Center (maximum) angular velocity ω₀ in rad/s, reached inside the core. */
  vortexCenterAngularVelocity: number
  /** Core radius as a fraction of the cloud's characteristic cylindrical radius. */
  vortexCoreFraction: number
}

/** Original 5f superposition — baseline animation. */
export const HYDROGEN_SUPERPOSITION_ORIGINAL_CONFIG: AtomsSuperpositionSceneConfig = {
  id: 'original',
  superpositionStates: [
    { n: 5, l: 3, m: 2, coeffRe: 1, coeffIm: 0 },
    { n: 5, l: 3, m: -2, coeffRe: 1, coeffIm: 0 },
    { n: 5, l: 3, m: 0, coeffRe: 0.62, coeffIm: 0 },
    { n: 5, l: 3, m: 1, coeffRe: 0.42, coeffIm: 0 },
    { n: 5, l: 3, m: -1, coeffRe: -0.42, coeffIm: 0 },
  ],
  particleCount: 36000,
  bohrSceneScale: 0.21,
  targetOrbitalRadius: 1.35,
  viewMargin: 1.48,
  pointSize: 0.034,
  cameraZoom: 0.68,
  cameraElevation: Math.PI / 4,
  superpositionYAngularVelocity: 0.38,
  metropolisStep: 0.22,
  metropolisBatch: 9000,
  recolorPercentile: 0.985,
  weightCutoff: 0.015,
  visibleRadiusFactor: 0.8,
  pointsOpacity: 0.92,
  useRefinedColors: false,
  rigidYRotationMode: false,
  vortexMode: false,
  vortexCenterAngularVelocity: 0,
  vortexCoreFraction: 0.2,
}

/**
 * Refined 5f superposition: same proven state mix as the original (paired upper lobes,
 * horizontal toroidal belt with central slit, lower bulb), rendered denser and crisper.
 * Keeps the vivid white→yellow→orange→magenta→purple palette of the prototype.
 */
export const HYDROGEN_SUPERPOSITION_REFINED_CONFIG: AtomsSuperpositionSceneConfig = {
  id: 'refined',
  superpositionStates: [
    { n: 5, l: 3, m: 2, coeffRe: 1, coeffIm: 0 },
    { n: 5, l: 3, m: -2, coeffRe: 1, coeffIm: 0 },
    { n: 5, l: 3, m: 0, coeffRe: 0.62, coeffIm: 0 },
    { n: 5, l: 3, m: 1, coeffRe: 0.42, coeffIm: 0 },
    { n: 5, l: 3, m: -1, coeffRe: -0.42, coeffIm: 0 },
  ],
  particleCount: 52000,
  bohrSceneScale: 0.21,
  targetOrbitalRadius: 1.35,
  viewMargin: 1.48,
  pointSize: 0.03,
  cameraZoom: 0.68,
  cameraElevation: Math.PI / 4,
  superpositionYAngularVelocity: 0.34,
  metropolisStep: 0.18,
  metropolisBatch: 13000,
  recolorPercentile: 0.99,
  weightCutoff: 0.01,
  visibleRadiusFactor: 0.8,
  pointsOpacity: 0.95,
  useRefinedColors: false,
  rigidYRotationMode: true,
  vortexMode: true,
  vortexCenterAngularVelocity: 0.75,
  vortexCoreFraction: 0.22,
}
