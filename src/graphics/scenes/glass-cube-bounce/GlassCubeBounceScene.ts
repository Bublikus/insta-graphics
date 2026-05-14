import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PointLight,
  SphereGeometry,
  Vector3,
  WebGLCubeRenderTarget,
  CubeCamera,
  HalfFloatType,
  Texture,
} from 'three'
import { BaseThreeScene } from '../../base/BaseThreeScene'
import { createBallTexture } from './ballTextureFactory'

interface BallBody {
  mesh: Mesh<SphereGeometry, MeshPhysicalMaterial>
  position: Vector3
  velocity: Vector3
  radius: number
  mass: number
}

const BALL_COUNT = 5
const FIXED_STEP_SEC = 1 / 120

export class GlassCubeBounceScene extends BaseThreeScene {
  private readonly bounds = new Vector3(1.2, 2.15, 3.3)
  private readonly chamberCenter = new Vector3(0, 0, -2.2)
  private readonly gravity = new Vector3(0, -7.5, 0)
  private readonly restitution = 0.94
  private readonly linearDrag = 0.9995
  private readonly minSpeed = 1.25
  private readonly balls: BallBody[] = []
  private readonly disposableTextures: Texture[] = []

  private cubeShell: Mesh<BoxGeometry, MeshPhysicalMaterial> | null = null
  private cubeEdges: LineSegments | null = null
  private reflectorProbe: CubeCamera | null = null
  private reflectorTarget: WebGLCubeRenderTarget | null = null
  private accumulatorSec = 0
  private probeFrameCounter = 0

  protected override afterSetup(): void {
    this.scene.background = new Color('#04050a')
    this.scene.fog = null

    const camera = this.camera as PerspectiveCamera
    camera.fov = 36
    camera.near = 0.1
    camera.far = 100
    camera.position.set(0, 0.05, 5.8)
    camera.lookAt(this.chamberCenter.x, this.chamberCenter.y, this.chamberCenter.z)
    camera.updateProjectionMatrix()

    const ambient = new AmbientLight('#b6c8ff', 0.38)
    const keyLight = new DirectionalLight('#eff5ff', 2.1)
    keyLight.position.set(4.6, 5.2, 7.8)
    const bounceLight = new PointLight('#95b7ff', 25, 24, 2)
    bounceLight.position.set(-1.4, -2.5, -2.4)
    const rimLight = new PointLight('#96ffff', 34, 25, 2)
    rimLight.position.set(0.4, 2.9, -6.2)
    this.scene.add(ambient, keyLight, bounceLight, rimLight)

    this.reflectorTarget = new WebGLCubeRenderTarget(256, {
      type: HalfFloatType,
    })
    this.reflectorProbe = new CubeCamera(0.1, 40, this.reflectorTarget)
    this.scene.environment = this.reflectorTarget.texture
    this.scene.add(this.reflectorProbe)

    const shellGeometry = new BoxGeometry(this.bounds.x * 2, this.bounds.y * 2, this.bounds.z * 2)
    const shellMaterial = new MeshPhysicalMaterial({
      color: '#b8d8ff',
      metalness: 1,
      roughness: 0.03,
      transmission: 0.15,
      thickness: 0.8,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.25,
      side: BackSide,
    })
    this.cubeShell = new Mesh(shellGeometry, shellMaterial)
    this.cubeShell.position.copy(this.chamberCenter)
    this.scene.add(this.cubeShell)

    const edgeGeometry = new EdgesGeometry(shellGeometry)
    const edgeMaterial = new LineBasicMaterial({
      color: '#d8ebff',
      transparent: true,
      opacity: 0.52,
    })
    this.cubeEdges = new LineSegments(edgeGeometry, edgeMaterial)
    this.cubeEdges.position.copy(this.chamberCenter)
    this.scene.add(this.cubeEdges)

    this.createBalls()
  }

