import {
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  PerspectiveCamera,
  PointLight,
  RingGeometry,
  Mesh,
  MeshBasicMaterial,
} from 'three'
import { BaseThreeScene } from '../../base/BaseThreeScene'

interface HypnoRing {
  mesh: Mesh<RingGeometry, MeshBasicMaterial>
  baseZ: number
  rotationSpeed: number
  pulsePhase: number
  driftPhase: number
}

interface FlowShape {
  mesh: Mesh<BoxGeometry, MeshBasicMaterial>
  kind: 'diamond' | 'bar' | 'cube'
  orbitRadius: number
  spinSpeed: number
  verticalOffset: number
  depthOffset: number
  phase: number
}

const RING_COUNT = 18
const FLOW_SHAPE_COUNT = 64

export class WebglHypnotizedEngagementScene extends BaseThreeScene {
  private readonly ringGroup = new Group()
  private readonly shapeGroup = new Group()
  private readonly rings: HypnoRing[] = []
  private readonly flowShapes: FlowShape[] = []
  private readonly shapeGeometry = new BoxGeometry(0.14, 0.14, 0.14)
  private readonly shapeMaterialPool: MeshBasicMaterial[] = []
  private gridLines: LineSegments<BufferGeometry, LineBasicMaterial> | null = null
  private elapsedMs = 0

  protected override afterSetup(): void {
    this.scene.background = new Color('#04040c')

    const camera = this.camera as PerspectiveCamera
    camera.fov = 34
    camera.near = 0.1
    camera.far = 100
    camera.position.set(0, 0, 6.8)
    camera.lookAt(0, 0, -2.5)
    camera.updateProjectionMatrix()

    const ambient = new AmbientLight('#7c8bff', 0.52)
    const key = new DirectionalLight('#e8ecff', 1.36)
    key.position.set(3.2, 4.6, 5.2)
    const cyan = new PointLight('#63ecff', 22, 20, 1.7)
    cyan.position.set(-2.1, 0.9, -5.4)
    const pink = new PointLight('#ff6ddb', 20, 19, 1.8)
    pink.position.set(2.1, -1.1, -2.2)
    this.scene.add(ambient, key, cyan, pink)

    this.createDepthGrid()
    this.createHypnoRings()
    this.createFlowShapes()
    this.scene.add(this.ringGroup, this.shapeGroup)
  }

  protected override update(deltaMs: number): void {
    this.elapsedMs += deltaMs
    const t = this.elapsedMs * 0.001

    this.ringGroup.rotation.z = Math.sin(t * 0.18) * 0.2
    this.ringGroup.position.x = Math.sin(t * 0.42) * 0.18
    this.ringGroup.position.y = Math.cos(t * 0.36) * 0.14
    this.shapeGroup.rotation.z = Math.sin(t * 0.22) * 0.28

    for (const ring of this.rings) {
      const pulse = (Math.sin(t * 2.4 + ring.pulsePhase) + 1) * 0.5
      const drift = Math.sin(t * 0.95 + ring.driftPhase) * 0.32
      ring.mesh.rotation.z += ring.rotationSpeed * deltaMs * 0.001
      ring.mesh.position.z = ring.baseZ + drift
      ring.mesh.scale.setScalar(0.8 + pulse * 0.58)
      ring.mesh.material.opacity = 0.16 + pulse * 0.44
    }

    for (const shape of this.flowShapes) {
      const orbitT = t * shape.spinSpeed + shape.phase
      const orbitX = Math.cos(orbitT) * shape.orbitRadius
      const orbitY = Math.sin(orbitT * 1.35) * (shape.orbitRadius * 0.46) + shape.verticalOffset
      const orbitZ = Math.sin(orbitT * 0.86 + shape.phase) * 1.35 + shape.depthOffset
      shape.mesh.position.set(orbitX, orbitY, -2.6 + orbitZ)

      const pulse = (Math.sin(t * 4.8 + shape.phase * 2.2) + 1) * 0.5
      if (shape.kind === 'diamond') {
        shape.mesh.rotation.set(pulse * 0.9, t * 1.25 + shape.phase, Math.PI * 0.25)
        shape.mesh.scale.set(0.75 + pulse * 0.55, 1.4 + pulse * 1.05, 0.75 + pulse * 0.55)
      } else if (shape.kind === 'bar') {
        shape.mesh.rotation.set(t * 1.5 + shape.phase, pulse * 0.7, pulse * 0.45)
        shape.mesh.scale.set(0.4 + pulse * 0.3, 1.2 + pulse * 0.9, 0.4 + pulse * 0.3)
      } else {
        shape.mesh.rotation.set(t * 1.2 + shape.phase, t * 0.8, pulse * 0.5)
        shape.mesh.scale.setScalar(0.5 + pulse * 0.65)
      }
      shape.mesh.material.opacity = 0.2 + pulse * 0.55
    }

    if (this.gridLines !== null) {
      this.gridLines.material.opacity = 0.08 + (Math.sin(t * 1.9) + 1) * 0.06
    }
  }

