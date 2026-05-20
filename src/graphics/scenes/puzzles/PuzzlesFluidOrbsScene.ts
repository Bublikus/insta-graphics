import {
  AmbientLight,
  Color,
  DirectionalLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  Vector3,
} from 'three'
import { FallingBallsStaticScene } from '../falling-balls/FallingBallsStaticScene'

interface FluidOrb {
  mesh: Mesh<SphereGeometry, MeshStandardMaterial>
  position: Vector3
  velocity: Vector3
}

const ORB_COUNT = 5
const ORB_RADIUS = 0.58
const FIXED_STEP_SEC = 1 / 120
const MAX_SPEED = 1.65
const INTERACTION_RADIUS = 1.95
const COHESION_RADIUS = 3.6
const PRESSURE_STRENGTH = 1.1
const VISCOSITY_STRENGTH = 2.65
const COHESION_STRENGTH = 2.45
const SURFACE_TENSION_STRENGTH = 2.7
const CENTER_PULL_STRENGTH = 0.46
const DRAG = 0.972
const WALL_BOUNCE = 0.6

export class PuzzlesFluidOrbsScene extends FallingBallsStaticScene {
  private readonly orbs: FluidOrb[] = []
  private readonly orbGeometry = new SphereGeometry(ORB_RADIUS, 28, 28)
  private accumulatorSec = 0
  private elapsedMs = 0

  protected override afterSetup(): void {
    super.afterSetup()
    this.scene.background = new Color('#050711')

    const ambient = new AmbientLight('#8eb0ff', 0.35)
    const key = new DirectionalLight('#e8f1ff', 1.2)
    key.position.set(3.5, 4.8, 5.4)
    const coolFill = new PointLight('#56d8ff', 10, 14, 1.7)
    coolFill.position.set(-1.8, 0.7, -5.4)
    const warmFill = new PointLight('#ff8cc6', 9, 13, 1.7)
    warmFill.position.set(1.9, -1.3, -1.2)
    this.scene.add(ambient, key, coolFill, warmFill)

    this.createOrbs()
  }

  protected override update(deltaMs: number): void {
    this.elapsedMs += deltaMs
    this.accumulatorSec += Math.min(deltaMs * 0.001, 0.05)
    while (this.accumulatorSec >= FIXED_STEP_SEC) {
      this.accumulatorSec -= FIXED_STEP_SEC
      this.stepFluid(FIXED_STEP_SEC)
    }

    const t = this.elapsedMs * 0.001
    for (const orb of this.orbs) {
      orb.mesh.position.copy(orb.position)
      orb.mesh.rotation.x += orb.velocity.z * FIXED_STEP_SEC * 0.22
      orb.mesh.rotation.z -= orb.velocity.x * FIXED_STEP_SEC * 0.22
      const glow = 0.22 + (Math.sin(t * 2.3 + orb.position.x * 1.8 + orb.position.y) + 1) * 0.14
      orb.mesh.material.emissiveIntensity = glow
    }
  }

  protected override beforeDestroy(): void {
    this.orbGeometry.dispose()
    this.orbs.length = 0
    super.beforeDestroy()
  }

