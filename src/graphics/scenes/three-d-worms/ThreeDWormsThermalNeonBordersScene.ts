import {
  AdditiveBlending,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three'
import { ThreeDWormsThermalDepthScene } from './ThreeDWormsThermalDepthScene'

interface BorderLayerMesh {
  mesh: Mesh<BoxGeometry, MeshBasicMaterial>
  baseOpacity: number
  phase: number
}

const GRID_X = 9
const GRID_Y = 16
const GRID_Z = 9
const GRID_CELL_SIZE = 0.46

const CHAMBER_HALF_SIZE = new Vector3(
  GRID_X * GRID_CELL_SIZE * 0.5,
  GRID_Y * GRID_CELL_SIZE * 0.5,
  GRID_Z * GRID_CELL_SIZE * 0.5,
)
const CHAMBER_CENTER = new Vector3(0, 0, -2.4)

const MAIN_BORDER_THICKNESS = 0.06
const MAIN_BORDER_OPACITY = 0.55
const GLOW_BORDER_THICKNESS = 0.02
const GLOW_BORDER_OPACITY = 0.85

export class ThreeDWormsThermalNeonBordersScene extends ThreeDWormsThermalDepthScene {
  private readonly borderGroup = new Group()
  private readonly borderLayers: BorderLayerMesh[] = []
  private borderElapsedMs = 0

  protected override afterSetup(): void {
    super.afterSetup()
    this.createBorderLayer('#ff6a3d', MAIN_BORDER_THICKNESS, MAIN_BORDER_OPACITY)
    this.createBorderLayer('#ffd66b', GLOW_BORDER_THICKNESS, GLOW_BORDER_OPACITY)
    this.scene.add(this.borderGroup)
  }

  protected override update(deltaMs: number): void {
    super.update(deltaMs)
    this.borderElapsedMs += deltaMs
    this.animateBorders()
  }

  protected override beforeDestroy(): void {
    for (const layer of this.borderLayers) {
      layer.mesh.geometry.dispose()
      layer.mesh.material.dispose()
    }
    this.borderLayers.length = 0
    super.beforeDestroy()
  }

  private animateBorders(): void {
    const t = this.borderElapsedMs * 0.001
    for (const layer of this.borderLayers) {
      const pulse = (Math.sin(t * 3 + layer.phase) + 1) * 0.5
      layer.mesh.material.opacity = layer.baseOpacity + pulse * 0.18
    }
  }

  private createBorderLayer(color: string, thickness: number, baseOpacity: number): void {
    const xHalf = CHAMBER_HALF_SIZE.x
    const yHalf = CHAMBER_HALF_SIZE.y
    const zHalf = CHAMBER_HALF_SIZE.z

    // Edges along X axis.
    const xLength = xHalf * 2
    this.addEdgeSegment(new Vector3(CHAMBER_CENTER.x, CHAMBER_CENTER.y - yHalf, CHAMBER_CENTER.z - zHalf), xLength, thickness, thickness, color, baseOpacity)
    this.addEdgeSegment(new Vector3(CHAMBER_CENTER.x, CHAMBER_CENTER.y + yHalf, CHAMBER_CENTER.z - zHalf), xLength, thickness, thickness, color, baseOpacity)
    this.addEdgeSegment(new Vector3(CHAMBER_CENTER.x, CHAMBER_CENTER.y - yHalf, CHAMBER_CENTER.z + zHalf), xLength, thickness, thickness, color, baseOpacity)
    this.addEdgeSegment(new Vector3(CHAMBER_CENTER.x, CHAMBER_CENTER.y + yHalf, CHAMBER_CENTER.z + zHalf), xLength, thickness, thickness, color, baseOpacity)

    // Edges along Y axis.
    const yLength = yHalf * 2
    this.addEdgeSegment(new Vector3(CHAMBER_CENTER.x - xHalf, CHAMBER_CENTER.y, CHAMBER_CENTER.z - zHalf), thickness, yLength, thickness, color, baseOpacity)
    this.addEdgeSegment(new Vector3(CHAMBER_CENTER.x + xHalf, CHAMBER_CENTER.y, CHAMBER_CENTER.z - zHalf), thickness, yLength, thickness, color, baseOpacity)
    this.addEdgeSegment(new Vector3(CHAMBER_CENTER.x - xHalf, CHAMBER_CENTER.y, CHAMBER_CENTER.z + zHalf), thickness, yLength, thickness, color, baseOpacity)
    this.addEdgeSegment(new Vector3(CHAMBER_CENTER.x + xHalf, CHAMBER_CENTER.y, CHAMBER_CENTER.z + zHalf), thickness, yLength, thickness, color, baseOpacity)

    // Edges along Z axis.
    const zLength = zHalf * 2
    this.addEdgeSegment(new Vector3(CHAMBER_CENTER.x - xHalf, CHAMBER_CENTER.y - yHalf, CHAMBER_CENTER.z), thickness, thickness, zLength, color, baseOpacity)
    this.addEdgeSegment(new Vector3(CHAMBER_CENTER.x + xHalf, CHAMBER_CENTER.y - yHalf, CHAMBER_CENTER.z), thickness, thickness, zLength, color, baseOpacity)
    this.addEdgeSegment(new Vector3(CHAMBER_CENTER.x - xHalf, CHAMBER_CENTER.y + yHalf, CHAMBER_CENTER.z), thickness, thickness, zLength, color, baseOpacity)
    this.addEdgeSegment(new Vector3(CHAMBER_CENTER.x + xHalf, CHAMBER_CENTER.y + yHalf, CHAMBER_CENTER.z), thickness, thickness, zLength, color, baseOpacity)
  }

  private addEdgeSegment(
    position: Vector3,
    width: number,
    height: number,
    depth: number,
    color: string,
    baseOpacity: number,
  ): void {
    const geometry = new BoxGeometry(width, height, depth)
    const material = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: baseOpacity,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    const mesh = new Mesh(geometry, material)
    mesh.position.copy(position)
    this.borderGroup.add(mesh)
    this.borderLayers.push({
      mesh,
      baseOpacity,
      phase: Math.random() * Math.PI * 2,
    })
  }
}
