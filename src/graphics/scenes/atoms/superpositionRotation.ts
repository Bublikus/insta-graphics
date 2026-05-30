import type { QuantumState } from './hydrogenPhysics'

type Complex = { re: number; im: number }

function complexAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im }
}

function complexMultiply(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }
}

function identityMatrix(dimension: number): Complex[][] {
  return Array.from({ length: dimension }, (_, row) =>
    Array.from({ length: dimension }, (_, col) =>
      row === col ? { re: 1, im: 0 } : { re: 0, im: 0 },
    ),
  )
}

function multiplyMatrices(a: Complex[][], b: Complex[][]): Complex[][] {
  const rows = a.length
  const cols = b[0]?.length ?? 0
  const inner = b.length
  const result: Complex[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ re: 0, im: 0 })),
  )

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      let sum: Complex = { re: 0, im: 0 }
      for (let index = 0; index < inner; index += 1) {
        sum = complexAdd(sum, complexMultiply(a[row]?.[index] ?? { re: 0, im: 0 }, b[index]?.[col] ?? { re: 0, im: 0 }))
      }
      result[row][col] = sum
    }
  }

  return result
}

function addMatrices(a: Complex[][], b: Complex[][]): Complex[][] {
  return a.map((row, rowIndex) =>
    row.map((value, colIndex) =>
      complexAdd(value, b[rowIndex]?.[colIndex] ?? { re: 0, im: 0 }),
    ),
  )
}

function scaleMatrix(matrix: Complex[][], scalar: Complex): Complex[][] {
  return matrix.map((row) => row.map((value) => complexMultiply(value, scalar)))
}

/** Angular momentum L_y in the |l, m⟩ basis (ℏ = 1). */
function buildLyMatrix(l: number): Complex[][] {
  const dimension = 2 * l + 1
  const matrix: Complex[][] = Array.from({ length: dimension }, () =>
    Array.from({ length: dimension }, () => ({ re: 0, im: 0 })),
  )

  for (let m = -l; m <= l; m += 1) {
    const row = m + l
    if (m < l) {
      const raising = 0.5 * Math.sqrt(l * (l + 1) - m * (m + 1))
      matrix[row + 1][row] = { re: 0, im: -raising }
    }
    if (m > -l) {
      const lowering = 0.5 * Math.sqrt(l * (l + 1) - m * (m - 1))
      matrix[row - 1][row] = { re: 0, im: lowering }
    }
  }

  return matrix
}

/** R_y(β) = exp(-i β L_y) in the |l, m⟩ coefficient space. */
function rotationOperatorAboutY(l: number, beta: number): Complex[][] {
  const dimension = 2 * l + 1
  const ly = buildLyMatrix(l)
  const generator = scaleMatrix(ly, { re: 0, im: -beta })
  let seriesTerm = identityMatrix(dimension)
  let sum = identityMatrix(dimension)

  for (let order = 1; order <= 22; order += 1) {
    seriesTerm = multiplyMatrices(
      seriesTerm,
      scaleMatrix(generator, { re: 1 / order, im: 0 }),
    )
    sum = addMatrices(sum, seriesTerm)
  }

  return sum
}

const rotationCache = new Map<string, Complex[][]>()

function getCachedRotationOperator(l: number, beta: number): Complex[][] {
  const key = `${l}:${beta.toFixed(4)}`
  const cached = rotationCache.get(key)
  if (cached !== undefined) {
    return cached
  }

  const matrix = rotationOperatorAboutY(l, beta)
  rotationCache.set(key, matrix)
  if (rotationCache.size > 120) {
    const firstKey = rotationCache.keys().next().value
    if (firstKey !== undefined) {
      rotationCache.delete(firstKey)
    }
  }
  return matrix
}

/**
 * Apply R_y(β) to superposition coefficients:
 * |ψ(β)⟩ = R_y(β)|ψ⟩ with c'_{m'} = Σ_m exp(-iβL_y)_{m',m} c_m
 */
export function rotateSuperpositionAboutY(
  states: QuantumState[],
  beta: number,
): QuantumState[] {
  if (states.length === 0) {
    return []
  }

  const { n, l } = states[0]
  const coefficients = new Map<number, Complex>()
  for (const state of states) {
    coefficients.set(state.m, { re: state.coeffRe, im: state.coeffIm })
  }

  const rotation = getCachedRotationOperator(l, beta)
  const rotated: QuantumState[] = []

  for (let mPrime = -l; mPrime <= l; mPrime += 1) {
    let coefficient: Complex = { re: 0, im: 0 }
    for (let m = -l; m <= l; m += 1) {
      const input = coefficients.get(m) ?? { re: 0, im: 0 }
      const operator = rotation[mPrime + l]?.[m + l] ?? { re: 0, im: 0 }
      coefficient = complexAdd(coefficient, complexMultiply(operator, input))
    }

    if (Math.hypot(coefficient.re, coefficient.im) > 1e-8) {
      rotated.push({
        n,
        l,
        m: mPrime,
        coeffRe: coefficient.re,
        coeffIm: coefficient.im,
      })
    }
  }

  return rotated
}
