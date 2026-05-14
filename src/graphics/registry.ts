import type { BaseGraphicScene } from './base/BaseGraphicScene'
import { DemoGradientScene } from './scenes/demo-gradient/DemoGradientScene'
import { GlassCubeBounceScene } from './scenes/glass-cube-bounce/GlassCubeBounceScene'
import { HypnoticPulseVortexScene } from './scenes/hypnotic-pulse-vortex/HypnoticPulseVortexScene'
import { PixelMoireTunnelScene } from './scenes/pixel-moire-tunnel/PixelMoireTunnelScene'

export interface GraphicDefinition {
  id: string
  title: string
  description: string
  createScene: () => BaseGraphicScene
}

export const GRAPHICS: GraphicDefinition[] = [
  {
    id: 'demo-gradient',
    title: 'Demo Gradient',
    description: 'Animated neon gradient bands and particles.',
    createScene: () => new DemoGradientScene(),
  },
  {
    id: 'glass-cube-bounce',
    title: 'Glass Cube Bounce',
    description:
      'Reflective glass cube with five textured spheres, 3D collisions, and realistic bouncing physics.',
    createScene: () => new GlassCubeBounceScene(),
  },
  {
    id: 'hypnotic-pulse-vortex',
    title: 'Hypnotic Pulse Vortex',
    description:
      'Concentric neon rings with alternating rotations, breathing pulses, and ripple accents tuned for an addictive loop.',
    createScene: () => new HypnoticPulseVortexScene(),
  },
  {
    id: 'pixel-moire-tunnel',
    title: 'Pixel Moire Tunnel',
    description:
      'Pixelized square-ring tunnel with alternating drift, breathing cadence, and ripple surges for a retro hypnotic loop.',
    createScene: () => new PixelMoireTunnelScene(),
  },
]

function getFirstGraphic(): GraphicDefinition {
  const firstGraphic = GRAPHICS[0]
  if (firstGraphic === undefined) {
    throw new Error('At least one graphic must be registered')
  }

  return firstGraphic
}

export const DEFAULT_GRAPHIC_ID = getFirstGraphic().id

export function getGraphicById(graphicId: string | undefined): GraphicDefinition {
  if (graphicId === undefined) {
    return getFirstGraphic()
  }

  return GRAPHICS.find((graphic) => graphic.id === graphicId) ?? getFirstGraphic()
}

export function getGraphicIndex(graphicId: string): number {
  return GRAPHICS.findIndex((graphic) => graphic.id === graphicId)
}

export function getPreviousGraphicId(graphicId: string): string {
  const currentIndex = getGraphicIndex(graphicId)
  if (currentIndex <= 0) {
    return GRAPHICS.at(-1)?.id ?? DEFAULT_GRAPHIC_ID
  }

  const previousGraphic = GRAPHICS[currentIndex - 1]
  return previousGraphic?.id ?? DEFAULT_GRAPHIC_ID
}

export function getNextGraphicId(graphicId: string): string {
  const currentIndex = getGraphicIndex(graphicId)
  if (currentIndex === -1 || currentIndex === GRAPHICS.length - 1) {
    return getFirstGraphic().id
  }

  const nextGraphic = GRAPHICS[currentIndex + 1]
  return nextGraphic?.id ?? DEFAULT_GRAPHIC_ID
}
