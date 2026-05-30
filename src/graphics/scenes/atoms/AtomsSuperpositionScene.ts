import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  MathUtils,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  SphereGeometry,
  Mesh,
  MeshBasicMaterial,
} from 'three'
import { BaseThreeScene } from '../../base/BaseThreeScene'
import type { SceneViewport } from '../../base/BaseGraphicScene'
import type { AtomsSuperpositionSceneConfig } from './atomsSuperpositionConfig'
import {
  densityToColor,
  densityToColorRefined,
  superpositionProbabilityDensity,
  type QuantumState,
} from './hydrogenPhysics'
import { sampleOrbitalCloud, sampleRadiusForStates } from './sampleOrbitalCloud'
import { rotateSuperpositionAboutY } from './superpositionRotation'

/** One precomputed frame: scene-space point positions, quantized colors, and camera position. */
interface AtomsBakeFrame {
  positions: Float32Array
  colors: Uint8Array
  camera: [number, number, number]
}

export class AtomsSuperpositionScene extends BaseThreeScene {
  private readonly atomGroup = new Group()
  private readonly protonGroup = new Group()
  private readonly electronGroup = new Group()
  private electronCloud: Points<BufferGeometry, PointsMaterial> | null = null
  private atomicPositions: Float32Array | null = null
  private electronPositionAttribute: Float32BufferAttribute | null = null
  private electronColorAttribute: Float32BufferAttribute | null = null
  private fitScale = 1
  private metropolisCursor = 0
  private peakDensity = 1
  private densityReference = 1
  private elapsedMs = 0
  private cameraOrbitDistance = 6
  private vortexBaseRadius: Float32Array | null = null
  private vortexBaseAzimuth: Float32Array | null = null
  private vortexAngularVelocity: Float32Array | null = null
  private initialAtomicPositions: Float32Array | null = null
  private initialColors: Float32Array | null = null
  private readonly config: AtomsSuperpositionSceneConfig

  constructor(config: AtomsSuperpositionSceneConfig) {
    super()
    this.config = config
  }

  protected override afterSetup(): void {
    this.scene.background = new Color('#000000')
    if (this.renderer !== null) {
      this.renderer.setClearColor(new Color('#000000'), 1)
    }

    const camera = this.camera as PerspectiveCamera
    camera.fov = 44
    camera.near = 0.05
    camera.far = 120

    this.atomGroup.add(this.protonGroup, this.electronGroup)
    this.createProton()
    this.createElectronCloud()
    this.scene.add(this.atomGroup)
    this.fitCameraToAtom(camera)
  }

  protected override afterResize(viewport: SceneViewport): void {
    this.fitCameraToAtom(this.camera as PerspectiveCamera, viewport.width / viewport.height)
  }

  protected override update(deltaMs: number): void {
    this.elapsedMs += deltaMs
    const t = this.elapsedMs * 0.001

    const camera = this.camera as PerspectiveCamera
    const orbitAzimuth = t * 0.1
    const elevation = this.config.cameraElevation
    const horizontalDistance = this.cameraOrbitDistance * Math.cos(elevation)

    camera.position.x = Math.cos(orbitAzimuth) * horizontalDistance
    camera.position.z = Math.sin(orbitAzimuth) * horizontalDistance
    camera.position.y = Math.sin(elevation) * this.cameraOrbitDistance
    camera.lookAt(0, 0, 0)

    if (this.config.vortexMode) {
      this.applyVortexRotation(t)
      return
    }

    const beta = t * this.config.superpositionYAngularVelocity
    if (this.config.rigidYRotationMode) {
      this.applyRigidYRotation(beta)
    } else {
      this.evolveInternalSuperposition(beta)
    }
  }

  /**
   * Differential vortex rotation about Y driven by the quantum probability current.
   * Each particle keeps its cylindrical radius s and orbits at ω(s) = ω₀·s_core²/(s² + s_core²),
   * i.e. ω ∝ 1/s² away from the regularized core (v_φ = ℏm/m_e·s law) — fast at the
   * center column, slow at the rim, which shears the cloud into a vortex over time.
   */
  private applyVortexRotation(t: number): void {
    const positions = this.electronPositionAttribute
    const atomic = this.atomicPositions
    const radii = this.vortexBaseRadius
    const azimuths = this.vortexBaseAzimuth
    const angularVelocities = this.vortexAngularVelocity
    if (
      positions === null ||
      atomic === null ||
      radii === null ||
      azimuths === null ||
      angularVelocities === null
    ) {
      return
    }

    const scenePositions = positions.array as Float32Array
    const scale = this.config.bohrSceneScale
    const particleCount = radii.length

    for (let particle = 0; particle < particleCount; particle += 1) {
      const offset = particle * 3
      const s = radii[particle] ?? 0
      const phi = (azimuths[particle] ?? 0) + (angularVelocities[particle] ?? 0) * t
      scenePositions[offset] = s * Math.cos(phi) * scale
      scenePositions[offset + 1] = (atomic[offset + 1] ?? 0) * scale
      scenePositions[offset + 2] = s * Math.sin(phi) * scale
    }

    positions.needsUpdate = true
  }

