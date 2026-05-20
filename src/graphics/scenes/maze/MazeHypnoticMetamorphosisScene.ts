import {
  AmbientLight,
  BoxGeometry,
  Color,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PointLight,
} from 'three'
import { FallingBallsStaticScene } from '../falling-balls/FallingBallsStaticScene'

interface MazeLayer {
  group: Group
  speed: number
  direction: 1 | -1
  pulsePhase: number
}

const LAYER_COUNT = 7
const MAZE_SCALE = 0.34
const DEPTH_START = 0.55
const DEPTH_END = -3.35
const WORLD_FIT_SCALE = 0.78
const FLOW_SPEED = 0.74
const FLOW_RANGE = MAZE_SCALE * 1.75

const MAZE_PATTERNS: readonly number[][][] = [
  [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 1, 0, 1],
    [1, 1, 1, 1, 1, 1, 1],
  ],
  [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0, 1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1, 0, 1],
    [1, 1, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1, 0, 1],
    [1, 1, 1, 1, 1, 1, 1],
  ],
  [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1],
  ],
] as const

export class MazeHypnoticMetamorphosisScene extends FallingBallsStaticScene {
  private readonly layers: MazeLayer[] = []
  private readonly worldGroup = new Group()
  private readonly blockGeometry = new BoxGeometry(MAZE_SCALE * 0.82, MAZE_SCALE * 0.82, MAZE_SCALE * 0.86)
  private readonly capGeometry = new BoxGeometry(MAZE_SCALE * 0.58, MAZE_SCALE * 0.58, MAZE_SCALE * 0.42)
  private readonly disposableMaterials: MeshStandardMaterial[] = []
  private elapsedMs = 0

  protected override afterSetup(): void {
    super.afterSetup()
    this.scene.background = new Color('#02050f')

    const ambient = new AmbientLight('#95abff', 0.4)
    const leftGlow = new PointLight('#62ebff', 12, 16, 1.8)
    leftGlow.position.set(-2.2, 0.9, -5.8)
    const rightGlow = new PointLight('#ff6be0', 12, 16, 1.8)
    rightGlow.position.set(2.2, -0.9, -2.2)
    this.scene.add(ambient, leftGlow, rightGlow)

    this.worldGroup.scale.setScalar(WORLD_FIT_SCALE)
    this.scene.add(this.worldGroup)
    this.createMazeLayers()
  }

  protected override update(deltaMs: number): void {
    this.elapsedMs += deltaMs
    const t = this.elapsedMs * 0.001
    this.worldGroup.rotation.y = 0
    this.worldGroup.rotation.x = Math.sin(t * 0.3) * 0.08

    for (const layer of this.layers) {
      layer.group.rotation.z += layer.direction * layer.speed * deltaMs * 0.001
      layer.group.rotation.x = Math.sin(t * 0.42 + layer.pulsePhase) * 0.12
      const pulse = (Math.sin(t * 2.5 + layer.pulsePhase) + 1) * 0.5
      layer.group.scale.setScalar(0.9 + pulse * 0.18)

      for (const child of layer.group.children) {
        if (child instanceof Mesh && child.material instanceof MeshStandardMaterial) {
          const flowAxis = (child.userData['flowAxis'] as 'x' | 'y' | undefined) ?? 'x'
          const flowDirection = (child.userData['flowDirection'] as number | undefined) ?? 1
          const flowOffset = (child.userData['flowOffset'] as number | undefined) ?? 0
          const baseX = (child.userData['baseX'] as number | undefined) ?? child.position.x
          const baseY = (child.userData['baseY'] as number | undefined) ?? child.position.y
          const baseZ = (child.userData['baseZ'] as number | undefined) ?? child.position.z
          const linearFlow = flowOffset + t * FLOW_SPEED * flowDirection

          if (flowAxis === 'x') {
            child.position.x = this.wrapLinear(baseX + linearFlow, baseX, FLOW_RANGE)
            child.position.y = baseY
          } else {
            child.position.y = this.wrapLinear(baseY + linearFlow, baseY, FLOW_RANGE)
            child.position.x = baseX
          }
          child.position.z = baseZ

          const wavePhase = (child.userData['wavePhase'] as number | undefined) ?? 0
          const baseScale = (child.userData['baseScale'] as number | undefined) ?? 1
          const morphSeed = (child.userData['morphSeed'] as number | undefined) ?? 0
          const wave = (Math.sin(t * 4.2 + wavePhase) + 1) * 0.5
          const morph = (Math.sin(t * 1.85 + morphSeed) + 1) * 0.5
          const morphX = baseScale * (0.62 + wave * 0.52 + morph * 0.44)
          const morphY = baseScale * (0.62 + wave * 0.52 + (1 - morph) * 0.44)
          const morphZ = baseScale * (0.66 + Math.sin(t * 2.25 + morphSeed * 1.3) * 0.38)
          child.scale.set(morphX, morphY, morphZ)
          child.rotation.x = morph * 1.05
          child.rotation.y = (1 - morph) * 1.05
          child.rotation.z = Math.sin(t * 1.5 + morphSeed) * 0.48
          child.material.emissiveIntensity = 0.16 + pulse * 0.3 + wave * 0.28 + morph * 0.2
        }
      }
    }
  }

