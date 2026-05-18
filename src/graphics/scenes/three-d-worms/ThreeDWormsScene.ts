import {
  AmbientLight,
  BackSide,
  BufferGeometry,
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  PlaneGeometry,
  PerspectiveCamera,
  PointLight,
  RepeatWrapping,
  SRGBColorSpace,
  MathUtils,
  Vector3,
} from 'three'
import { BaseThreeScene } from '../../base/BaseThreeScene'
import type { SceneViewport } from '../../base/BaseGraphicScene'

interface GridCell {
  x: number
  y: number
  z: number
}

interface Worm {
  body: GridCell[]
  previousBody: GridCell[]
  meshes: Mesh<BoxGeometry, MeshStandardMaterial>[]
  stepTimerMs: number
  readonly stepIntervalMs: number
}

const GRID_X = 9
const GRID_Y = 16
const GRID_Z = 9
const BACK_WALL_Z_EDGE_INDEX = 0
const WORM_COUNT = 3
const WORM_LENGTH = 13
const GRID_CELL_SIZE = 0.46
const CHAMBER_VIEW_MARGIN = 1
const WORM_SEGMENT_FILL = 1.03
const GRID_LINE_SURFACE_INSET = 0.003

const CARDINAL_DIRECTIONS: readonly GridCell[] = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
]

export class ThreeDWormsScene extends BaseThreeScene {
  private readonly chamberCenter = new Vector3(0, 0, -2.4)
  private readonly chamberHalfSize = new Vector3(
    GRID_X * GRID_CELL_SIZE * 0.5,
    GRID_Y * GRID_CELL_SIZE * 0.5,
    GRID_Z * GRID_CELL_SIZE * 0.5,
  )
  private readonly worms: Worm[] = []
  private readonly segmentGeometry = new BoxGeometry(
    GRID_CELL_SIZE * WORM_SEGMENT_FILL,
    GRID_CELL_SIZE * WORM_SEGMENT_FILL,
    GRID_CELL_SIZE * WORM_SEGMENT_FILL,
  )
  private readonly reusableWorldFrom = new Vector3()
  private readonly reusableWorldTo = new Vector3()
  private pixelTexture: CanvasTexture | null = null
  private readonly disposableTextures: CanvasTexture[] = []
  private chamberShell: Mesh<BoxGeometry, MeshStandardMaterial> | null = null
  private chamberEdges: LineSegments | null = null
  private depthGridLines: LineSegments<BufferGeometry, LineBasicMaterial> | null = null

  protected override afterSetup(): void {
    this.scene.background = new Color('#05060a')
    this.scene.fog = null

    const camera = this.camera as PerspectiveCamera
    camera.fov = 34
    camera.near = 0.1
    camera.far = 100
    this.fitCameraToChamber(camera)

    const ambient = new AmbientLight('#85a2ff', 0.5)
    const keyLight = new DirectionalLight('#f8e6ff', 1.85)
    keyLight.position.set(4.2, 5.4, 7.2)
    const rimLight = new PointLight('#59a6ff', 16, 20, 1.8)
    rimLight.position.set(-3.2, 1.7, -7.1)
    const fillLight = new PointLight('#ffa3cf', 14, 18, 1.7)
    fillLight.position.set(2.4, -2.7, 1.4)
    this.scene.add(ambient, keyLight, rimLight, fillLight)

    this.pixelTexture = this.createPixelTexture()
    this.createChamber()
    this.createWorms()
  }

  protected override afterResize(_viewport: SceneViewport): void {
    const camera = this.camera as PerspectiveCamera
    this.fitCameraToChamber(camera)
  }

  protected override update(deltaMs: number): void {
    for (const worm of this.worms) {
      worm.stepTimerMs += deltaMs
      while (worm.stepTimerMs >= worm.stepIntervalMs) {
        worm.stepTimerMs -= worm.stepIntervalMs
        this.stepWorm(worm)
      }

      const progress = worm.stepTimerMs / worm.stepIntervalMs
      this.syncWormMeshes(worm, progress)
    }
  }

  protected override beforeDestroy(): void {
    this.worms.length = 0
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
    this.segmentGeometry.dispose()
  }