  /** Precompute per-particle cylindrical radius, azimuth and vortex angular velocity. */
  private prepareVortexField(atomic: Float32Array): void {
    const particleCount = atomic.length / 3
    const radii = new Float32Array(particleCount)
    const azimuths = new Float32Array(particleCount)
    const angularVelocities = new Float32Array(particleCount)
    const radiiSorted: number[] = []

    for (let particle = 0; particle < particleCount; particle += 1) {
      const offset = particle * 3
      const x = atomic[offset] ?? 0
      const z = atomic[offset + 2] ?? 0
      const s = Math.hypot(x, z)
      radii[particle] = s
      azimuths[particle] = Math.atan2(z, x)
      radiiSorted.push(s)
    }

    radiiSorted.sort((a, b) => a - b)
    const referenceRadius = radiiSorted[Math.floor(radiiSorted.length * 0.5)] ?? 1
    const coreRadius = Math.max(this.config.vortexCoreFraction * referenceRadius, 1e-3)
    const coreRadiusSquared = coreRadius * coreRadius

    for (let particle = 0; particle < particleCount; particle += 1) {
      const s = radii[particle] ?? 0
      angularVelocities[particle] =
        (this.config.vortexCenterAngularVelocity * coreRadiusSquared) /
        (s * s + coreRadiusSquared)
    }

    this.vortexBaseRadius = radii
    this.vortexBaseAzimuth = azimuths
    this.vortexAngularVelocity = angularVelocities
  }

  /**
   * Rigid rotation of the crisp sampled cloud about Y by β (proton stays fixed).
   * For a single-l superposition this equals the quantum evolution R_y(β)|ψ⟩,
   * so the prototype lobe/torus/bulb structure stays sharp while it revolves.
   */
  private applyRigidYRotation(beta: number): void {
    const atomic = this.atomicPositions
    const positions = this.electronPositionAttribute
    if (atomic === null || positions === null) {
      return
    }

    const scenePositions = positions.array as Float32Array
    const cos = Math.cos(beta)
    const sin = Math.sin(beta)
    const scale = this.config.bohrSceneScale

    for (let offset = 0; offset < atomic.length; offset += 3) {
      const x = atomic[offset] ?? 0
      const y = atomic[offset + 1] ?? 0
      const z = atomic[offset + 2] ?? 0
      scenePositions[offset] = (x * cos + z * sin) * scale
      scenePositions[offset + 1] = y * scale
      scenePositions[offset + 2] = (-x * sin + z * cos) * scale
    }

    positions.needsUpdate = true
  }

  protected override beforeDestroy(): void {
    this.electronCloud?.geometry.dispose()
    this.electronCloud?.material.dispose()
  }

  protected override supportsBake(): boolean {
    return true
  }

  /** Rewind to the pristine t = 0 cloud so a "bake from beginning" is reproducible. */
  protected override resetForBake(): void {
    this.elapsedMs = 0
    this.metropolisCursor = 0
    this.peakDensity = this.estimatePeakDensity(this.config.superpositionStates)
    this.densityReference = this.peakDensity * this.config.recolorPercentile

    const atomic = this.atomicPositions
    if (atomic !== null && this.initialAtomicPositions !== null) {
      atomic.set(this.initialAtomicPositions)
    }

    const positions = this.electronPositionAttribute
    if (positions !== null && atomic !== null) {
      const scenePositions = positions.array as Float32Array
      const scale = this.config.bohrSceneScale
      for (let offset = 0; offset < atomic.length; offset += 3) {
        scenePositions[offset] = (atomic[offset] ?? 0) * scale
        scenePositions[offset + 1] = (atomic[offset + 1] ?? 0) * scale
        scenePositions[offset + 2] = (atomic[offset + 2] ?? 0) * scale
      }
      positions.needsUpdate = true
    }

    const colors = this.electronColorAttribute
    if (colors !== null && this.initialColors !== null) {
      ;(colors.array as Float32Array).set(this.initialColors)
      colors.needsUpdate = true
    }
  }

  /** Snapshot the current frame's GPU buffers + camera (colors quantized to bytes). */
  protected override captureBakeFrame(): unknown {
    const positions = this.electronPositionAttribute
    const colors = this.electronColorAttribute
    if (positions === null || colors === null) {
      return null
    }

    const positionArray = positions.array as Float32Array
    const colorArray = colors.array as Float32Array
    const quantizedColors = new Uint8Array(colorArray.length)
    for (let index = 0; index < colorArray.length; index += 1) {
      const channel = Math.round((colorArray[index] ?? 0) * 255)
      quantizedColors[index] = channel < 0 ? 0 : channel > 255 ? 255 : channel
    }

    const camera = this.camera as PerspectiveCamera
    const frame: AtomsBakeFrame = {
      positions: positionArray.slice(),
      colors: quantizedColors,
      camera: [camera.position.x, camera.position.y, camera.position.z],
    }
    return frame
  }