  protected override beforeDestroy(): void {
    for (const material of this.disposableMaterials) {
      material.dispose()
    }
    this.disposableMaterials.length = 0
    this.blockGeometry.dispose()
    this.capGeometry.dispose()
    this.layers.length = 0
    super.beforeDestroy()
  }

  private createMazeLayers(): void {
    for (let index = 0; index < LAYER_COUNT; index += 1) {
      const pattern = MAZE_PATTERNS[index % MAZE_PATTERNS.length]
      if (pattern === undefined) {
        continue
      }
      const layerT = index / Math.max(1, LAYER_COUNT - 1)
      const z = this.chamberCenter.z + MathUtils.lerp(DEPTH_START, DEPTH_END, layerT)
      const group = new Group()
      group.position.set(this.chamberCenter.x, this.chamberCenter.y, z)

      const hue = 0.54 + layerT * 0.32
      const color = new Color().setHSL(hue, 0.9, 0.64)
      const material = new MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.24,
        roughness: 0.18,
        metalness: 0.1,
      })
      this.disposableMaterials.push(material)

      const rows = pattern.length
      const cols = pattern[0]?.length ?? 0
      const startX = -(cols - 1) * MAZE_SCALE * 0.5
      const startY = (rows - 1) * MAZE_SCALE * 0.5

      for (let y = 0; y < rows; y += 1) {
        const row = pattern[y]
        if (row === undefined) {
          continue
        }
        for (let x = 0; x < cols; x += 1) {
          if ((row[x] ?? 0) !== 1) {
            continue
          }
          const block = new Mesh(this.blockGeometry, material)
          const blockX = startX + x * MAZE_SCALE
          const blockY = startY - y * MAZE_SCALE
          block.position.set(blockX, blockY, 0)
          block.userData['wavePhase'] = x * 0.7 + y * 0.9 + index * 0.55
          block.userData['baseScale'] = 1
          block.userData['baseX'] = blockX
          block.userData['baseY'] = blockY
          block.userData['baseZ'] = 0
          block.userData['flowAxis'] = (x + y + index) % 2 === 0 ? 'x' : 'y'
          block.userData['flowDirection'] = ((x + index) % 2 === 0 ? 1 : -1) as 1 | -1
          block.userData['flowOffset'] = (x - y) * MAZE_SCALE * 0.18
          block.userData['morphSeed'] = x * 0.9 + y * 0.5 + index * 0.7
          group.add(block)

          const capDepth = ((x + y + index) % 2 === 0 ? 1 : -1) * MAZE_SCALE * 0.34
          const cap = new Mesh(this.capGeometry, material)
          const capX = startX + x * MAZE_SCALE
          const capY = startY - y * MAZE_SCALE
          cap.position.set(capX, capY, capDepth)
          cap.userData['wavePhase'] = x * 0.8 + y * 0.65 + index * 0.75 + Math.PI * 0.4
          cap.userData['baseScale'] = 0.94
          cap.userData['baseX'] = capX
          cap.userData['baseY'] = capY
          cap.userData['baseZ'] = capDepth
          cap.userData['flowAxis'] = (x + y + index) % 2 === 0 ? 'y' : 'x'
          cap.userData['flowDirection'] = ((y + index) % 2 === 0 ? 1 : -1) as 1 | -1
          cap.userData['flowOffset'] = (y - x) * MAZE_SCALE * 0.18
          cap.userData['morphSeed'] = x * 0.55 + y * 0.9 + index * 0.83 + Math.PI * 0.2
          group.add(cap)
        }
      }

      this.worldGroup.add(group)
      this.layers.push({
        group,
        speed: MathUtils.lerp(0.16, 0.55, layerT),
        direction: index % 2 === 0 ? 1 : -1,
        pulsePhase: MathUtils.randFloat(0, Math.PI * 2),
      })
    }
  }

  private wrapLinear(value: number, center: number, halfRange: number): number {
    const fullRange = halfRange * 2
    let shifted = value - center + halfRange
    shifted = ((shifted % fullRange) + fullRange) % fullRange
    return shifted - halfRange + center
  }
}
