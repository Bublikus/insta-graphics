import type { BaseGraphicScene } from './base/BaseGraphicScene'
import { DemoGradientScene } from './scenes/demo-gradient/DemoGradientScene'
import { DemoGradientMemoryDriftScene } from './scenes/demo-gradient/DemoGradientMemoryDriftScene'
import { DemoGradientVerticalSpinScene } from './scenes/demo-gradient/DemoGradientVerticalSpinScene'
import { FallingBallsGravityFillScene } from './scenes/falling-balls/FallingBallsGravityFillScene'
import { FallingBallsStaticScene } from './scenes/falling-balls/FallingBallsStaticScene'
import { GlassCubeBounceScene } from './scenes/glass-cube-bounce/GlassCubeBounceScene'
import { HypnoticPulseVortexScene } from './scenes/hypnotic-family/HypnoticPulseVortexScene'
import { PixelMoireTunnelScene } from './scenes/hypnotic-family/PixelMoireTunnelScene'
import { ThreeDWormsNeonPulseScene } from './scenes/three-d-worms/ThreeDWormsNeonPulseScene'
import { ThreeDWormsNeonRushScene } from './scenes/three-d-worms/ThreeDWormsNeonRushScene'
import { ThreeDWormsScene } from './scenes/three-d-worms/ThreeDWormsScene'
import { ThreeDWormsThermalDepthScene } from './scenes/three-d-worms/ThreeDWormsThermalDepthScene'
import { ThreeDWormsThermalNeonBordersScene } from './scenes/three-d-worms/ThreeDWormsThermalNeonBordersScene'

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
      {
        id: 'demo-gradient-vertical-spin',
        title: 'Demo Gradient: Vertical Spin Drift',
        description:
          'Vertical particle lift with rotating shards, luminous trails, and neon beam accents tuned for portrait framing.',
        createScene: () => new DemoGradientVerticalSpinScene(),
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
    id: 'falling-balls-family',
    title: 'Falling Balls',
    description: 'Gravity-focused chamber scenes with static setup and dense natural sphere filling.',
    children: [
      {
        id: 'falling-balls-static-chamber',
        title: 'Falling Balls: Static Chamber',
        description:
          'The same 3D worms chamber setup as a clean baseline scene with no dynamic actors.',
        createScene: () => new FallingBallsStaticScene(),
      },
      {
        id: 'falling-balls-gravity-fill',
        title: 'Falling Balls: Gravity Fill',
        description:
          'Small balls spawn from the ceiling center and naturally collide under gravity until filling roughly half the chamber.',
        createScene: () => new FallingBallsGravityFillScene(),
      },
    ],
  },
  {
    id: 'three-d-worms-family',
    title: '3D Worms Family',
    description: '3D worms base scene plus expressive neon and thermal sequel variations.',
    children: [
      {
        id: 'three-d-worms',
        title: '3D Worms',
        description:
          'Three pixel-styled worms moving randomly through a hidden 9x16x9 cube coordinate volume in portrait depth.',
        createScene: () => new ThreeDWormsScene(),
      },
      {
        id: 'three-d-worms-neon-pulse',
        title: '3D Worms: Neon Pulse',
        description:
          'A more cinematic 3D worms sequel with drifting neon energy planes, ambient spark particles, and dynamic camera motion.',
        createScene: () => new ThreeDWormsNeonPulseScene(),
      },
      {
        id: 'three-d-worms-thermal-depth',
        title: '3D Worms: Thermal Depth',
        description:
          'Warmth-focused sequel with layered thermal depth planes, ember particles, and strong front-to-back heat cues.',
        createScene: () => new ThreeDWormsThermalDepthScene(),
      },
      {
        id: 'three-d-worms-neon-rush',
        title: '3D Worms: Neon Rush',
        description:
          'High-energy neon sequel with expressive chroma ribbons, pulse bars, and vivid particle shards for maximum visibility.',
        createScene: () => new ThreeDWormsNeonRushScene(),
      },
      {
        id: 'three-d-worms-thermal-neon-borders',
        title: '3D Worms: Thermal Neon Borders',
        description:
          'Warm neon sequel where all chamber borders glow with layered thin neon outlines for extra visibility and style.',
        createScene: () => new ThreeDWormsThermalNeonBordersScene(),
      },
    ],
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