  /** Replay a precomputed frame: no physics, just buffer copies + camera placement. */
  protected override applyBakeFrame(frame: unknown): void {
    const baked = frame as AtomsBakeFrame | null
    if (baked === null) {
      return
    }

    const positions = this.electronPositionAttribute
    const colors = this.electronColorAttribute
    if (positions === null || colors === null) {
      return
    }

    ;(positions.array as Float32Array).set(baked.positions)
    positions.needsUpdate = true

    const colorArray = colors.array as Float32Array
    for (let index = 0; index < baked.colors.length; index += 1) {
      colorArray[index] = (baked.colors[index] ?? 0) / 255
    }
    colors.needsUpdate = true

    const camera = this.camera as PerspectiveCamera
    camera.position.set(baked.camera[0], baked.camera[1], baked.camera[2])
    camera.lookAt(0, 0, 0)
  }

  private fitCameraToAtom(camera: PerspectiveCamera, aspect = camera.aspect): void {
    camera.aspect = aspect
    const verticalHalfFov = MathUtils.degToRad(camera.fov * 0.5)
    const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * aspect)
    const limitingHalfFov = Math.min(verticalHalfFov, horizontalHalfFov)
    const visibleRadius =
      this.config.targetOrbitalRadius * this.config.visibleRadiusFactor +
      this.config.pointSize * 1.5

