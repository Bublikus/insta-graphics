import { AnimationLoop } from './AnimationLoop'

export interface SceneViewport {
  width: number
  height: number
  dpr: number
}

export abstract class BaseGraphicScene {
  protected container: HTMLElement | null = null
  protected viewport: SceneViewport = { width: 0, height: 0, dpr: 1 }

  private readonly loop = new AnimationLoop((deltaMs, elapsedMs) => {
    this.update(deltaMs, elapsedMs)
    this.render()
  })

  public setup(container: HTMLElement): void {
    this.container = container
    this.onSetup(container)
  }

  public start(): void {
    this.loop.start()
  }

  public stop(): void {
    this.loop.stop()
  }

  public resize(viewport: SceneViewport): void {
    this.viewport = viewport
    this.onResize(viewport)
  }

  public destroy(): void {
    this.stop()
    this.onDestroy()
    this.container = null
  }

  protected abstract onSetup(container: HTMLElement): void
  protected abstract onResize(viewport: SceneViewport): void
  protected abstract update(deltaMs: number, elapsedMs: number): void
  protected abstract render(): void
  protected abstract onDestroy(): void
}