  private createChamber(): void {
    const chamberSize = this.chamberHalfSize.clone().multiplyScalar(2)
    const shellGeometry = new BoxGeometry(chamberSize.x, chamberSize.y, chamberSize.z)
    const shellMaterial = new MeshStandardMaterial({
      color: '#111a2a',
      metalness: 0.25,
      roughness: 0.7,
      emissive: '#070e1f',
      emissiveIntensity: 0.55,
      side: BackSide,
    })
    this.chamberShell = new Mesh(shellGeometry, shellMaterial)
    this.chamberShell.position.copy(this.chamberCenter)
    this.scene.add(this.chamberShell)
    this.createAlignedWallTextures()

    const edgeGeometry = new EdgesGeometry(shellGeometry)
    const edgeMaterial = new LineBasicMaterial({
      color: '#6ba2ff',
      transparent: true,
      opacity: 0.33,
    })
    this.chamberEdges = new LineSegments(edgeGeometry, edgeMaterial)
    this.chamberEdges.position.copy(this.chamberCenter)
    this.scene.add(this.chamberEdges)

    this.createDepthGridLines()
  }

  private createWorms(): void {
    const wormSeeds: readonly GridCell[] = [
      { x: 1, y: 3, z: 1 },
      { x: 7, y: 8, z: 7 },
      { x: 4, y: 12, z: 4 },
    ]
    const wormColors = ['#74f6ff', '#ffd370', '#ff7bd8'] as const

    for (let index = 0; index < WORM_COUNT; index += 1) {
      const headSeed = wormSeeds[index] ?? { x: 4, y: 8, z: 4 }
      const colorHex = wormColors[index % wormColors.length] ?? '#74f6ff'
      const body = this.buildInitialBody(headSeed)
      const previousBody = body.map((segment) => ({ ...segment }))
      const material = new MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.55,
        roughness: 0.62,
        metalness: 0.08,
        map: this.pixelTexture,
      })

      const meshes: Mesh<BoxGeometry, MeshStandardMaterial>[] = []
      for (let segmentIndex = 0; segmentIndex < WORM_LENGTH; segmentIndex += 1) {
        const segmentMesh = new Mesh(this.segmentGeometry, material)
        const segmentCell = body[segmentIndex]
        if (segmentCell !== undefined) {
          segmentMesh.position.copy(this.gridToWorld(segmentCell))
        }
        this.scene.add(segmentMesh)
        meshes.push(segmentMesh)
      }