  protected override update(deltaMs: number): void {
    const stepSec = FIXED_STEP_SEC
    const deltaSec = Math.min(deltaMs * 0.001, 0.05)
    this.accumulatorSec += deltaSec

    while (this.accumulatorSec >= stepSec) {
      this.stepPhysics(stepSec)
      this.accumulatorSec -= stepSec
    }

    if (this.renderer !== null && this.reflectorProbe !== null) {
      this.probeFrameCounter = (this.probeFrameCounter + 1) % 2
      if (this.probeFrameCounter === 0) {
        this.reflectorProbe.update(this.renderer, this.scene)
      }
    }
  }

  protected override beforeDestroy(): void {
    for (const texture of this.disposableTextures) {
      texture.dispose()
    }
    this.disposableTextures.length = 0
    this.balls.length = 0
    this.cubeShell = null
    this.cubeEdges = null
    this.reflectorProbe = null
    this.reflectorTarget?.dispose()
    this.reflectorTarget = null
  }

  private createBalls(): void {
    const colorPairs = [
      ['#5d6cff', '#ff8fd2'],
      ['#2ec4ff', '#d8ff57'],
      ['#ff5d9e', '#ffd86f'],
      ['#9f8cff', '#78ffe6'],
      ['#8dff72', '#79d0ff'],
    ] as const

    for (let index = 0; index < BALL_COUNT; index += 1) {
      const radius = 0.43 + index * 0.06
      const colorPair = colorPairs[index % colorPairs.length] ?? ['#5d6cff', '#ff8fd2']
      const [baseColor, accentColor] = colorPair
      const map = createBallTexture(baseColor, accentColor)
      this.disposableTextures.push(map)

      const geometry = new SphereGeometry(radius, 48, 48)
      const material = new MeshPhysicalMaterial({
        map,
        roughness: 0.2,
        metalness: 0.16,
        clearcoat: 0.65,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.5,
      })
      const mesh = new Mesh(geometry, material)
      mesh.castShadow = false
      mesh.receiveShadow = false

      const position = this.sampleNonOverlappingPosition(radius)
      mesh.position.copy(position)
      this.scene.add(mesh)

      const velocity = new Vector3(
        MathUtils.randFloatSpread(2.8),
        MathUtils.randFloat(0.8, 3.9),
        MathUtils.randFloatSpread(2.8),
      )
      const mass = radius * radius * radius

      this.balls.push({
        mesh,
        position,
        velocity,
        radius,
        mass,
      })
    }
  }

  private sampleNonOverlappingPosition(radius: number): Vector3 {
    const candidate = new Vector3()
    for (let attempt = 0; attempt < 120; attempt += 1) {
      candidate.set(
        MathUtils.randFloat(
          this.chamberCenter.x - this.bounds.x + radius,
          this.chamberCenter.x + this.bounds.x - radius,
        ),
        MathUtils.randFloat(
          this.chamberCenter.y - this.bounds.y + radius + 0.15,
          this.chamberCenter.y + this.bounds.y - radius,
        ),
        MathUtils.randFloat(
          this.chamberCenter.z - this.bounds.z + radius,
          this.chamberCenter.z + this.bounds.z - radius,
        ),
      )

      let intersects = false
      for (const ball of this.balls) {
        const minDistance = radius + ball.radius + 0.05
        if (candidate.distanceToSquared(ball.position) < minDistance * minDistance) {
          intersects = true
          break
        }
      }

      if (!intersects) {
        return candidate.clone()
      }
    }

    return new Vector3(0, 0, 0)
  }

  private stepPhysics(dtSec: number): void {
    for (const ball of this.balls) {
      ball.velocity.addScaledVector(this.gravity, dtSec)
      ball.velocity.multiplyScalar(this.linearDrag)
      ball.position.addScaledVector(ball.velocity, dtSec)
      this.resolveBoundsCollision(ball)
    }

    for (let i = 0; i < this.balls.length; i += 1) {
      for (let j = i + 1; j < this.balls.length; j += 1) {
        const ballA = this.balls[i]
        const ballB = this.balls[j]
        if (ballA !== undefined && ballB !== undefined) {
          this.resolveBallCollision(ballA, ballB)
        }
      }
    }

    for (const ball of this.balls) {
      this.maintainMotion(ball)
      ball.mesh.position.copy(ball.position)
      ball.mesh.rotation.x += ball.velocity.z * dtSec * 0.32
      ball.mesh.rotation.z -= ball.velocity.x * dtSec * 0.32
    }
  }

