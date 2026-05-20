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

interface HeartVoxel {
  mesh: Mesh<BoxGeometry, MeshStandardMaterial>
  baseX: number
  baseY: number
  depthPhase: number
  pulsePhase: number
}

const GRID_X = 15
const GRID_Y = 14
const VOXEL_SIZE = 0.28
const VOXEL_GAP = 0.02
const DEPTH_SPAN = 3.2

export class PuzzlesHypnoticHeartFlowScene extends FallingBallsStaticScene {
  private readonly voxels: HeartVoxel[] = []
  private readonly voxelGeometry = new BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE)
  private elapsedMs = 0

  protected override afterSetup(): void {
    super.afterSetup()
    this.scene.background = new Color('#040610')

    const ambient = new AmbientLight('#879cff', 0.44)
    const leftGlow = new PointLight('#73e6ff', 12, 16, 1.7)
    leftGlow.position.set(-2.2, 1.4, -5.8)
    const rightGlow = new PointLight('#ff72cf', 12, 16, 1.7)
    rightGlow.position.set(2.2, -1.1, -2.2)
    this.scene.add(ambient, leftGlow, rightGlow)

    this.createHeartVoxels()
  }

  protected override update(deltaMs: number): void {
    this.elapsedMs += deltaMs
    const t = this.elapsedMs * 0.001

    for (const voxel of this.voxels) {
      const depthWave = Math.sin(t * 1.4 + voxel.depthPhase) * DEPTH_SPAN
      const lateralWave = Math.cos(t * 1.7 + voxel.baseY * 1.1) * 0.16
      voxel.mesh.position.set(voxel.baseX + lateralWave, voxel.baseY, this.chamberCenter.z + depthWave)

      const pulse = (Math.sin(t * 3.4 + voxel.pulsePhase) + 1) * 0.5
      voxel.mesh.scale.setScalar(0.82 + pulse * 0.52)
      voxel.mesh.rotation.x = pulse * 0.88
      voxel.mesh.rotation.y = (1 - pulse) * 0.8
      voxel.mesh.material.emissiveIntensity = 0.14 + pulse * 0.6
    }
  }

  protected override beforeDestroy(): void {
    for (const voxel of this.voxels) {
      voxel.mesh.material.dispose()
    }
    this.voxels.length = 0
    this.voxelGeometry.dispose()
    super.beforeDestroy()
  }

  private createHeartVoxels(): void {
    const totalWidth = GRID_X * VOXEL_SIZE + (GRID_X - 1) * VOXEL_GAP
    const totalHeight = GRID_Y * VOXEL_SIZE + (GRID_Y - 1) * VOXEL_GAP
    const startX = this.chamberCenter.x - totalWidth * 0.5 + VOXEL_SIZE * 0.5
    const startY = this.chamberCenter.y - totalHeight * 0.5 + VOXEL_SIZE * 0.5

    for (let y = 0; y < GRID_Y; y += 1) {
      for (let x = 0; x < GRID_X; x += 1) {
        const nx = (x / Math.max(1, GRID_X - 1)) * 2 - 1
        const ny = (y / Math.max(1, GRID_Y - 1)) * 2 - 1

        if (!this.isHeartPoint(nx, ny)) {
          continue
        }

        const hue = 0.86 + (nx + 1) * 0.04 - (ny + 1) * 0.03
        const color = new Color().setHSL(hue, 0.9, 0.65)
        const material = new MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.3,
          roughness: 0.2,
          metalness: 0.06,
        })
        const mesh = new Mesh(this.voxelGeometry, material)
        const baseX = startX + x * (VOXEL_SIZE + VOXEL_GAP)
        const baseY = startY + y * (VOXEL_SIZE + VOXEL_GAP)
        mesh.position.set(baseX, baseY, this.chamberCenter.z)
        this.scene.add(mesh)
        this.voxels.push({
          mesh,
          baseX,
          baseY,
          depthPhase: nx * Math.PI * 1.5 + ny * Math.PI * 2.2,
          pulsePhase: MathUtils.randFloat(0, Math.PI * 2),
        })
      }
    }
  }

  private isHeartPoint(nx: number, ny: number): boolean {
    // Algebraic heart curve: (x^2 + y^2 - 1)^3 - x^2 y^3 <= 0
    const x = nx * 1.05
    const y = ny * 1.15
    const a = x * x + y * y - 1
    const value = a * a * a - x * x * y * y * y
    return value <= 0.02
  }
}