      this.worms.push({
        body,
        previousBody,
        meshes,
        stepTimerMs: Math.random() * 200,
        stepIntervalMs: 155 + Math.random() * 80,
      })
    }
  }

  private buildInitialBody(headSeed: GridCell): GridCell[] {
    const body: GridCell[] = [{ ...headSeed }]
    let cursor = { ...headSeed }
    let direction = this.pickRandomDirection()

    for (let index = 1; index < WORM_LENGTH; index += 1) {
      const nextSegment = {
        x: cursor.x - direction.x,
        y: cursor.y - direction.y,
        z: cursor.z - direction.z,
      }

      if (!this.isWithinGrid(nextSegment)) {
        direction = this.pickRandomDirection()
        index -= 1
        continue
      }

      body.push(nextSegment)
      cursor = nextSegment
    }

    return body
  }

  private stepWorm(worm: Worm): void {
    worm.previousBody = worm.body.map((segment) => ({ ...segment }))
    const currentHead = worm.body[0]
    if (currentHead === undefined) {
      return
    }

    const neck = worm.body[1]
    const candidateDirections = this.shuffleDirections()
    let chosenHead: GridCell | null = null

    for (const direction of candidateDirections) {
      const candidate = {
        x: currentHead.x + direction.x,
        y: currentHead.y + direction.y,
        z: currentHead.z + direction.z,
      }

      const isReverse =
        neck !== undefined && candidate.x === neck.x && candidate.y === neck.y && candidate.z === neck.z
      if (isReverse || !this.isWithinGrid(candidate)) {
        continue
      }

      const intersectsSelf = worm.body.some(
        (segment) => segment.x === candidate.x && segment.y === candidate.y && segment.z === candidate.z,
      )
      if (!intersectsSelf) {
        chosenHead = candidate
        break
      }
    }

    if (chosenHead === null) {
      for (const direction of candidateDirections) {
        const fallback = {
          x: currentHead.x + direction.x,
          y: currentHead.y + direction.y,
          z: currentHead.z + direction.z,
        }
        if (this.isWithinGrid(fallback)) {
          chosenHead = fallback
          break
        }
      }
    }

    if (chosenHead === null) {
      return
    }

    worm.body = [chosenHead, ...worm.body.slice(0, WORM_LENGTH - 1)]
  }

  private syncWormMeshes(worm: Worm, progress: number): void {
    for (let index = 0; index < worm.meshes.length; index += 1) {
      const mesh = worm.meshes[index]
      const fromCell = worm.previousBody[index] ?? worm.body[index]
      const toCell = worm.body[index] ?? worm.previousBody[index]
      if (mesh === undefined || fromCell === undefined || toCell === undefined) {
        continue
      }

      this.gridToWorld(fromCell, this.reusableWorldFrom)
      this.gridToWorld(toCell, this.reusableWorldTo)
      mesh.position.lerpVectors(this.reusableWorldFrom, this.reusableWorldTo, progress)
    }
  }

  private gridToWorld(cell: GridCell, output: Vector3 = new Vector3()): Vector3 {
    output.set(
      this.chamberCenter.x + (cell.x + 0.5 - GRID_X * 0.5) * GRID_CELL_SIZE,
      this.chamberCenter.y + (cell.y + 0.5 - GRID_Y * 0.5) * GRID_CELL_SIZE,
      this.chamberCenter.z + (cell.z + 0.5 - GRID_Z * 0.5) * GRID_CELL_SIZE,
    )
    return output
  }

  private isWithinGrid(cell: GridCell): boolean {
    return (
      cell.x >= 0 &&
      cell.x < GRID_X &&
      cell.y >= 0 &&
      cell.y < GRID_Y &&
      cell.z >= 0 &&
      cell.z < GRID_Z
    )
  }

  private pickRandomDirection(): GridCell {
    const randomDirection = CARDINAL_DIRECTIONS[Math.floor(Math.random() * CARDINAL_DIRECTIONS.length)]
    if (randomDirection === undefined) {
      return { x: 1, y: 0, z: 0 }
    }

    return randomDirection
  }

  private shuffleDirections(): GridCell[] {
    const directions = [...CARDINAL_DIRECTIONS]
    for (let index = directions.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1))
      const current = directions[index]
      const target = directions[swapIndex]
      if (current !== undefined && target !== undefined) {
        directions[index] = target
        directions[swapIndex] = current
      }
    }

    return directions
  }

  private createPixelTexture(): CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 8
    canvas.height = 8
    const context = canvas.getContext('2d')
    if (context !== null) {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, 8, 8)
      context.fillStyle = '#c6d2ff'
      context.fillRect(0, 0, 4, 4)
      context.fillRect(4, 4, 4, 4)
      context.fillStyle = '#7f8fd8'
      context.fillRect(4, 0, 4, 4)
      context.fillRect(0, 4, 4, 4)
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

  private createDepthGridLines(): void {
    const positions: number[] = []

    const boundaryYEdges = [0, GRID_Y]
    const boundaryXEdges = [0, GRID_X]
    const boundaryZEdges = [BACK_WALL_Z_EDGE_INDEX]
    const floorY = this.gridEdgeToWorldY(0) + GRID_LINE_SURFACE_INSET
    const ceilingY = this.gridEdgeToWorldY(GRID_Y) - GRID_LINE_SURFACE_INSET
    const leftWallX = this.gridEdgeToWorldX(0) + GRID_LINE_SURFACE_INSET
    const rightWallX = this.gridEdgeToWorldX(GRID_X) - GRID_LINE_SURFACE_INSET
    const backWallZ = this.gridEdgeToWorldZ(BACK_WALL_Z_EDGE_INDEX) + GRID_LINE_SURFACE_INSET
    const yByEdge = (yEdge: number): number => (yEdge === 0 ? floorY : ceilingY)
    const xByEdge = (xEdge: number): number => (xEdge === 0 ? leftWallX : rightWallX)
    const zByEdge = (_zEdge: number): number => backWallZ

    // Bottom and ceiling (y = 0 and y = max): lines along X and Z.
    for (const yEdge of boundaryYEdges) {
      const y = yByEdge(yEdge)
      for (let zEdge = 0; zEdge <= GRID_Z; zEdge += 1) {
        positions.push(
          this.gridEdgeToWorldX(0),
          y,
          this.gridEdgeToWorldZ(zEdge),
          this.gridEdgeToWorldX(GRID_X),
          y,
          this.gridEdgeToWorldZ(zEdge),
        )
      }
      for (let xEdge = 0; xEdge <= GRID_X; xEdge += 1) {
        positions.push(
          this.gridEdgeToWorldX(xEdge),
          y,
          this.gridEdgeToWorldZ(0),
          this.gridEdgeToWorldX(xEdge),
          y,
          this.gridEdgeToWorldZ(GRID_Z),
        )
      }
    }

    // Side walls at z = 0 and z = max: lines along X and Y.
    for (const zEdge of boundaryZEdges) {
      const z = zByEdge(zEdge)
      for (let yEdge = 0; yEdge <= GRID_Y; yEdge += 1) {
        positions.push(
          this.gridEdgeToWorldX(0),
          this.gridEdgeToWorldY(yEdge),
          z,
          this.gridEdgeToWorldX(GRID_X),
          this.gridEdgeToWorldY(yEdge),
          z,
        )
      }

      for (let xEdge = 0; xEdge <= GRID_X; xEdge += 1) {
        positions.push(
          this.gridEdgeToWorldX(xEdge),
          this.gridEdgeToWorldY(0),
          z,
          this.gridEdgeToWorldX(xEdge),
          this.gridEdgeToWorldY(GRID_Y),
          z,
        )
      }
    }

    // Side walls at x = 0 and x = max: lines along Y and Z.
    for (const xEdge of boundaryXEdges) {
      const x = xByEdge(xEdge)
      for (let yEdge = 0; yEdge <= GRID_Y; yEdge += 1) {
        positions.push(
          x,
          this.gridEdgeToWorldY(yEdge),
          this.gridEdgeToWorldZ(0),
          x,
          this.gridEdgeToWorldY(yEdge),
          this.gridEdgeToWorldZ(GRID_Z),
        )
      }

      for (let zEdge = 0; zEdge <= GRID_Z; zEdge += 1) {
        positions.push(
          x,
          this.gridEdgeToWorldY(0),
          this.gridEdgeToWorldZ(zEdge),
          x,
          this.gridEdgeToWorldY(GRID_Y),
          this.gridEdgeToWorldZ(zEdge),
        )
      }
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    const material = new LineBasicMaterial({
      color: '#85b4ff',
      transparent: true,
      opacity: 0.12,
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

    const backWall = new Mesh(
      new PlaneGeometry(chamberSizeX(), chamberSizeY()),
      this.createWallMaterial(GRID_X, GRID_Y),
    )
    backWall.position.set(this.chamberCenter.x, this.chamberCenter.y, zMin + inset)
    this.scene.add(backWall)

    const leftWall = new Mesh(
      new PlaneGeometry(chamberSizeZ(), chamberSizeY()),
      this.createWallMaterial(GRID_Z, GRID_Y),
    )
    leftWall.rotation.y = Math.PI * 0.5
    leftWall.position.set(xMin + inset, this.chamberCenter.y, this.chamberCenter.z)
    this.scene.add(leftWall)

    const rightWall = new Mesh(
      new PlaneGeometry(chamberSizeZ(), chamberSizeY()),
      this.createWallMaterial(GRID_Z, GRID_Y),
    )
    rightWall.rotation.y = -Math.PI * 0.5
    rightWall.position.set(xMax - inset, this.chamberCenter.y, this.chamberCenter.z)
    this.scene.add(rightWall)

    const floor = new Mesh(
      new PlaneGeometry(chamberSizeX(), chamberSizeZ()),
      this.createWallMaterial(GRID_X, GRID_Z),
    )
    floor.rotation.x = -Math.PI * 0.5
    floor.position.set(this.chamberCenter.x, yMin + inset, this.chamberCenter.z)
    this.scene.add(floor)

    const ceiling = new Mesh(
      new PlaneGeometry(chamberSizeX(), chamberSizeZ()),
      this.createWallMaterial(GRID_X, GRID_Z),
    )
    ceiling.rotation.x = Math.PI * 0.5
    ceiling.position.set(this.chamberCenter.x, yMax - inset, this.chamberCenter.z)
    this.scene.add(ceiling)

    function chamberSizeX(): number {
      return GRID_X * GRID_CELL_SIZE
    }
    function chamberSizeY(): number {
      return GRID_Y * GRID_CELL_SIZE
    }
    function chamberSizeZ(): number {
      return GRID_Z * GRID_CELL_SIZE
    }
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
      color: '#2a3554',
      emissive: '#101836',
      emissiveIntensity: 0.28,
      roughness: 0.72,
      metalness: 0.04,
      map: texture,
    })
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

    // Keep the entire depth volume in frame by adding front half-depth clearance.
    const cameraZ = this.chamberCenter.z + halfDepth + requiredDistance
    camera.position.set(this.chamberCenter.x, this.chamberCenter.y, cameraZ)
    camera.lookAt(this.chamberCenter.x, this.chamberCenter.y, this.chamberCenter.z)
    camera.updateProjectionMatrix()
  }

  private gridEdgeToWorldX(xEdge: number): number {
    return this.chamberCenter.x + (xEdge - GRID_X * 0.5) * GRID_CELL_SIZE
  }

  private gridEdgeToWorldY(yEdge: number): number {
    return this.chamberCenter.y + (yEdge - GRID_Y * 0.5) * GRID_CELL_SIZE
  }

  private gridEdgeToWorldZ(zEdge: number): number {
    return this.chamberCenter.z + (zEdge - GRID_Z * 0.5) * GRID_CELL_SIZE
  }
}
