import {
  AmbientLight,
  BoxGeometry,
  Color,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PointLight,
} from 'three'
import { FallingBallsStaticScene } from '../falling-balls/FallingBallsStaticScene'

interface RainVoxel {
  mesh: Mesh<BoxGeometry, MeshStandardMaterial>
  laneX: number
  yOffset: number
  zPhase: number
  fallSpeed: number
  pulsePhase: number
}

const LANE_COUNT = 15
const DROPS_PER_LANE = 10
const VOXEL_SIZE = 0.24
const DEPTH_SPAN = 3.1

export class PuzzlesHypnoticRainFlowScene extends FallingBallsStaticScene {
  private readonly drops: RainVoxel[] = []
  private readonly dropGeometry = new BoxGeometry(VOXEL_SIZE, VOXEL_SIZE * 1.5, VOXEL_SIZE)
  private elapsedMs = 0

  protected override afterSetup(): void {
    super.afterSetup()
    this.scene.background = new Color('#030611')

    const ambient = new AmbientLight('#8096ff', 0.42)
    const leftGlow = new PointLight('#67e7ff', 12, 16, 1.7)
    leftGlow.position.set(-2.3, 1.5, -5.9)
    const rightGlow = new PointLight('#ff70d2', 12, 16, 1.7)
    rightGlow.position.set(2.3, -1.2, -2.2)
    this.scene.add(ambient, leftGlow, rightGlow)

    this.createRain()
  }

  protected override update(deltaMs: number): void {
    this.elapsedMs += deltaMs
    const t = this.elapsedMs * 0.001
    const wrapHeight = 8.2

    for (const drop of this.drops) {
      const fall = (t * drop.fallSpeed + drop.yOffset) % wrapHeight
      const y = this.chamberCenter.y + wrapHeight * 0.5 - fall
      const zWave = Math.sin(t * 1.6 + drop.zPhase) * DEPTH_SPAN
      const xWave = Math.cos(t * 1.1 + drop.zPhase * 0.7) * 0.16

      drop.mesh.position.set(drop.laneX + xWave, y, this.chamberCenter.z + zWave)

      const pulse = (Math.sin(t * 3.8 + drop.pulsePhase) + 1) * 0.5
      drop.mesh.scale.set(0.84 + pulse * 0.42, 0.86 + pulse * 0.9, 0.84 + pulse * 0.42)
      drop.mesh.rotation.x = pulse * 0.65
      drop.mesh.rotation.y = (1 - pulse) * 0.62
      drop.mesh.material.emissiveIntensity = 0.18 + pulse * 0.56
    }
  }

  protected override beforeDestroy(): void {
    for (const drop of this.drops) {
      drop.mesh.material.dispose()
    }
    this.drops.length = 0
    this.dropGeometry.dispose()
    super.beforeDestroy()
  }

  private createRain(): void {
    const laneSpan = 4.2
    for (let lane = 0; lane < LANE_COUNT; lane += 1) {
      const laneT = lane / Math.max(1, LANE_COUNT - 1)
      const laneX = this.chamberCenter.x + MathUtils.lerp(-laneSpan * 0.5, laneSpan * 0.5, laneT)

      for (let i = 0; i < DROPS_PER_LANE; i += 1) {
        const dropT = i / Math.max(1, DROPS_PER_LANE - 1)
        const color = new Color().setHSL(0.56 + laneT * 0.25 - dropT * 0.12, 0.9, 0.64)
        const material = new MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.34,
          roughness: 0.18,
          metalness: 0.06,
        })
        const mesh = new Mesh(this.dropGeometry, material)
        mesh.position.set(laneX, this.chamberCenter.y, this.chamberCenter.z)
        this.scene.add(mesh)
        this.drops.push({
          mesh,
          laneX,
          yOffset: MathUtils.randFloat(0, 8.2),
          zPhase: laneT * Math.PI * 2 + dropT * Math.PI * 1.6,
          fallSpeed: MathUtils.randFloat(0.95, 1.75),
          pulsePhase: MathUtils.randFloat(0, Math.PI * 2),
        })
      }
    }
  }
}
