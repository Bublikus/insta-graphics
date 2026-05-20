import {
  AmbientLight,
  CanvasTexture,
  DirectionalLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { FallingBallsStaticScene } from './FallingBallsStaticScene'

interface FallingBallBody {
  mesh: Mesh<SphereGeometry, MeshStandardMaterial>
  position: Vector3
  velocity: Vector3
  radius: number
  mass: number
  sleeping: boolean
  sleepFrames: number
}

interface BakedBallFrame {
  count: number
  positions: Float32Array
}

const MAX_BALLS = 10000
const BALL_RADIUS = 0.11
const BALL_SPAWN_INTERVAL_MS = 6
const FIXED_STEP_SEC = 1 / 90
const GRAVITY_Y = -9.8
const AIR_DRAG = 0.9988
const RESTITUTION = 0.34
const FLOOR_FRICTION = 0.986
const SPATIAL_CELL_SIZE = BALL_RADIUS * 2.4
const COLLISION_SOLVER_ITERATIONS = 2
const SLEEP_SPEED_THRESHOLD = 0.035
const SLEEP_FRAMES_REQUIRED = 20
const WAKE_VELOCITY_THRESHOLD = 0.1
const MAX_SPAWNS_PER_FRAME = 28

export class FallingBallsGravityFillScene extends FallingBallsStaticScene {
  private readonly balls: FallingBallBody[] = []
  private readonly spatialMap = new Map<string, number[]>()
  private readonly ballGeometry = new SphereGeometry(BALL_RADIUS, 10, 10)
  private readonly ballMaterials: MeshStandardMaterial[] = []
  private readonly ballTextures: CanvasTexture[] = []
  private readonly dynamicIndices: number[] = []
  private readonly tmpDelta = new Vector3()
  private readonly tmpRelativeVelocity = new Vector3()
  private readonly tmpImpulse = new Vector3()
  private accumulatorSec = 0
  private spawnAccumulatorMs = 0
  private spawnedCount = 0

  protected override afterSetup(): void {
    super.afterSetup()

    const ambient = new AmbientLight('#f0f2ff', 0.42)
    const key = new DirectionalLight('#ffe5c5', 1.5)
    key.position.set(2.4, 5.8, 3.6)
    const warmFill = new PointLight('#ff9652', 14, 20, 1.8)
    warmFill.position.set(0, 2.9, -1.8)
    const coolRim = new PointLight('#86b1ff', 12, 20, 1.8)
    coolRim.position.set(-2.4, 0.8, -6.2)
    this.scene.add(ambient, key, warmFill, coolRim)

    this.createBallMaterials()
  }

  protected override update(deltaMs: number): void {
    this.spawnAccumulatorMs += deltaMs
    let spawnsThisFrame = 0
    while (
      this.spawnedCount < MAX_BALLS &&
      this.spawnAccumulatorMs >= BALL_SPAWN_INTERVAL_MS &&
      spawnsThisFrame < MAX_SPAWNS_PER_FRAME
    ) {
      this.spawnAccumulatorMs -= BALL_SPAWN_INTERVAL_MS
      this.spawnBall()
      spawnsThisFrame += 1
    }

    const deltaSec = Math.min(deltaMs * 0.001, 0.05)
    this.accumulatorSec += deltaSec
    while (this.accumulatorSec >= FIXED_STEP_SEC) {
      this.accumulatorSec -= FIXED_STEP_SEC
      this.stepPhysics(FIXED_STEP_SEC)
    }
  }

  protected override beforeDestroy(): void {
    for (const material of this.ballMaterials) {
      material.dispose()
    }
    this.ballMaterials.length = 0
    for (const texture of this.ballTextures) {
      texture.dispose()
    }
    this.ballTextures.length = 0
    this.ballGeometry.dispose()
    this.resetSimulationState()
    super.beforeDestroy()
  }

  protected override supportsBake(): boolean {
    return true
  }

  protected override resetForBake(): void {
    this.resetSimulationState()
  }

  protected override captureBakeFrame(): unknown {
    const positions = new Float32Array(this.balls.length * 3)
    for (let index = 0; index < this.balls.length; index += 1) {
      const ball = this.balls[index]
      if (ball === undefined) {
        continue
      }
      const base = index * 3
      positions[base] = ball.position.x
      positions[base + 1] = ball.position.y
      positions[base + 2] = ball.position.z
    }
    return {
      count: this.balls.length,
      positions,
    } satisfies BakedBallFrame
  }

  protected override applyBakeFrame(frame: unknown): void {
    if (!this.isBakedBallFrame(frame)) {
      return
    }

    const visibleCount = Math.min(frame.count, this.balls.length)
    for (let index = 0; index < this.balls.length; index += 1) {
      const ball = this.balls[index]
      if (ball === undefined) {
        continue
      }
      if (index >= visibleCount) {
        ball.mesh.visible = false
        continue
      }

      const base = index * 3
      ball.position.set(frame.positions[base] ?? 0, frame.positions[base + 1] ?? 0, frame.positions[base + 2] ?? 0)
      ball.mesh.visible = true
      ball.mesh.position.copy(ball.position)
    }
  }

  private createBallMaterials(): void {
    const palettes = [
      ['#ffd39a', '#ff8f5a', '#ffeecf'],
      ['#ffc278', '#ff6f4f', '#ffe2a9'],
      ['#ffcf8b', '#ff7a59', '#fff0c2'],
      ['#f4c7ff', '#be72ff', '#ffe5ff'],
      ['#b7e8ff', '#63b0ff', '#e6f6ff'],
      ['#ffe08f', '#f59f44', '#fff1c6'],
    ] as const

    for (const [base, dark, accent] of palettes) {
      const texture = this.createBallTexture(base, dark, accent)
      this.ballTextures.push(texture)
      this.ballMaterials.push(
        new MeshStandardMaterial({
          color: base,
          map: texture,
          roughness: 0.4,
          metalness: 0.08,
          emissive: accent,
          emissiveIntensity: 0.14,
        }),
      )
    }
  }

  private createBallTexture(base: string, dark: string, accent: string): CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 16
    canvas.height = 16
    const context = canvas.getContext('2d')
    if (context !== null) {
      context.fillStyle = base
      context.fillRect(0, 0, 16, 16)
      context.fillStyle = dark
      context.fillRect(0, 0, 8, 8)
      context.fillRect(8, 8, 8, 8)
      context.fillStyle = accent
      context.fillRect(9, 3, 5, 4)
      context.fillRect(3, 10, 3, 3)
    }

    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.generateMipmaps = false
    texture.needsUpdate = true
    return texture
  }

  private spawnBall(): void {
    const material = this.ballMaterials[this.spawnedCount % this.ballMaterials.length]
    if (material === undefined) {
      return
    }

    const mesh = new Mesh(this.ballGeometry, material)
    const bounds = this.getBoundsForRadius(BALL_RADIUS)
    const position = new Vector3(
      MathUtils.lerp(-0.08, 0.08, Math.random()) + this.chamberCenter.x,
      bounds.maxY,
      MathUtils.lerp(-0.08, 0.08, Math.random()) + this.chamberCenter.z,
    )
    const velocity = new Vector3(
      MathUtils.randFloatSpread(0.36),
      MathUtils.randFloat(-0.12, 0.04),
      MathUtils.randFloatSpread(0.36),
    )
    mesh.position.copy(position)
    mesh.visible = true
    this.scene.add(mesh)

    this.balls.push({
      mesh,
      position,
      velocity,
      radius: BALL_RADIUS,
      mass: BALL_RADIUS * BALL_RADIUS * BALL_RADIUS,
      sleeping: false,
      sleepFrames: 0,
    })
    this.spawnedCount += 1
  }

  private stepPhysics(dtSec: number): void {
    const gravity = GRAVITY_Y
    this.dynamicIndices.length = 0

    for (let index = 0; index < this.balls.length; index += 1) {
      const ball = this.balls[index]
      if (ball === undefined) {
        continue
      }

      if (ball.sleeping) {
        continue
      }

      this.dynamicIndices.push(index)
      ball.velocity.y += gravity * dtSec
      ball.velocity.multiplyScalar(AIR_DRAG)
      ball.position.addScaledVector(ball.velocity, dtSec)
      this.resolveBounds(ball)
    }

    for (let iteration = 0; iteration < COLLISION_SOLVER_ITERATIONS; iteration += 1) {
      this.resolveBallCollisions()
    }

    for (const ball of this.balls) {
      this.trySleep(ball)
      ball.mesh.position.copy(ball.position)
    }
  }

  private resolveBounds(ball: FallingBallBody): void {
    const bounds = this.getBoundsForRadius(ball.radius)

    if (ball.position.x < bounds.minX) {
      ball.position.x = bounds.minX
      ball.velocity.x = Math.abs(ball.velocity.x) * RESTITUTION
      this.wakeBall(ball)
    } else if (ball.position.x > bounds.maxX) {
      ball.position.x = bounds.maxX
      ball.velocity.x = -Math.abs(ball.velocity.x) * RESTITUTION
      this.wakeBall(ball)
    }

    if (ball.position.z < bounds.minZ) {
      ball.position.z = bounds.minZ
      ball.velocity.z = Math.abs(ball.velocity.z) * RESTITUTION
      this.wakeBall(ball)
    } else if (ball.position.z > bounds.maxZ) {
      ball.position.z = bounds.maxZ
      ball.velocity.z = -Math.abs(ball.velocity.z) * RESTITUTION
      this.wakeBall(ball)
    }

    if (ball.position.y < bounds.minY) {
      ball.position.y = bounds.minY
      ball.velocity.y = Math.abs(ball.velocity.y) * RESTITUTION
      ball.velocity.x *= FLOOR_FRICTION
      ball.velocity.z *= FLOOR_FRICTION
      if (Math.abs(ball.velocity.y) < 0.08) {
        ball.velocity.y = 0
      }
      this.wakeBall(ball)
    } else if (ball.position.y > bounds.maxY) {
      ball.position.y = bounds.maxY
      ball.velocity.y = -Math.abs(ball.velocity.y) * RESTITUTION
      this.wakeBall(ball)
    }
  }

  private resolveBallCollisions(): void {
    this.spatialMap.clear()

    for (const index of this.dynamicIndices) {
      const ball = this.balls[index]
      if (ball === undefined) {
        continue
      }
      const key = this.getSpatialKey(ball.position)
      const list = this.spatialMap.get(key)
      if (list === undefined) {
        this.spatialMap.set(key, [index])
      } else {
        list.push(index)
      }
    }

    for (let index = 0; index < this.balls.length; index += 1) {
      const ball = this.balls[index]
      if (ball === undefined) {
        continue
      }
      const cell = this.getSpatialCell(ball.position)
      for (let ox = -1; ox <= 1; ox += 1) {
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let oz = -1; oz <= 1; oz += 1) {
            const key = `${cell.x + ox},${cell.y + oy},${cell.z + oz}`
            const neighborIndices = this.spatialMap.get(key)
            if (neighborIndices === undefined) {
              continue
            }
            for (const neighborIndex of neighborIndices) {
              if (neighborIndex <= index) {
                continue
              }
              const neighbor = this.balls[neighborIndex]
              if (neighbor !== undefined) {
                this.resolvePair(ball, neighbor)
              }
            }
          }
        }
      }
    }
  }

  private resolvePair(a: FallingBallBody, b: FallingBallBody): void {
    this.tmpDelta.subVectors(b.position, a.position)
    const distanceSq = this.tmpDelta.lengthSq()
    const minDistance = a.radius + b.radius
    if (distanceSq <= 1e-9 || distanceSq >= minDistance * minDistance) {
      return
    }

    this.wakeBall(a)
    this.wakeBall(b)

    const distance = Math.sqrt(distanceSq)
    this.tmpDelta.multiplyScalar(1 / distance)
    this.tmpRelativeVelocity.subVectors(b.velocity, a.velocity)
    const velocityAlongNormal = this.tmpRelativeVelocity.dot(this.tmpDelta)

    const invMassA = 1 / a.mass
    const invMassB = 1 / b.mass
    const totalInvMass = invMassA + invMassB

    if (velocityAlongNormal < 0) {
      const impulseMagnitude = (-(1 + RESTITUTION) * velocityAlongNormal) / totalInvMass
      this.tmpImpulse.copy(this.tmpDelta).multiplyScalar(impulseMagnitude)
      a.velocity.addScaledVector(this.tmpImpulse, -invMassA)
      b.velocity.addScaledVector(this.tmpImpulse, invMassB)
    }

    const penetration = minDistance - distance
    if (penetration <= 0) {
      return
    }

    const correctionMagnitude = (penetration + 1e-4) / totalInvMass
    this.tmpImpulse.copy(this.tmpDelta).multiplyScalar(correctionMagnitude)

    if (a.sleeping && !b.sleeping) {
      b.position.addScaledVector(this.tmpImpulse, invMassB)
    } else if (!a.sleeping && b.sleeping) {
      a.position.addScaledVector(this.tmpImpulse, -invMassA)
    } else {
      a.position.addScaledVector(this.tmpImpulse, -invMassA)
      b.position.addScaledVector(this.tmpImpulse, invMassB)
    }

    if (this.tmpRelativeVelocity.lengthSq() > WAKE_VELOCITY_THRESHOLD * WAKE_VELOCITY_THRESHOLD) {
      this.wakeBall(a)
      this.wakeBall(b)
    }
  }

  private getSpatialCell(position: Vector3): { x: number; y: number; z: number } {
    return {
      x: Math.floor(position.x / SPATIAL_CELL_SIZE),
      y: Math.floor(position.y / SPATIAL_CELL_SIZE),
      z: Math.floor(position.z / SPATIAL_CELL_SIZE),
    }
  }

  private getSpatialKey(position: Vector3): string {
    const cell = this.getSpatialCell(position)
    return `${cell.x},${cell.y},${cell.z}`
  }

  private wakeBall(ball: FallingBallBody): void {
    ball.sleeping = false
    ball.sleepFrames = 0
  }

  private trySleep(ball: FallingBallBody): void {
    const speedSq = ball.velocity.lengthSq()
    const thresholdSq = SLEEP_SPEED_THRESHOLD * SLEEP_SPEED_THRESHOLD
    if (speedSq > thresholdSq) {
      ball.sleepFrames = 0
      return
    }

    ball.sleepFrames += 1
    if (ball.sleepFrames >= SLEEP_FRAMES_REQUIRED) {
      ball.sleeping = true
      ball.velocity.set(0, 0, 0)
    }
  }

  private resetSimulationState(): void {
    for (const ball of this.balls) {
      this.scene.remove(ball.mesh)
    }
    this.balls.length = 0
    this.spatialMap.clear()
    this.dynamicIndices.length = 0
    this.accumulatorSec = 0
    this.spawnAccumulatorMs = 0
    this.spawnedCount = 0
  }

  private isBakedBallFrame(frame: unknown): frame is BakedBallFrame {
    if (typeof frame !== 'object' || frame === null) {
      return false
    }
    if (!('count' in frame) || !('positions' in frame)) {
      return false
    }

    const maybeCount = (frame as { count?: unknown }).count
    const maybePositions = (frame as { positions?: unknown }).positions
    return typeof maybeCount === 'number' && maybePositions instanceof Float32Array
  }
}
