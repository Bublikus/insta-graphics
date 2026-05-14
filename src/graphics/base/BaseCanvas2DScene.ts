import { BaseGraphicScene, type SceneViewport } from './BaseGraphicScene'

export abstract class BaseCanvas2DScene extends BaseGraphicScene {
  protected canvas: HTMLCanvasElement | null = null
  protected context: CanvasRenderingContext2D | null = null

  protected override onSetup(container: HTMLElement): void {
    const canvas = document.createElement('canvas')
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'

    const context = canvas.getContext('2d')
    if (context === null) {
      throw new Error('Failed to create 2D context')
    }

    container.append(canvas)
    this.canvas = canvas
    this.context = context
    this.afterSetup(context, canvas)
  }

  protected override onResize(viewport: SceneViewport): void {
    if (this.canvas === null || this.context === null) {
      return
    }

    const pixelWidth = Math.max(1, Math.floor(viewport.width * viewport.dpr))
    const pixelHeight = Math.max(1, Math.floor(viewport.height * viewport.dpr))
    this.canvas.width = pixelWidth
    this.canvas.height = pixelHeight
    this.context.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0)
    this.afterResize(viewport)
  }

  protected override onDestroy(): void {
    this.beforeDestroy()
    this.canvas?.remove()
    this.canvas = null
    this.context = null
  }

  protected afterSetup(_context: CanvasRenderingContext2D, _canvas: HTMLCanvasElement): void {}
  protected afterResize(_viewport: SceneViewport): void {}
  protected beforeDestroy(): void {}
}
