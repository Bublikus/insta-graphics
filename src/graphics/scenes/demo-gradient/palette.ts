export const COLOR_STOPS = ['#120458', '#2d0872', '#6a00a8', '#ff3d81', '#ffa600'] as const

export function withAlpha(hexColor: string, alpha: number): string {
  const safeAlpha = Math.min(1, Math.max(0, alpha))
  const alphaHex = Math.round(safeAlpha * 255)
    .toString(16)
    .padStart(2, '0')
  return `${hexColor}${alphaHex}`
}
