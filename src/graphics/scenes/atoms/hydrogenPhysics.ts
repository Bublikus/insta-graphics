/**
 * Hydrogen atom wave functions in atomic units (ℏ = m_e = e = 4πε₀ = 1, a₀ = 1).
 * ψ_nlm(r, θ, φ) = R_nl(r) · Y_lm(θ, φ), normalized on ℝ³.
 */

export interface QuantumState {
  n: number
  l: number
  m: number
  /** Complex coefficient in superposition */
  coeffRe: number
  coeffIm: number
}

export interface CartesianPoint {
  x: number
  y: number
  z: number
}

export interface SphericalPoint {
  r: number
  theta: number
  phi: number
}

/** Right-hand rotation about the Y axis: r' = R_y(θ) r (atomic units, Y up). */
export function rotateCartesianAboutY(
  { x, y, z }: CartesianPoint,
  angle: number,
): CartesianPoint {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return {
    x: x * cos + z * sin,
    y,
    z: -x * sin + z * cos,
  }
}

const BOHR_RADIUS = 1

export function cartesianToSpherical({ x, y, z }: CartesianPoint): SphericalPoint {
  const r = Math.hypot(x, y, z)
  if (r < 1e-12) {
    return { r: 0, theta: 0, phi: 0 }
  }

  const theta = Math.acos(Math.max(-1, Math.min(1, z / r)))
  const phi = Math.atan2(y, x)
  return { r, theta, phi }
}

function factorial(n: number): number {
  let value = 1
  for (let index = 2; index <= n; index += 1) {
    value *= index
  }
  return value
}

function associatedLaguerre(n: number, alpha: number, x: number): number {
  if (n === 0) {
    return 1
  }
  if (n === 1) {
    return 1 + alpha - x
  }

  let previous = 1
  let current = 1 + alpha - x
  for (let index = 2; index <= n; index += 1) {
    const next =
      ((2 * index + alpha - 1 - x) * current - (index + alpha - 1) * previous) / index
    previous = current
    current = next
  }
  return current
}

function associatedLegendre(l: number, mAbs: number, x: number): number {
  const m = mAbs
  if (l === m) {
    let pmm = 1
    if (m > 0) {
      const root = Math.sqrt(Math.max(0, 1 - x * x))
      pmm = Math.pow(-root, m)
      for (let index = 1; index <= m; index += 1) {
        pmm *= 2 * index - 1
      }
    }
    return pmm
  }

  if (l === m + 1) {
    return x * (2 * m + 1) * associatedLegendre(m, m, x)
  }

  const pmp1 = x * (2 * m + 1) * associatedLegendre(m, m, x)
  let previous = associatedLegendre(m, m, x)
  let current = pmp1
  for (let ell = m + 2; ell <= l; ell += 1) {
    const next = ((2 * ell - 1) * x * current - (ell + m - 1) * previous) / (ell - m)
    previous = current
    current = next
  }
  return current
}

function radialNormalization(n: number, l: number): number {
  const a = BOHR_RADIUS
  const prefactor = Math.sqrt(
    ((2 / (n * a)) ** 3 * factorial(n - l - 1)) / (2 * n * factorial(n + l)),
  )
  return prefactor
}

/** Radial wavefunction R_nl(r) for hydrogen. */
export function radialWavefunction(n: number, l: number, r: number): number {
  if (r < 0 || n < 1 || l < 0 || l >= n) {
    return 0
  }

  const a = BOHR_RADIUS
  const rho = (2 * r) / (n * a)
  const normalization = radialNormalization(n, l)
  const laguerre = associatedLaguerre(n - l - 1, 2 * l + 1, rho)
  return normalization * Math.exp(-rho / 2) * rho ** l * laguerre
}

function sphericalHarmonicNorm(l: number, mAbs: number): number {
  return Math.sqrt(((2 * l + 1) * factorial(l - mAbs)) / (4 * Math.PI * factorial(l + mAbs)))
}

/** Complex spherical harmonic Y_l^m(θ, φ) — scipy-compatible convention. */
export function sphericalHarmonic(l: number, m: number, theta: number, phi: number): {
  re: number
  im: number
} {
  const mAbs = Math.abs(m)
  if (l < mAbs) {
    return { re: 0, im: 0 }
  }

  const cosTheta = Math.cos(theta)
  const legendre = associatedLegendre(l, mAbs, cosTheta)
  const norm = sphericalHarmonicNorm(l, mAbs)
  const amplitude = norm * legendre

  if (m >= 0) {
    return {
      re: amplitude * Math.cos(m * phi),
      im: amplitude * Math.sin(m * phi),
    }
  }

  // Y_l^{-|m|} = (-1)^|m| · conj(Y_l^{|m|})
  const sign = mAbs % 2 === 0 ? 1 : -1
  return {
    re: sign * amplitude * Math.cos(mAbs * phi),
    im: -sign * amplitude * Math.sin(mAbs * phi),
  }
}

function complexMultiply(
  aRe: number,
  aIm: number,
  bRe: number,
  bIm: number,
): { re: number; im: number } {
  return {
    re: aRe * bRe - aIm * bIm,
    im: aRe * bIm + aIm * bRe,
  }
}