  private resolveBoundsCollision(ball: BallBody): void {
    const minX = this.chamberCenter.x - this.bounds.x + ball.radius
    const maxX = this.chamberCenter.x + this.bounds.x - ball.radius
    const minY = this.chamberCenter.y - this.bounds.y + ball.radius
    const maxY = this.chamberCenter.y + this.bounds.y - ball.radius
    const minZ = this.chamberCenter.z - this.bounds.z + ball.radius
    const maxZ = this.chamberCenter.z + this.bounds.z - ball.radius

    if (ball.position.x < minX) {
      ball.position.x = minX
      ball.velocity.x = Math.abs(ball.velocity.x) * this.restitution
    } else if (ball.position.x > maxX) {
      ball.position.x = maxX
      ball.velocity.x = -Math.abs(ball.velocity.x) * this.restitution
    }

    if (ball.position.y < minY) {
      ball.position.y = minY
      ball.velocity.y = Math.abs(ball.velocity.y) * this.restitution
    } else if (ball.position.y > maxY) {
      ball.position.y = maxY
      ball.velocity.y = -Math.abs(ball.velocity.y) * this.restitution
    }

    if (ball.position.z < minZ) {
      ball.position.z = minZ
      ball.velocity.z = Math.abs(ball.velocity.z) * this.restitution
    } else if (ball.position.z > maxZ) {
      ball.position.z = maxZ
      ball.velocity.z = -Math.abs(ball.velocity.z) * this.restitution
    }
  }

  private resolveBallCollision(a: BallBody, b: BallBody): void {
    const delta = b.position.clone().sub(a.position)
    const distanceSq = delta.lengthSq()
    const minDistance = a.radius + b.radius
    if (distanceSq <= 1e-8 || distanceSq >= minDistance * minDistance) {
      return
    }

    const distance = Math.sqrt(distanceSq)
    const normal = delta.multiplyScalar(1 / distance)
    const relativeVelocity = b.velocity.clone().sub(a.velocity)
    const velocityAlongNormal = relativeVelocity.dot(normal)

    const invMassA = 1 / a.mass
    const invMassB = 1 / b.mass
    const totalInvMass = invMassA + invMassB

    if (velocityAlongNormal < 0) {
      const impulseMagnitude = (-(1 + this.restitution) * velocityAlongNormal) / totalInvMass
      const impulse = normal.clone().multiplyScalar(impulseMagnitude)
      a.velocity.addScaledVector(impulse, -invMassA)
      b.velocity.addScaledVector(impulse, invMassB)
    }

    const penetration = minDistance - distance
    const correction = normal.clone().multiplyScalar((penetration / totalInvMass) * 0.82)
    a.position.addScaledVector(correction, -invMassA)
    b.position.addScaledVector(correction, invMassB)
  }

  private maintainMotion(ball: BallBody): void {
    const speedSq = ball.velocity.lengthSq()
    const minSpeedSq = this.minSpeed * this.minSpeed
    if (speedSq < minSpeedSq) {
      const lift = MathUtils.randFloat(0.45, 0.95)
      const boostDirection = new Vector3(
        MathUtils.randFloatSpread(1),
        MathUtils.randFloat(0.2, 1),
        MathUtils.randFloatSpread(1),
      ).normalize()

      ball.velocity.addScaledVector(boostDirection, this.minSpeed * 0.38)
      ball.velocity.y += lift
    }

    const floorY = this.chamberCenter.y - this.bounds.y + ball.radius
    const nearFloor = ball.position.y <= floorY + 0.03
    if (nearFloor && ball.velocity.y < this.minSpeed * 0.9) {
      ball.velocity.y = this.minSpeed + MathUtils.randFloat(0.25, 1.1)
      ball.velocity.x += MathUtils.randFloatSpread(0.35)
      ball.velocity.z += MathUtils.randFloatSpread(0.35)
    }
  }
}
