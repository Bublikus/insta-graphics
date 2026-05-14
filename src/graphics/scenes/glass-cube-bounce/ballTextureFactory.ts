import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

function hashNoise(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453
  return x - Math.floor(x)
}

export function createBallTexture(baseColor: string, accentColor: string): CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context === null) {
    throw new Error('Failed to create canvas 2D context for ball texture')
  }

  const gradient = context.createRadialGradient(
    size * 0.34,
    size * 0.3,
    size * 0.1,
    size * 0.5,
    size * 0.5,
    size * 0.62,
  )
  gradient.addColorStop(0, '#ffffff')
  gradient.addColorStop(0.25, accentColor)
  gradient.addColorStop(0.9, baseColor)
  gradient.addColorStop(1, '#060608')
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)

  context.globalAlpha = 0.3
  context.strokeStyle = '#ffffff'
  context.lineWidth = 14
  for (let i = 0; i < 12; i += 1) {
    const y = (i / 11) * size
    context.beginPath()
    context.moveTo(0, y)
    context.bezierCurveTo(size * 0.25, y + 30, size * 0.75, y - 30, size, y)
    context.stroke()
  }

  context.globalAlpha = 0.22
  for (let i = 0; i < 260; i += 1) {
    const rx = hashNoise(i + 1) * size
    const ry = hashNoise((i + 1) * 3.2) * size
    const radius = 1.4 + hashNoise((i + 1) * 5.7) * 2.8
    context.beginPath()
    context.fillStyle = i % 7 === 0 ? '#ffffff' : accentColor
    context.arc(rx, ry, radius, 0, Math.PI * 2)
    context.fill()
  }

  context.globalAlpha = 0.75
  context.fillStyle = 'rgba(255,255,255,0.35)'
  context.beginPath()
  context.ellipse(size * 0.33, size * 0.26, size * 0.12, size * 0.08, -0.4, 0, Math.PI * 2)
  context.fill()

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}