function complexAdd(
  aRe: number,
  aIm: number,
  bRe: number,
  bIm: number,
): { re: number; im: number } {
  return { re: aRe + bRe, im: aIm + bIm }
}

/** Full hydrogen eigenstate ψ_nlm at Cartesian coordinates. */
export function hydrogenWavefunction(
  n: number,
  l: number,
  m: number,
  point: CartesianPoint,
): { re: number; im: number } {
  const { r, theta, phi } = cartesianToSpherical(point)
  const radial = radialWavefunction(n, l, r)
  const angular = sphericalHarmonic(l, m, theta, phi)
  return complexMultiply(radial, 0, angular.re, angular.im)
}

/** |ψ|² for a normalized superposition of hydrogen eigenstates. */
export function superpositionProbabilityDensity(
  states: QuantumState[],
  point: CartesianPoint,
  time = 0,
): number {
  let psiRe = 0
  let psiIm = 0

  for (const state of states) {
    const energy = -0.5 / (state.n * state.n)
    const phase = Math.cos(energy * time)
    const phaseIm = Math.sin(energy * time)
    const base = hydrogenWavefunction(state.n, state.l, state.m, point)
    const rotated = complexMultiply(base.re, base.im, phase, phaseIm)
    const weighted = complexMultiply(rotated.re, rotated.im, state.coeffRe, state.coeffIm)
    const sum = complexAdd(psiRe, psiIm, weighted.re, weighted.im)
    psiRe = sum.re
    psiIm = sum.im
  }

  return psiRe * psiRe + psiIm * psiIm
}

/** Normalize superposition coefficients so ∫|ψ|² d³r = 1 (Monte Carlo estimate). */
export function normalizeSuperpositionCoefficients(states: QuantumState[]): QuantumState[] {
  const sampleCount = 6000
  const radius = Math.max(...states.map((state) => state.n * state.n)) * 3.5
  let integralEstimate = 0

  for (let index = 0; index < sampleCount; index += 1) {
    const x = (Math.random() * 2 - 1) * radius
    const y = (Math.random() * 2 - 1) * radius
    const z = (Math.random() * 2 - 1) * radius
    integralEstimate += superpositionProbabilityDensity(states, { x, y, z })
  }

  const volume = (2 * radius) ** 3
  const norm = Math.sqrt((integralEstimate * volume) / sampleCount)
  if (norm < 1e-12) {
    return states
  }

  return states.map((state) => ({
    ...state,
    coeffRe: state.coeffRe / norm,
    coeffIm: state.coeffIm / norm,
  }))
}

/** Map probability density to RGB heat colors (white core → purple halo). */
export function densityToColor(density: number, referenceDensity: number): [number, number, number] {
  const normalized = density / Math.max(referenceDensity, 1e-12)
  const t = Math.max(0, Math.min(1, Math.log1p(normalized * 18) / Math.log1p(18)))

  if (t > 0.88) {
    const blend = (t - 0.88) / 0.12
    return [1, 0.94 + blend * 0.06, 0.82 + blend * 0.18]
  }
  if (t > 0.62) {
    const blend = (t - 0.62) / 0.26
    return [1, 0.55 + blend * 0.39, 0.12 + blend * 0.7]
  }
  if (t > 0.38) {
    const blend = (t - 0.38) / 0.24
    return [0.98 + blend * 0.02, 0.14 + blend * 0.41, 0.36 + blend * 0.42]
  }
  if (t > 0.14) {
    const blend = (t - 0.14) / 0.24
    return [0.38 + blend * 0.6, 0.06 + blend * 0.08, 0.58 + blend * 0.1]
  }

  const blend = t / 0.14
  return [0.14 + blend * 0.24, 0.03 + blend * 0.03, 0.24 + blend * 0.34]
}

/** Screenshot-matched palette with stronger orange/red mid-tones and white-hot cores. */
export function densityToColorRefined(
  density: number,
  referenceDensity: number,
): [number, number, number] {
  const normalized = density / Math.max(referenceDensity, 1e-12)
  const t = Math.max(0, Math.min(1, Math.log1p(normalized * 24) / Math.log1p(24)))

  if (t > 0.9) {
    const blend = (t - 0.9) / 0.1
    return [1, 0.96 + blend * 0.04, 0.84 + blend * 0.16]
  }
  if (t > 0.68) {
    const blend = (t - 0.68) / 0.22
    return [1, 0.68 + blend * 0.28, 0.08 + blend * 0.52]
  }
  if (t > 0.42) {
    const blend = (t - 0.42) / 0.26
    return [1, 0.22 + blend * 0.46, 0.06 + blend * 0.38]
  }
  if (t > 0.18) {
    const blend = (t - 0.18) / 0.24
    return [0.94 + blend * 0.06, 0.1 + blend * 0.12, 0.26 + blend * 0.56]
  }

  const blend = t / 0.18
  return [0.2 + blend * 0.74, 0.04 + blend * 0.06, 0.3 + blend * 0.32]
}
