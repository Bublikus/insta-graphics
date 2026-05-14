import type { BaseGraphicScene } from './base/BaseGraphicScene'
import { DemoGradientScene } from './scenes/demo-gradient/DemoGradientScene'
import { DemoGradientMemoryDriftScene } from './scenes/demo-gradient/DemoGradientMemoryDriftScene'
import { GlassCubeBounceScene } from './scenes/glass-cube-bounce/GlassCubeBounceScene'
import { HypnoticPulseVortexScene } from './scenes/hypnotic-family/HypnoticPulseVortexScene'
import { PixelMoireTunnelScene } from './scenes/hypnotic-family/PixelMoireTunnelScene'

interface GraphicLeafNode {
  id: string
  title: string
  description: string
  createScene: () => BaseGraphicScene
}

export interface GraphicGroupNode {
  id: string
  title: string
  description: string
  children: GraphicNode[]
}

export type GraphicNode = GraphicLeafNode | GraphicGroupNode

export interface GraphicDefinition extends GraphicLeafNode {
  parentId: string | null
  depth: number
}

function isGraphicGroupNode(node: GraphicNode): node is GraphicGroupNode {
  return 'children' in node
}

export const GRAPHIC_TREE: GraphicNode[] = [
  {
    id: 'demo-gradient-family',
    title: 'Demo Gradient Family',
    description: 'Neon gradient variations with drifting particle personalities.',
    children: [
      {
        id: 'demo-gradient',
        title: 'Demo Gradient',
        description: 'Animated neon gradient bands and particles.',
        createScene: () => new DemoGradientScene(),
      },
      {
        id: 'demo-gradient-memory-drift',
        title: 'Demo Gradient: Memory Drift',
        description:
          'A deeper D-like neon drift with memorable floating particles and layered wave ribbons.',
        createScene: () => new DemoGradientMemoryDriftScene(),
      },
    ],
  },
  {
    id: 'glass-cube-bounce',
    title: 'Glass Cube Bounce',
    description:
      'Reflective glass cube with five textured spheres, 3D collisions, and realistic bouncing physics.',
    createScene: () => new GlassCubeBounceScene(),
  },
  {
    id: 'hypnotic-family',
    title: 'Hypnotic Family',
    description: 'Related tunnel/vortex loops sharing a common hypnotic base.',
    children: [
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
    ],
  },
]

function flattenGraphicTree(
  nodes: GraphicNode[],
  parentId: string | null = null,
  depth = 0,
): GraphicDefinition[] {
  return nodes.flatMap((node) => {
    if (isGraphicGroupNode(node)) {
      return flattenGraphicTree(node.children, node.id, depth + 1)
    }

    return [
      {
        ...node,
        parentId,
        depth,
      },
    ]
  })
}

export const GRAPHICS: GraphicDefinition[] = flattenGraphicTree(GRAPHIC_TREE)

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
