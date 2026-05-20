import { Color, MathUtils, Mesh, MeshStandardMaterial, BoxGeometry, AmbientLight, PointLight } from 'three'
import { FallingBallsStaticScene } from '../falling-balls/FallingBallsStaticScene'

interface PuzzleVoxel {
  mesh: Mesh<BoxGeometry, MeshStandardMaterial>
  baseX: number
  baseY: number
  depthPhase: number
  pulsePhase: number
}

const GRID_X = 7
const GRID_Y = 12
const VOXEL_SIZE = 0.32
const VOXEL_GAP = 0.02
const DEPTH_SPAN = 3.4

export class PuzzlesHypnoticVoxelFlowScene extends FallingBallsStaticScene {
  private readonly voxels: PuzzleVoxel[] = []
  private readonly voxelGeometry = new BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE)
  private elapsedMs = 0

  protected override afterSetup(): void {
    super.afterSetup()
    this.scene.background = new Color('#040610')

    const ambient = new AmbientLight('#7f95ff', 0.44)
    const leftGlow = new PointLight('#5cefff', 12, 16, 1.7)
    leftGlow.position.set(-2.1, 1.2, -5.8)
    const rightGlow = new PointLight('#ff6edd', 12, 16, 1.7)
    rightGlow.position.set(2.1, -1.2, -2.2)
    this.scene.add(ambient, leftGlow, rightGlow)

    this.createVoxelPuzzle()
  }

  protected override update(deltaMs: number): void {
    this.elapsedMs += deltaMs
    const t = this.elapsedMs * 0.001

    for (const voxel of this.voxels) {
      const depthWave = Math.sin(t * 1.35 + voxel.depthPhase) * DEPTH_SPAN
      const layerShift = Math.cos(t * 1.9 + voxel.baseY * 1.2) * 0.18
      voxel.mesh.position.set(
        voxel.baseX + layerShift,
        voxel.baseY,
        this.chamberCenter.z + depthWave,
      )

      const pulse = (Math.sin(t * 3.2 + voxel.pulsePhase) + 1) * 0.5
      voxel.mesh.scale.setScalar(0.84 + pulse * 0.5)
      voxel.mesh.rotation.x = pulse * 0.85
      voxel.mesh.rotation.y = (1 - pulse) * 0.75
      voxel.mesh.material.emissiveIntensity = 0.12 + pulse * 0.56
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

  private createVoxelPuzzle(): void {
    const totalWidth = GRID_X * VOXEL_SIZE + (GRID_X - 1) * VOXEL_GAP
    const totalHeight = GRID_Y * VOXEL_SIZE + (GRID_Y - 1) * VOXEL_GAP
    const startX = this.chamberCenter.x - totalWidth * 0.5 + VOXEL_SIZE * 0.5
    const startY = this.chamberCenter.y - totalHeight * 0.5 + VOXEL_SIZE * 0.5

    for (let y = 0; y < GRID_Y; y += 1) {
      for (let x = 0; x < GRID_X; x += 1) {
        const normalizedX = x / Math.max(1, GRID_X - 1)
        const normalizedY = y / Math.max(1, GRID_Y - 1)
        const color = new Color().setHSL(0.55 + normalizedX * 0.25 - normalizedY * 0.18, 0.84, 0.64)
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
          depthPhase: normalizedX * Math.PI * 2 + normalizedY * Math.PI * 1.7,
          pulsePhase: MathUtils.randFloat(0, Math.PI * 2),
        })
      }
    }
  }
}