    this.cameraOrbitDistance =
      ((visibleRadius * this.config.viewMargin) / Math.sin(limitingHalfFov)) * this.config.cameraZoom
    camera.updateProjectionMatrix()
  }

  private evolveInternalSuperposition(beta: number): void {
    const atomic = this.atomicPositions
    const positions = this.electronPositionAttribute
    const colors = this.electronColorAttribute
    if (atomic === null || positions === null || colors === null) {
      return
    }

    const rotatedStates = rotateSuperpositionAboutY(this.config.superpositionStates, beta)
    this.peakDensity = this.estimatePeakDensity(rotatedStates)
    this.densityReference = this.peakDensity * this.config.recolorPercentile

    const scenePositions = positions.array as Float32Array
    const colorArray = colors.array as Float32Array
    const sampleRadius = sampleRadiusForStates(this.config.superpositionStates)
    const particleCount = atomic.length / 3
    const batchEnd = Math.min(
      this.metropolisCursor + this.config.metropolisBatch,
      particleCount,
    )

    for (let particle = this.metropolisCursor; particle < batchEnd; particle += 1) {
      const offset = particle * 3
      const current = {
        x: atomic[offset] ?? 0,
        y: atomic[offset + 1] ?? 0,
        z: atomic[offset + 2] ?? 0,
      }
      const currentDensity = superpositionProbabilityDensity(rotatedStates, current)
      const proposal = {
        x: current.x + (Math.random() * 2 - 1) * this.config.metropolisStep,
        y: current.y + (Math.random() * 2 - 1) * this.config.metropolisStep,
        z: current.z + (Math.random() * 2 - 1) * this.config.metropolisStep,
      }

      if (
        Math.abs(proposal.x) <= sampleRadius &&
        Math.abs(proposal.y) <= sampleRadius &&
        Math.abs(proposal.z) <= sampleRadius
      ) {
        const proposalDensity = superpositionProbabilityDensity(rotatedStates, proposal)
        if (Math.random() * Math.max(currentDensity, 1e-12) < proposalDensity) {
          atomic[offset] = proposal.x
          atomic[offset + 1] = proposal.y
          atomic[offset + 2] = proposal.z
        }
      }
    }

    this.metropolisCursor = batchEnd >= particleCount ? 0 : batchEnd

    for (let particle = 0; particle < particleCount; particle += 1) {
      const offset = particle * 3
      const density = superpositionProbabilityDensity(rotatedStates, {
        x: atomic[offset] ?? 0,
        y: atomic[offset + 1] ?? 0,
        z: atomic[offset + 2] ?? 0,
      })

      scenePositions[offset] = (atomic[offset] ?? 0) * this.config.bohrSceneScale
      scenePositions[offset + 1] = (atomic[offset + 1] ?? 0) * this.config.bohrSceneScale
      scenePositions[offset + 2] = (atomic[offset + 2] ?? 0) * this.config.bohrSceneScale

      // Full-brightness density coloring (same as the crisp one-time sampling) so the
      // vivid white→yellow→orange→magenta→purple halo is preserved, not dimmed away.
      const [red, green, blue] = this.mapDensityToColor(density, this.densityReference)
      colorArray[offset] = red
      colorArray[offset + 1] = green
      colorArray[offset + 2] = blue
    }

    positions.needsUpdate = true
    colors.needsUpdate = true
  }

  private mapDensityToColor(density: number, referenceDensity: number): [number, number, number] {
    if (this.config.useRefinedColors) {
      return densityToColorRefined(density, referenceDensity)
    }
    return densityToColor(density, referenceDensity)
  }

  private estimatePeakDensity(states: QuantumState[]): number {
    const radius = sampleRadiusForStates(states) * 0.55
    let peak = 0
    const steps = 14
    const step = (2 * radius) / steps

    for (let ix = 0; ix <= steps; ix += 1) {
      for (let iy = 0; iy <= steps; iy += 1) {
        for (let iz = 0; iz <= steps; iz += 1) {
          const density = superpositionProbabilityDensity(states, {
            x: -radius + ix * step,
            y: -radius + iy * step,
            z: -radius + iz * step,
          })
          if (density > peak) {
            peak = density
          }
        }
      }
    }

    return Math.max(peak, 1e-12)
  }

  private createProton(): void {
    const coreGeometry = new SphereGeometry(0.045, 24, 24)
    const coreMaterial = new MeshBasicMaterial({
      color: new Color('#fffef8'),
    })
    this.protonGroup.add(new Mesh(coreGeometry, coreMaterial))

    const glowGeometry = new SphereGeometry(0.09, 20, 20)
    const glowMaterial = new MeshBasicMaterial({
      color: new Color('#fff4cc'),
      transparent: true,
      opacity: 0.42,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    this.protonGroup.add(new Mesh(glowGeometry, glowMaterial))
  }

  private createElectronCloud(): void {
    const rawSamples = sampleOrbitalCloud({
      states: this.config.superpositionStates,
      targetCount: this.config.particleCount,
      sampleRadius: sampleRadiusForStates(this.config.superpositionStates),
    })

    const densities = rawSamples.map((sample) => sample.density).sort((a, b) => a - b)
    const referenceIndex = Math.min(
      densities.length - 1,
      Math.floor(densities.length * this.config.recolorPercentile),
    )
    const referenceDensity = densities[referenceIndex] ?? 1

    const positions = new Float32Array(rawSamples.length * 3)
    const colors = new Float32Array(rawSamples.length * 3)
    const atomic = new Float32Array(rawSamples.length * 3)

    for (let index = 0; index < rawSamples.length; index += 1) {
      const sample = rawSamples[index]
      if (sample === undefined) {
        continue
      }
      const offset = index * 3
      atomic[offset] = sample.x
      atomic[offset + 1] = sample.y
      atomic[offset + 2] = sample.z
      positions[offset] = sample.x * this.config.bohrSceneScale
      positions[offset + 1] = sample.y * this.config.bohrSceneScale
      positions[offset + 2] = sample.z * this.config.bohrSceneScale
      const [red, green, blue] = this.mapDensityToColor(sample.density, referenceDensity)
      colors[offset] = red
      colors[offset + 1] = green
      colors[offset + 2] = blue
    }

    this.fitScale = this.config.targetOrbitalRadius / this.computeOrbitalExtent(positions)
    this.atomGroup.scale.setScalar(this.fitScale)
    this.atomicPositions = atomic
    // Keep a pristine copy of the starting cloud so a bake can replay deterministically
    // from t = 0 even after the Metropolis walk has mutated the live positions.
    this.initialAtomicPositions = atomic.slice()
    this.initialColors = colors.slice()
    if (this.config.vortexMode) {
      this.prepareVortexField(atomic)
    }

    const positionAttribute = new Float32BufferAttribute(positions, 3)
    this.electronPositionAttribute = positionAttribute
    this.electronColorAttribute = new Float32BufferAttribute(colors, 3)

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', positionAttribute)
    geometry.setAttribute('color', this.electronColorAttribute)

    const material = new PointsMaterial({
      size: this.config.pointSize,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: this.config.pointsOpacity,
      depthWrite: false,
    })

    this.electronCloud = new Points(geometry, material)
    this.electronGroup.add(this.electronCloud)
    this.peakDensity = this.estimatePeakDensity(this.config.superpositionStates)
    this.densityReference = this.peakDensity * this.config.recolorPercentile
  }

  private computeOrbitalExtent(positions: Float32Array): number {
    let maxExtent = 0

    for (let index = 0; index < positions.length; index += 3) {
      const x = Math.abs(positions[index] ?? 0)
      const y = Math.abs(positions[index + 1] ?? 0)
      const z = Math.abs(positions[index + 2] ?? 0)
      maxExtent = Math.max(maxExtent, x, y, z)
    }

    return maxExtent
  }
}
