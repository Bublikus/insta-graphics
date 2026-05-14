import { Camera, Color, Mesh, PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import { BaseGraphicScene, type SceneViewport } from './BaseGraphicScene'

export abstract class BaseThreeScene extends BaseGraphicScene {
  protected scene: Scene = new Scene()
  protected camera: Camera = new PerspectiveCamera(45, 9 / 16, 0.1, 100)
  protected renderer: WebGLRenderer | null = null

  protected override onSetup(container: HTMLElement): void {
    this.renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setClearColor(new Color('#05050b'), 1)
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    container.append(this.renderer.domElement)
    this.afterSetup()
  }

  protected override onResize(viewport: SceneViewport): void {
    if (this.renderer === null) {
      return
    }

    this.renderer.setPixelRatio(viewport.dpr)
    this.renderer.setSize(viewport.width, viewport.height, false)

    if (this.camera instanceof PerspectiveCamera) {
      this.camera.aspect = viewport.width / viewport.height
      this.camera.updateProjectionMatrix()
    }

    this.afterResize(viewport)
  }

  protected override render(): void {
    if (this.renderer === null) {
      return
    }

    this.renderer.render(this.scene, this.camera)
  }

  protected override onDestroy(): void {
    this.beforeDestroy()
    this.disposeScene(this.scene)
    this.renderer?.dispose()
    this.renderer?.domElement.remove()
    this.renderer = null
  }

  protected afterSetup(): void {}
  protected afterResize(_viewport: SceneViewport): void {}
  protected beforeDestroy(): void {}

  private disposeScene(scene: Scene): void {
    scene.traverse((node) => {
      if (!(node instanceof Mesh)) {
        return
      }

      this.disposeIfPossible(node.geometry)

      if (Array.isArray(node.material)) {
        for (const material of node.material) {
          this.disposeIfPossible(material)
        }
        return
      }

      this.disposeIfPossible(node.material)
    })
  }

  private disposeIfPossible(value: unknown): void {
    if (this.isDisposable(value)) {
      value.dispose()
    }
  }

  private isDisposable(value: unknown): value is { dispose: () => void } {
    if (typeof value !== 'object' || value === null || !('dispose' in value)) {
      return false
    }

    return typeof (value as { dispose?: unknown }).dispose === 'function'
  }
}
