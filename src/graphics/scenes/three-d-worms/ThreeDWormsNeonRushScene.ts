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

interface NeonShard {
  mesh: Mesh<BoxGeometry, MeshBasicMaterial>
  phase: number
  speed: number
  radius: number
  vertical: number
  depth: number
}

interface NeonRibbon {
  mesh: Mesh<PlaneGeometry, MeshBasicMaterial>
  phase: number
  speed: number
}

const SHARD_COUNT = 96
const RIBBON_COUNT = 6

export class ThreeDWormsNeonRushScene extends ThreeDWormsScene {
  private readonly fxCenter = new Vector3(0, 0, -2.4)
  private readonly fxGroup = new Group()
  private readonly shardGeometry = new BoxGeometry(0.07, 0.07, 0.07)
  private readonly shards: NeonShard[] = []
  private readonly ribbons: NeonRibbon[] = []
  private rushElapsedMs = 0

  protected override afterSetup(): void {
    super.afterSetup()
    this.createNeonRibbons()
    this.createNeonShards()
    this.createPulseBars()
    this.scene.add(this.fxGroup)
  }

  protected override update(deltaMs: number): void {
    super.update(deltaMs)
    this.rushElapsedMs += deltaMs
    this.animateRibbons()
    this.animateShards()
  }

  protected override beforeDestroy(): void {
    for (const shard of this.shards) {
      shard.mesh.material.dispose()
    }
    this.shards.length = 0
    this.shardGeometry.dispose()

    for (const ribbon of this.ribbons) {
      ribbon.mesh.material.dispose()
      ribbon.mesh.geometry.dispose()
    }
    this.ribbons.length = 0

    super.beforeDestroy()
  }

  private createNeonRibbons(): void {
    for (let index = 0; index < RIBBON_COUNT; index += 1) {
      const t = index / Math.max(1, RIBBON_COUNT - 1)
      const color = this.pickNeonColor(t)
      const material = new MeshBasicMaterial({
        color,
        transparent: true,
        opacity: MathUtils.lerp(0.06, 0.14, t),
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      })

      const mesh = new Mesh(new PlaneGeometry(5.1, 8.5), material)
      mesh.position.set(
        this.fxCenter.x + MathUtils.lerp(-0.24, 0.24, t),
        this.fxCenter.y,
        this.fxCenter.z + MathUtils.lerp(1.2, -3.6, t),
      )
      mesh.rotation.y = MathUtils.lerp(-0.16, 0.16, t)
      this.fxGroup.add(mesh)

      this.ribbons.push({
        mesh,
        phase: Math.random() * Math.PI * 2,
        speed: MathUtils.randFloat(0.3, 0.95),
      })
    }
  }

  private createPulseBars(): void {
    const geometry = new PlaneGeometry(0.18, 8.35)
    const xPositions = [-2.08, -1.6, -1.12, -0.64, -0.16, 0.32, 0.8, 1.28, 1.76, 2.24]

    for (let index = 0; index < xPositions.length; index += 1) {
      const x = xPositions[index] ?? 0
      const material = new MeshBasicMaterial({
        color: index % 2 === 0 ? '#5cffea' : '#ff63d8',
        transparent: true,
        opacity: 0.05,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      })
      const mesh = new Mesh(geometry.clone(), material)
      mesh.position.set(this.fxCenter.x + x, this.fxCenter.y, this.fxCenter.z - 1.2)
      this.fxGroup.add(mesh)
    }
  }

  private createNeonShards(): void {
    const colors = ['#5cf0ff', '#ff63d8', '#7d7bff', '#67ffb4', '#ffb570']

    for (let index = 0; index < SHARD_COUNT; index += 1) {
      const material = new MeshBasicMaterial({
        color: colors[index % colors.length] ?? '#5cf0ff',
        transparent: true,
        opacity: 0.36,
        blending: AdditiveBlending,
        depthWrite: false,
      })
      const mesh = new Mesh(this.shardGeometry, material)
      this.fxGroup.add(mesh)

      this.shards.push({
        mesh,
        phase: Math.random() * Math.PI * 2,
        speed: MathUtils.randFloat(0.35, 1.4),
        radius: MathUtils.randFloat(0.35, 2.35),
        vertical: MathUtils.randFloat(-3.8, 3.8),
        depth: MathUtils.randFloat(-4.2, 1.2),
      })
    }
  }

  private animateRibbons(): void {
    const t = this.rushElapsedMs * 0.001
    for (let index = 0; index < this.ribbons.length; index += 1) {
      const ribbon = this.ribbons[index]
      if (ribbon === undefined) {
        continue
      }
      const depthT = index / Math.max(1, this.ribbons.length - 1)
      ribbon.mesh.rotation.z = Math.sin(t * (0.55 + depthT * 0.35) + ribbon.phase) * 0.08
      ribbon.mesh.position.x = this.fxCenter.x + Math.sin(t * (0.5 + depthT * 0.4) + ribbon.phase) * 0.22
      ribbon.mesh.material.opacity = 0.05 + (Math.sin(t * 1.9 + ribbon.phase * 2) + 1) * 0.05 + depthT * 0.04
    }
  }

  private animateShards(): void {
    const t = this.rushElapsedMs * 0.001

    for (const shard of this.shards) {
      const angle = shard.phase + t * shard.speed
      const helix = Math.sin(t * 0.8 + shard.phase * 1.4) * 0.42
      shard.mesh.position.set(
        this.fxCenter.x + Math.cos(angle * 1.23) * (shard.radius + helix),
        this.fxCenter.y + shard.vertical + Math.sin(angle * 2 + t * 0.6) * 0.36,
        this.fxCenter.z + shard.depth + Math.sin(angle * 0.86) * 0.3,
      )

      const pulse = (Math.sin(t * 4.6 + shard.phase * 3.3) + 1) * 0.5
      const depthWeight = MathUtils.clamp((shard.mesh.position.z - (this.fxCenter.z - 4.2)) / 5.4, 0, 1)
      shard.mesh.material.opacity = 0.15 + pulse * 0.36 + (1 - depthWeight) * 0.18
      const size = 0.5 + pulse * 0.9
      shard.mesh.scale.setScalar(size)
    }
  }

  private pickNeonColor(t: number): string {
    if (t < 0.2) {
      return '#5cf1ff'
    }
    if (t < 0.4) {
      return '#7e8dff'
    }
    if (t < 0.6) {
      return '#ba6cff'
    }
    if (t < 0.8) {
      return '#ff63dc'
    }
    return '#67ffbe'
  }
}
