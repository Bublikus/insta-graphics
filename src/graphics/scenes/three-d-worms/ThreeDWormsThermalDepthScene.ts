import {
  AdditiveBlending,
  BoxGeometry,
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
} from 'three'
import { ThreeDWormsScene } from './ThreeDWormsScene'

interface EmberParticle {
  mesh: Mesh<BoxGeometry, MeshBasicMaterial>
  phase: number
  speed: number
  orbit: number
  baseY: number
  baseZ: number
}

interface HeatSlice {
  mesh: Mesh<PlaneGeometry, MeshBasicMaterial>
  depthIndex: number
}

const THERMAL_SLICE_COUNT = 7
const EMBER_COUNT = 84

export class ThreeDWormsThermalDepthScene extends ThreeDWormsScene {
  private readonly fxCenter = new Vector3(0, 0, -2.4)
  private readonly fxGroup = new Group()
  private readonly emberGeometry = new BoxGeometry(0.065, 0.065, 0.065)
  private readonly embers: EmberParticle[] = []
  private readonly heatSlices: HeatSlice[] = []
  private thermalElapsedMs = 0

  protected override afterSetup(): void {
    super.afterSetup()
    this.createThermalSlices()
    this.createHeatColumns()
    this.createEmbers()
    this.scene.add(this.fxGroup)
  }

  protected override update(deltaMs: number): void {
    super.update(deltaMs)
    this.thermalElapsedMs += deltaMs
    this.animateHeatSlices()
    this.animateEmbers()
  }

  protected override beforeDestroy(): void {
    for (const ember of this.embers) {
      ember.mesh.material.dispose()
    }
    this.embers.length = 0
    this.emberGeometry.dispose()

    for (const slice of this.heatSlices) {
      slice.mesh.material.dispose()
      slice.mesh.geometry.dispose()
    }
    this.heatSlices.length = 0

    super.beforeDestroy()
  }

  private createThermalSlices(): void {
    for (let index = 0; index < THERMAL_SLICE_COUNT; index += 1) {
      const t = index / Math.max(1, THERMAL_SLICE_COUNT - 1)
      const z = MathUtils.lerp(this.fxCenter.z + 1.95, this.fxCenter.z - 3.95, t)

      const material = new MeshBasicMaterial({
        color: this.pickThermalColor(t),
        transparent: true,
        opacity: MathUtils.lerp(0.028, 0.125, t),
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      })

      const mesh = new Mesh(new PlaneGeometry(4.35, 7.85), material)
      mesh.position.set(this.fxCenter.x, this.fxCenter.y, z)
      this.fxGroup.add(mesh)
      this.heatSlices.push({ mesh, depthIndex: index })
    }
  }

  private createHeatColumns(): void {
    const columnGeometry = new PlaneGeometry(0.22, 7.9)
    const xPositions = [-1.94, -1.45, -0.96, -0.47, 0.02, 0.51, 1, 1.49, 1.98]

    for (let index = 0; index < xPositions.length; index += 1) {
      const x = xPositions[index] ?? 0
      const material = new MeshBasicMaterial({
        color: index % 2 === 0 ? '#ff6f47' : '#ffb357',
        transparent: true,
        opacity: 0.048,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      })
      const mesh = new Mesh(columnGeometry.clone(), material)
      mesh.position.set(this.fxCenter.x + x, this.fxCenter.y, this.fxCenter.z - 1.08)
      this.fxGroup.add(mesh)
    }
  }

  private createEmbers(): void {
    const colors = ['#ffd062', '#ff9f55', '#ff7a4b', '#ffbe7c']

    for (let index = 0; index < EMBER_COUNT; index += 1) {
      const material = new MeshBasicMaterial({
        color: colors[index % colors.length] ?? '#ffd062',
        transparent: true,
        opacity: 0.35,
        blending: AdditiveBlending,
        depthWrite: false,
      })
      const mesh = new Mesh(this.emberGeometry, material)
      this.fxGroup.add(mesh)

      this.embers.push({
        mesh,
        phase: Math.random() * Math.PI * 2,
        speed: MathUtils.randFloat(0.35, 1.1),
        orbit: MathUtils.randFloat(0.2, 1.35),
        baseY: MathUtils.randFloat(-3.9, 3.9),
        baseZ: MathUtils.randFloat(-4.45, 0.85),
      })
    }
  }

  private animateHeatSlices(): void {
    const t = this.thermalElapsedMs * 0.001
    for (const slice of this.heatSlices) {
      const depthT = slice.depthIndex / Math.max(1, THERMAL_SLICE_COUNT - 1)
      const sway = Math.sin(t * (0.52 + depthT * 0.3) + depthT * 4.7) * (0.04 + depthT * 0.08)
      slice.mesh.position.x = this.fxCenter.x + sway
      slice.mesh.rotation.z = Math.sin(t * (0.45 + depthT * 0.18) + depthT * 3.1) * 0.04
      slice.mesh.material.opacity = MathUtils.lerp(0.024, 0.12, depthT) + (Math.sin(t * 1.2 + depthT * 9) + 1) * 0.012
    }
  }

  private animateEmbers(): void {
    const t = this.thermalElapsedMs * 0.001

    for (const ember of this.embers) {
      const yLift = Math.sin(t * 1.2 + ember.phase) * 0.5 + t * 0.26 * ember.speed
      const wrappedY = ((ember.baseY + yLift + 5.2) % 10.4) - 5.2
      const angle = ember.phase + t * ember.speed

      ember.mesh.position.set(
        this.fxCenter.x + Math.cos(angle * 1.35) * ember.orbit,
        this.fxCenter.y + wrappedY,
        this.fxCenter.z + ember.baseZ + Math.sin(angle * 0.7) * 0.22,
      )

      const depthNormalized = MathUtils.clamp((ember.mesh.position.z - (this.fxCenter.z - 4.5)) / 5.7, 0, 1)
      const nearBoost = 1 - depthNormalized
      const flicker = (Math.sin(t * 5.5 + ember.phase * 2.8) + 1) * 0.5
      ember.mesh.material.opacity = 0.16 + nearBoost * 0.3 + flicker * 0.18
      ember.mesh.scale.setScalar(0.6 + nearBoost * 0.75 + flicker * 0.35)
    }
  }

  private pickThermalColor(t: number): string {
    if (t < 0.22) {
      return '#ffcf72'
    }
    if (t < 0.44) {
      return '#ff9e57'
    }
    if (t < 0.68) {
      return '#ff734b'
    }
    if (t < 0.86) {
      return '#ff543f'
    }
    return '#ff3b35'
  }
}