  private createOrbs(): void {
    const colors = ['#70e8ff', '#ffd27e', '#ff8de0', '#9c9bff', '#7dffbf'] as const
    const bounds = this.getBoundsForRadius(ORB_RADIUS)

    for (let index = 0; index < ORB_COUNT; index += 1) {
      const color = colors[index % colors.length] ?? '#70e8ff'
      const material = new MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.24,
        roughness: 0.12,
        metalness: 0.02,
        transparent: true,
        opacity: 0.86,
      })
      const mesh = new Mesh(this.orbGeometry, material)
      const position = new Vector3(
        MathUtils.randFloat(bounds.minX + ORB_RADIUS * 0.35, bounds.maxX - ORB_RADIUS * 0.35),
        MathUtils.randFloat(bounds.minY + ORB_RADIUS * 0.6, bounds.maxY - ORB_RADIUS * 0.6),
        MathUtils.randFloat(bounds.minZ + ORB_RADIUS * 0.35, bounds.maxZ - ORB_RADIUS * 0.35),
      )
      const velocity = new Vector3(MathUtils.randFloatSpread(1), MathUtils.randFloatSpread(0.85), MathUtils.randFloatSpread(1))
      mesh.position.copy(position)
      this.scene.add(mesh)
      this.orbs.push({ mesh, position, velocity })
    }
  }

  private stepFluid(dtSec: number): void {
    const forces = this.orbs.map(() => new Vector3())
    for (let i = 0; i < this.orbs.length; i += 1) {
      const a = this.orbs[i]
      if (a === undefined) {
        continue
      }
      for (let j = i + 1; j < this.orbs.length; j += 1) {
        const b = this.orbs[j]
        if (b === undefined) {
          continue
        }

        const delta = b.position.clone().sub(a.position)
        const distance = Math.max(1e-4, delta.length())
        const dir = delta.multiplyScalar(1 / distance)
        const forceA = forces[i]
        const forceB = forces[j]
        if (forceA === undefined || forceB === undefined) {
          continue
        }

        if (distance < INTERACTION_RADIUS) {
          const proximity = 1 - distance / INTERACTION_RADIUS
          const targetDistance = ORB_RADIUS * 1.18
          const deviation = distance - targetDistance
          const tension = dir.clone().multiplyScalar(-deviation * SURFACE_TENSION_STRENGTH * proximity)
          forceA.add(tension)
          forceB.addScaledVector(tension, -1)

          if (distance < ORB_RADIUS * 0.68) {
            const pressure = dir.clone().multiplyScalar(-PRESSURE_STRENGTH * (1 - distance / (ORB_RADIUS * 0.68)))
            forceA.add(pressure)
            forceB.addScaledVector(pressure, -1)
          }

          const relativeVelocity = b.velocity.clone().sub(a.velocity)
          const viscosity = relativeVelocity.multiplyScalar(VISCOSITY_STRENGTH * proximity)
          forceA.add(viscosity)
          forceB.addScaledVector(viscosity, -1)
        } else if (distance < COHESION_RADIUS) {
          const attraction = ((distance - INTERACTION_RADIUS) / (COHESION_RADIUS - INTERACTION_RADIUS)) * COHESION_STRENGTH
          const pull = dir.clone().multiplyScalar(attraction)
          forceA.add(pull)
          forceB.addScaledVector(pull, -1)
        }
      }
    }

    const bounds = this.getBoundsForRadius(ORB_RADIUS)
    const t = this.elapsedMs * 0.001
    for (let index = 0; index < this.orbs.length; index += 1) {
      const orb = this.orbs[index]
      const force = forces[index]
      if (orb === undefined || force === undefined) {
        continue
      }

      const swirl = new Vector3(
        Math.sin(t * 0.9 + orb.position.y * 1.3 + index) * 0.65,
        Math.cos(t * 1.1 + orb.position.z * 1.2 + index * 0.7) * 0.42,
        Math.sin(t * 1.0 + orb.position.x * 1.4 + index * 0.5) * 0.65,
      )
      force.add(swirl)
      force.addScaledVector(this.chamberCenter.clone().sub(orb.position), CENTER_PULL_STRENGTH)

      orb.velocity.addScaledVector(force, dtSec)
      orb.velocity.multiplyScalar(DRAG)
      const speed = orb.velocity.length()
      if (speed > MAX_SPEED) {
        orb.velocity.multiplyScalar(MAX_SPEED / speed)
      }

      orb.position.addScaledVector(orb.velocity, dtSec)
      this.resolveBounds(orb, bounds)
    }
  }

  private resolveBounds(
    orb: FluidOrb,
    bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
  ): void {
    if (orb.position.x < bounds.minX) {
      orb.position.x = bounds.minX
      orb.velocity.x = Math.abs(orb.velocity.x) * WALL_BOUNCE
    } else if (orb.position.x > bounds.maxX) {
      orb.position.x = bounds.maxX
      orb.velocity.x = -Math.abs(orb.velocity.x) * WALL_BOUNCE
    }

    if (orb.position.y < bounds.minY) {
      orb.position.y = bounds.minY
      orb.velocity.y = Math.abs(orb.velocity.y) * WALL_BOUNCE
    } else if (orb.position.y > bounds.maxY) {
      orb.position.y = bounds.maxY
      orb.velocity.y = -Math.abs(orb.velocity.y) * WALL_BOUNCE
    }

    if (orb.position.z < bounds.minZ) {
      orb.position.z = bounds.minZ
      orb.velocity.z = Math.abs(orb.velocity.z) * WALL_BOUNCE
    } else if (orb.position.z > bounds.maxZ) {
      orb.position.z = bounds.maxZ
      orb.velocity.z = -Math.abs(orb.velocity.z) * WALL_BOUNCE
    }
  }
}
