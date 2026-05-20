import {
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  EdgesGeometry,
  Float32BufferAttribute,
  Fog,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { BaseThreeScene } from '../../base/BaseThreeScene'
import type { SceneViewport } from '../../base/BaseGraphicScene'

export const FALLING_BALLS_GRID_X = 9
export const FALLING_BALLS_GRID_Y = 16
export const FALLING_BALLS_GRID_Z = 9

const GRID_CELL_SIZE = 0.46
const GRID_LINE_SURFACE_INSET = 0.003
const CHAMBER_VIEW_MARGIN = 1

export class FallingBallsStaticScene extends BaseThreeScene {
  protected readonly chamberCenter = new Vector3(0, 0, -2.4)
  protected readonly chamberHalfSize = new Vector3(
    FALLING_BALLS_GRID_X * GRID_CELL_SIZE * 0.5,
    FALLING_BALLS_GRID_Y * GRID_CELL_SIZE * 0.5,
    FALLING_BALLS_GRID_Z * GRID_CELL_SIZE * 0.5,
  )

  private pixelTexture: CanvasTexture | null = null
  private readonly disposableTextures: CanvasTexture[] = []
  private chamberShell: Mesh<BoxGeometry, MeshStandardMaterial> | null = null
  private chamberEdges: LineSegments | null = null
  private depthGridLines: LineSegments<BufferGeometry, LineBasicMaterial> | null = null

  protected override afterSetup(): void {
    this.scene.background = new Color('#03040b')
    this.scene.fog = new Fog('#03040b', 7, 18)

    const camera = this.camera as PerspectiveCamera
    camera.fov = 34
    camera.near = 0.1
    camera.far = 100
    this.fitCameraToChamber(camera)

    this.pixelTexture = this.createPixelTexture()
    this.createChamber()
  }

  protected override afterResize(_viewport: SceneViewport): void {
    const camera = this.camera as PerspectiveCamera
    this.fitCameraToChamber(camera)
  }

  protected override update(_deltaMs: number): void {}

  protected override beforeDestroy(): void {
    this.pixelTexture?.dispose()
    this.pixelTexture = null
    for (const texture of this.disposableTextures) {
      texture.dispose()
    }
    this.disposableTextures.length = 0
    this.depthGridLines?.geometry.dispose()
    this.depthGridLines?.material.dispose()
    this.depthGridLines = null
    this.chamberShell = null
    this.chamberEdges = null
  }

  protected getGridCellSize(): number {
    return GRID_CELL_SIZE
  }

  protected getBoundsForRadius(radius: number): {
    minX: number
    maxX: number
    minY: number
    maxY: number
    minZ: number
    maxZ: number
  } {
    return {
      minX: this.chamberCenter.x - this.chamberHalfSize.x + radius,
      maxX: this.chamberCenter.x + this.chamberHalfSize.x - radius,
      minY: this.chamberCenter.y - this.chamberHalfSize.y + radius,
      maxY: this.chamberCenter.y + this.chamberHalfSize.y - radius,
      minZ: this.chamberCenter.z - this.chamberHalfSize.z + radius,
      maxZ: this.chamberCenter.z + this.chamberHalfSize.z - radius,
    }
  }

  private createChamber(): void {
    const chamberSize = this.chamberHalfSize.clone().multiplyScalar(2)
    const shellGeometry = new BoxGeometry(chamberSize.x, chamberSize.y, chamberSize.z)
    const shellMaterial = new MeshStandardMaterial({
      color: '#0b1331',
      metalness: 0.16,
      roughness: 0.83,
      emissive: '#060d28',
      emissiveIntensity: 0.45,
      side: BackSide,
      transparent: true,
      opacity: 0.94,
    })
    this.chamberShell = new Mesh(shellGeometry, shellMaterial)
    this.chamberShell.position.copy(this.chamberCenter)
    this.scene.add(this.chamberShell)
    this.createAlignedWallTextures()

    const edgeGeometry = new EdgesGeometry(shellGeometry)
    const edgeMaterial = new LineBasicMaterial({
      color: '#84a8ff',
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    })
    this.chamberEdges = new LineSegments(edgeGeometry, edgeMaterial)
    this.chamberEdges.position.copy(this.chamberCenter)
    this.scene.add(this.chamberEdges)

    this.createDepthGridLines()
  }

  private createDepthGridLines(): void {
    const positions: number[] = []

    const boundaryYEdges = [0, FALLING_BALLS_GRID_Y]
    const boundaryXEdges = [0, FALLING_BALLS_GRID_X]
    const floorY = this.gridEdgeToWorldY(0) + GRID_LINE_SURFACE_INSET
    const ceilingY = this.gridEdgeToWorldY(FALLING_BALLS_GRID_Y) - GRID_LINE_SURFACE_INSET
    const leftWallX = this.gridEdgeToWorldX(0) + GRID_LINE_SURFACE_INSET
    const rightWallX = this.gridEdgeToWorldX(FALLING_BALLS_GRID_X) - GRID_LINE_SURFACE_INSET
    const backWallZ = this.gridEdgeToWorldZ(0) + GRID_LINE_SURFACE_INSET
    const yByEdge = (yEdge: number): number => (yEdge === 0 ? floorY : ceilingY)
    const xByEdge = (xEdge: number): number => (xEdge === 0 ? leftWallX : rightWallX)

    for (const yEdge of boundaryYEdges) {
      const y = yByEdge(yEdge)
      for (let zEdge = 0; zEdge <= FALLING_BALLS_GRID_Z; zEdge += 1) {
        positions.push(
          this.gridEdgeToWorldX(0),
          y,
          this.gridEdgeToWorldZ(zEdge),
          this.gridEdgeToWorldX(FALLING_BALLS_GRID_X),
          y,
          this.gridEdgeToWorldZ(zEdge),
        )
      }
      for (let xEdge = 0; xEdge <= FALLING_BALLS_GRID_X; xEdge += 1) {
        positions.push(
          this.gridEdgeToWorldX(xEdge),
          y,
          this.gridEdgeToWorldZ(0),
          this.gridEdgeToWorldX(xEdge),
          y,
          this.gridEdgeToWorldZ(FALLING_BALLS_GRID_Z),
        )
      }
    }

    for (let yEdge = 0; yEdge <= FALLING_BALLS_GRID_Y; yEdge += 1) {
      positions.push(
        this.gridEdgeToWorldX(0),
        this.gridEdgeToWorldY(yEdge),
        backWallZ,
        this.gridEdgeToWorldX(FALLING_BALLS_GRID_X),
        this.gridEdgeToWorldY(yEdge),
        backWallZ,
      )
    }
    for (let xEdge = 0; xEdge <= FALLING_BALLS_GRID_X; xEdge += 1) {
      positions.push(
        this.gridEdgeToWorldX(xEdge),
        this.gridEdgeToWorldY(0),
        backWallZ,
        this.gridEdgeToWorldX(xEdge),
        this.gridEdgeToWorldY(FALLING_BALLS_GRID_Y),
        backWallZ,
      )
    }

    for (const xEdge of boundaryXEdges) {
      const x = xByEdge(xEdge)
      for (let yEdge = 0; yEdge <= FALLING_BALLS_GRID_Y; yEdge += 1) {
        positions.push(
          x,
          this.gridEdgeToWorldY(yEdge),
          this.gridEdgeToWorldZ(0),
          x,
          this.gridEdgeToWorldY(yEdge),
          this.gridEdgeToWorldZ(FALLING_BALLS_GRID_Z),
        )
      }
      for (let zEdge = 0; zEdge <= FALLING_BALLS_GRID_Z; zEdge += 1) {
        positions.push(
          x,
          this.gridEdgeToWorldY(0),
          this.gridEdgeToWorldZ(zEdge),
          x,
          this.gridEdgeToWorldY(FALLING_BALLS_GRID_Y),
          this.gridEdgeToWorldZ(zEdge),
        )
      }
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    const material = new LineBasicMaterial({
      color: '#79a7ff',
      transparent: true,
      opacity: 0.19,
      depthWrite: false,
    })
    this.depthGridLines = new LineSegments(geometry, material)
    this.scene.add(this.depthGridLines)
  }

  private createAlignedWallTextures(): void {
    if (this.pixelTexture === null) {
      return
    }

    const halfWidth = this.chamberHalfSize.x
    const halfHeight = this.chamberHalfSize.y
    const halfDepth = this.chamberHalfSize.z
    const xMin = this.chamberCenter.x - halfWidth
    const xMax = this.chamberCenter.x + halfWidth
    const yMin = this.chamberCenter.y - halfHeight
    const yMax = this.chamberCenter.y + halfHeight
    const zMin = this.chamberCenter.z - halfDepth
    const inset = GRID_LINE_SURFACE_INSET * 2

    const chamberSizeX = FALLING_BALLS_GRID_X * GRID_CELL_SIZE
    const chamberSizeY = FALLING_BALLS_GRID_Y * GRID_CELL_SIZE
    const chamberSizeZ = FALLING_BALLS_GRID_Z * GRID_CELL_SIZE

    const backWall = new Mesh(
      new PlaneGeometry(chamberSizeX, chamberSizeY),
      this.createWallMaterial(FALLING_BALLS_GRID_X, FALLING_BALLS_GRID_Y),
    )
    backWall.position.set(this.chamberCenter.x, this.chamberCenter.y, zMin + inset)
    this.scene.add(backWall)

    const leftWall = new Mesh(
      new PlaneGeometry(chamberSizeZ, chamberSizeY),
      this.createWallMaterial(FALLING_BALLS_GRID_Z, FALLING_BALLS_GRID_Y),
    )
    leftWall.rotation.y = Math.PI * 0.5
    leftWall.position.set(xMin + inset, this.chamberCenter.y, this.chamberCenter.z)
    this.scene.add(leftWall)

    const rightWall = new Mesh(
      new PlaneGeometry(chamberSizeZ, chamberSizeY),
      this.createWallMaterial(FALLING_BALLS_GRID_Z, FALLING_BALLS_GRID_Y),
    )
    rightWall.rotation.y = -Math.PI * 0.5
    rightWall.position.set(xMax - inset, this.chamberCenter.y, this.chamberCenter.z)
    this.scene.add(rightWall)

    const floor = new Mesh(
      new PlaneGeometry(chamberSizeX, chamberSizeZ),
      this.createWallMaterial(FALLING_BALLS_GRID_X, FALLING_BALLS_GRID_Z),
    )
    floor.rotation.x = -Math.PI * 0.5
    floor.position.set(this.chamberCenter.x, yMin + inset, this.chamberCenter.z)
    this.scene.add(floor)

    const ceiling = new Mesh(
      new PlaneGeometry(chamberSizeX, chamberSizeZ),
      this.createWallMaterial(FALLING_BALLS_GRID_X, FALLING_BALLS_GRID_Z),
    )
    ceiling.rotation.x = Math.PI * 0.5
    ceiling.position.set(this.chamberCenter.x, yMax - inset, this.chamberCenter.z)
    this.scene.add(ceiling)
  }

  private createWallMaterial(repeatX: number, repeatY: number): MeshStandardMaterial {
    const texture = this.pixelTexture?.clone() ?? null
    if (texture !== null) {
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      texture.repeat.set(repeatX, repeatY)
      texture.generateMipmaps = false
      texture.magFilter = NearestFilter
      texture.minFilter = NearestFilter
      texture.needsUpdate = true
      this.disposableTextures.push(texture)
    }

    return new MeshStandardMaterial({
      color: '#25345f',
      emissive: '#152148',
      emissiveIntensity: 0.35,
      roughness: 0.66,
      metalness: 0.06,
      map: texture,
    })
  }

  private createPixelTexture(): CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 8
    canvas.height = 8
    const context = canvas.getContext('2d')
    if (context !== null) {
      context.fillStyle = '#1f2d59'
      context.fillRect(0, 0, 8, 8)
      context.fillStyle = '#2f4175'
      context.fillRect(0, 0, 4, 4)
      context.fillRect(4, 4, 4, 4)
      context.fillStyle = '#18264d'
      context.fillRect(4, 0, 4, 4)
      context.fillRect(0, 4, 4, 4)
      context.fillStyle = 'rgba(140, 181, 255, 0.16)'
      context.fillRect(0, 0, 8, 2)
    }

    const texture = new CanvasTexture(canvas)
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.repeat.set(2, 2)
    texture.colorSpace = SRGBColorSpace
    texture.generateMipmaps = false
    texture.magFilter = NearestFilter
    texture.minFilter = NearestFilter
    texture.needsUpdate = true
    return texture
  }

  private fitCameraToChamber(camera: PerspectiveCamera): void {
    const halfWidth = this.chamberHalfSize.x
    const halfHeight = this.chamberHalfSize.y
    const halfDepth = this.chamberHalfSize.z

    const verticalFovRad = MathUtils.degToRad(camera.fov)
    const verticalFovHalf = verticalFovRad * 0.5
    const horizontalFovHalf = Math.atan(Math.tan(verticalFovHalf) * camera.aspect)

    const requiredDistanceForHeight = halfHeight / Math.tan(verticalFovHalf)
    const requiredDistanceForWidth = halfWidth / Math.tan(horizontalFovHalf)
    const requiredDistance = Math.max(requiredDistanceForHeight, requiredDistanceForWidth) * CHAMBER_VIEW_MARGIN

    const cameraZ = this.chamberCenter.z + halfDepth + requiredDistance
    camera.position.set(this.chamberCenter.x, this.chamberCenter.y, cameraZ)
    camera.lookAt(this.chamberCenter.x, this.chamberCenter.y, this.chamberCenter.z)
    camera.updateProjectionMatrix()
  }

  private gridEdgeToWorldX(xEdge: number): number {
    return this.chamberCenter.x + (xEdge - FALLING_BALLS_GRID_X * 0.5) * GRID_CELL_SIZE
  }

  private gridEdgeToWorldY(yEdge: number): number {
    return this.chamberCenter.y + (yEdge - FALLING_BALLS_GRID_Y * 0.5) * GRID_CELL_SIZE
  }

  private gridEdgeToWorldZ(zEdge: number): number {
    return this.chamberCenter.z + (zEdge - FALLING_BALLS_GRID_Z * 0.5) * GRID_CELL_SIZE
  }
}
