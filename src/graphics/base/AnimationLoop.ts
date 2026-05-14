export type FrameCallback = (deltaMs: number, elapsedMs: number) => void

export class AnimationLoop {
  private rafId: number | null = null
  private lastFrameMs: number | null = null
  private startMs: number | null = null
  private readonly frameCallback: FrameCallback

  public constructor(frameCallback: FrameCallback) {
    this.frameCallback = frameCallback
  }

  public get isRunning(): boolean {
    return this.rafId !== null
  }

  public start(): void {
    if (this.isRunning) {
      return
    }

    this.rafId = window.requestAnimationFrame(this.tick)
  }

  public stop(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId)
    }

    this.rafId = null
    this.lastFrameMs = null
    this.startMs = null
  }

  private readonly tick = (frameMs: number): void => {
    if (this.startMs === null) {
      this.startMs = frameMs
    }

    const previousFrameMs = this.lastFrameMs ?? frameMs
    const deltaMs = frameMs - previousFrameMs
    const elapsedMs = frameMs - this.startMs
    this.lastFrameMs = frameMs

    this.frameCallback(deltaMs, elapsedMs)
    this.rafId = window.requestAnimationFrame(this.tick)
  }
}