  protected override beforeDestroy(): void {
    this.gridLines?.geometry.dispose()
    this.gridLines?.material.dispose()
    this.gridLines = null
    for (const material of this.shapeMaterialPool) {
      material.dispose()
    }
    this.shapeMaterialPool.length = 0
    this.shapeGeometry.dispose()
    this.flowShapes.length = 0
    this.rings.length = 0
  }

  private createHypnoRings(): void {
    for (let index = 0; index < RING_COUNT; index += 1) {
      const t = index / Math.max(1, RING_COUNT - 1)
      const innerRadius = 0.42 + t * 1.8
      const outerRadius = innerRadius + 0.055 + t * 0.08
      const geometry = new RingGeometry(innerRadius, outerRadius, 96)

      const hue = 0.54 + t * 0.35
      const color = new Color().setHSL(hue > 1 ? hue - 1 : hue, 0.92, 0.64)
      const material = new MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.28,
        blending: AdditiveBlending,
        depthWrite: false,
      })

      const mesh = new Mesh(geometry, material)
      mesh.position.z = -1.2 - t * 4.6
      mesh.rotation.z = t * Math.PI * 2
      this.ringGroup.add(mesh)

      this.rings.push({
        mesh,
        baseZ: mesh.position.z,
        rotationSpeed: MathUtils.lerp(0.2, 1.15, t) * (index % 2 === 0 ? 1 : -1),
        pulsePhase: MathUtils.randFloat(0, Math.PI * 2),
        driftPhase: MathUtils.randFloat(0, Math.PI * 2),
      })
    }
  }

  private createFlowShapes(): void {
    const colors = ['#5df3ff', '#ff65dd', '#7b86ff', '#6cffbc', '#ffd46b']
    for (let index = 0; index < FLOW_SHAPE_COUNT; index += 1) {
      const color = colors[index % colors.length] ?? '#5df3ff'
      const material = new MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.42,
        blending: AdditiveBlending,
        depthWrite: false,
      })
      this.shapeMaterialPool.push(material)
      const mesh = new Mesh(this.shapeGeometry, material)
      const mode = index % 3
      const kind: FlowShape['kind'] = mode === 0 ? 'diamond' : mode === 1 ? 'bar' : 'cube'
      this.shapeGroup.add(mesh)
      this.flowShapes.push({
        mesh,
        kind,
        orbitRadius: MathUtils.randFloat(0.4, 2.5),
        spinSpeed: MathUtils.randFloat(0.35, 1.35),
        verticalOffset: MathUtils.randFloatSpread(3.9),
        depthOffset: MathUtils.randFloat(-2.4, 2.4),
        phase: MathUtils.randFloat(0, Math.PI * 2),
      })
    }
  }

  private createDepthGrid(): void {
    const positions: number[] = []
    const width = 4.6
    const height = 8.2
    const depthStart = -0.7
    const depthEnd = -6.4
    const xLines = 10
    const yLines = 17
    const zSlices = 6

    for (let z = 0; z <= zSlices; z += 1) {
      const zPos = MathUtils.lerp(depthStart, depthEnd, z / zSlices)
      for (let xi = 0; xi <= xLines; xi += 1) {
        const x = MathUtils.lerp(-width * 0.5, width * 0.5, xi / xLines)
        positions.push(x, -height * 0.5, zPos, x, height * 0.5, zPos)
      }
      for (let yi = 0; yi <= yLines; yi += 1) {
        const y = MathUtils.lerp(-height * 0.5, height * 0.5, yi / yLines)
        positions.push(-width * 0.5, y, zPos, width * 0.5, y, zPos)
      }
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    const material = new LineBasicMaterial({
      color: '#6d86ff',
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    })
    this.gridLines = new LineSegments(geometry, material)
    this.scene.add(this.gridLines)
  }
}
