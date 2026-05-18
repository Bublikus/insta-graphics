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

interface SparkParticle {
  mesh: Mesh<BoxGeometry, MeshBasicMaterial>
  orbitRadius: number
  phase: number
  speed: number
  heightOffset: number
  depthOffset: number
}

const SPARK_COUNT = 68

export class ThreeDWormsNeonPulseScene extends ThreeDWormsScene {
  private readonly fxCenter = new Vector3(0, 0, -2.4)
  private readonly sparkParticles: SparkParticle[] = []
  private readonly sparkGeometry = new BoxGeometry(0.06, 0.06, 0.06)
  private readonly fxGroup = new Group()
  private energyPlaneA: Mesh<PlaneGeometry, MeshBasicMaterial> | null = null
  private energyPlaneB: Mesh<PlaneGeometry, MeshBasicMaterial> | null = null
  private fxElapsedMs = 0

  protected override afterSetup(): void {
    super.afterSetup()
    this.createEnergyPlanes()
    this.createSparkParticles()
    this.scene.add(this.fxGroup)
  }

  protected override update(deltaMs: number): void {
    super.update(deltaMs)
    this.fxElapsedMs += deltaMs
    this.animateEnergyPlanes()
    this.animateSparkParticles()
  }

  protected override beforeDestroy(): void {
    for (const spark of this.sparkParticles) {
      spark.mesh.material.dispose()
    }
    this.sparkParticles.length = 0
    this.sparkGeometry.dispose()
    this.energyPlaneA?.material.dispose()
    this.energyPlaneB?.material.dispose()
    this.energyPlaneA = null
    this.energyPlaneB = null
    super.beforeDestroy()
  }

  private createEnergyPlanes(): void {
    const planeGeometry = new PlaneGeometry(4.8, 8.2)

    const materialA = new MeshBasicMaterial({
      color: '#3e8eff',
      transparent: true,
      opacity: 0.1,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    })
    const materialB = new MeshBasicMaterial({
      color: '#ff6ee2',
      transparent: true,
      opacity: 0.08,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    })

    this.energyPlaneA = new Mesh(planeGeometry, materialA)
    this.energyPlaneA.position.set(this.fxCenter.x - 0.44, this.fxCenter.y, this.fxCenter.z - 1.2)
    this.energyPlaneA.rotation.y = MathUtils.degToRad(10)
    this.fxGroup.add(this.energyPlaneA)

    this.energyPlaneB = new Mesh(planeGeometry.clone(), materialB)
    this.energyPlaneB.position.set(this.fxCenter.x + 0.44, this.fxCenter.y, this.fxCenter.z - 0.2)
    this.energyPlaneB.rotation.y = MathUtils.degToRad(-10)
    this.fxGroup.add(this.energyPlaneB)
  }

  private createSparkParticles(): void {
    const sparkColors = ['#61d9ff', '#8fa8ff', '#ff82dc', '#ffd782']

    for (let index = 0; index < SPARK_COUNT; index += 1) {
      const color = sparkColors[index % sparkColors.length] ?? '#61d9ff'
      const material = new MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55,
        blending: AdditiveBlending,
        depthWrite: false,
      })
      const mesh = new Mesh(this.sparkGeometry, material)
      this.fxGroup.add(mesh)

      this.sparkParticles.push({
        mesh,
        orbitRadius: MathUtils.randFloat(1.3, 2.7),
        phase: Math.random() * Math.PI * 2,
        speed: MathUtils.randFloat(0.25, 0.95),
        heightOffset: MathUtils.randFloatSpread(5.8),
        depthOffset: MathUtils.randFloat(-2, 2),
      })
    }
  }

  private animateEnergyPlanes(): void {
    const t = this.fxElapsedMs * 0.001
    if (this.energyPlaneA !== null) {
      this.energyPlaneA.rotation.z = Math.sin(t * 0.42) * 0.12
      this.energyPlaneA.material.opacity = 0.07 + (Math.sin(t * 1.1) + 1) * 0.03
      this.energyPlaneA.position.x = this.fxCenter.x - 0.5 + Math.sin(t * 0.56) * 0.13
    }
    if (this.energyPlaneB !== null) {
      this.energyPlaneB.rotation.z = Math.cos(t * 0.48) * 0.12
      this.energyPlaneB.material.opacity = 0.06 + (Math.cos(t * 1.24) + 1) * 0.03
      this.energyPlaneB.position.x = this.fxCenter.x + 0.5 + Math.cos(t * 0.52) * 0.13
    }
  }

  private animateSparkParticles(): void {
    const t = this.fxElapsedMs * 0.001
    for (const spark of this.sparkParticles) {
      const angle = spark.phase + t * spark.speed
      const spiral = Math.sin(t * 0.9 + spark.phase * 2.1) * 0.34
      spark.mesh.position.set(
        this.fxCenter.x + Math.cos(angle) * (spark.orbitRadius + spiral),
        this.fxCenter.y + spark.heightOffset + Math.sin(angle * 1.6 + t) * 0.26,
        this.fxCenter.z + spark.depthOffset + Math.sin(angle) * 0.85,
      )

      const pulse = (Math.sin(t * 2.2 + spark.phase * 3.7) + 1) * 0.5
      spark.mesh.material.opacity = 0.18 + pulse * 0.5
      const size = 0.7 + pulse * 0.85
      spark.mesh.scale.setScalar(size)
    }
  }
}
