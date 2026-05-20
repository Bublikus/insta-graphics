import { AnimationLoop } from './AnimationLoop'

export interface SceneViewport {
  width: number
  height: number
  dpr: number
}

export interface BakeStartOptions {
  fps: 30 | 60
  durationSec: number
  fromStart: boolean
}

export interface SceneBakeStatus {
  supported: boolean
  isBaking: boolean
  progress: number
  hasBake: boolean
  useBakedPlayback: boolean
  bakedDurationSec: number
  errorMessage: string | null
}

export abstract class BaseGraphicScene {
  protected container: HTMLElement | null = null
  protected viewport: SceneViewport = { width: 0, height: 0, dpr: 1 }

  private readonly loop = new AnimationLoop((deltaMs, elapsedMs) => this.tick(deltaMs, elapsedMs))
  private currentElapsedMs = 0
  private bakeFrames: unknown[] = []
  private bakeFps: 30 | 60 = 60
  private bakeDurationSec = 0
  private bakePlaybackElapsedMs = 0
  private isBaking = false
  private bakeProgress = 0
  private bakeErrorMessage: string | null = null
  private useBakedPlayback = false
  private bakeCancelRequested = false
  private bakePromise: Promise<void> | null = null

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

  public getBakeStatus(): SceneBakeStatus {
    return {
      supported: this.supportsBake(),
      isBaking: this.isBaking,
      progress: this.bakeProgress,
      hasBake: this.bakeFrames.length > 0,
      useBakedPlayback: this.useBakedPlayback,
      bakedDurationSec: this.bakeDurationSec,
      errorMessage: this.bakeErrorMessage,
    }
  }

  public async startBake(options: BakeStartOptions): Promise<void> {
    if (!this.supportsBake()) {
      throw new Error('This scene does not support baking.')
    }
    if (this.bakePromise !== null) {
      return this.bakePromise
    }

    const durationSec = Number.isFinite(options.durationSec) && options.durationSec > 0 ? options.durationSec : 8
    const totalFrames = Math.max(1, Math.round(durationSec * options.fps))
    const frameDeltaMs = 1000 / options.fps
    const startElapsedMs = options.fromStart ? 0 : this.currentElapsedMs

    this.stop()
    this.useBakedPlayback = false
    this.bakePlaybackElapsedMs = 0
    this.isBaking = true
    this.bakeProgress = 0
    this.bakeErrorMessage = null
    this.bakeCancelRequested = false

    if (options.fromStart) {
      this.resetForBake()
      this.render()
    }

    const frames: unknown[] = new Array(totalFrames)
    let frameIndex = 0

    this.bakePromise = new Promise<void>((resolve, reject) => {
      const runChunk = () => {
        if (this.bakeCancelRequested) {
          this.isBaking = false
          this.bakeProgress = 0
          this.bakeErrorMessage = 'Bake cancelled'
          this.bakePromise = null
          this.start()
          resolve()
          return
        }

        const chunkStart = performance.now()
        while (frameIndex < totalFrames && performance.now() - chunkStart < 12) {
          const elapsedMs = startElapsedMs + frameIndex * frameDeltaMs
          this.update(frameDeltaMs, elapsedMs)
          frames[frameIndex] = this.captureBakeFrame()
          frameIndex += 1
        }

        this.bakeProgress = frameIndex / totalFrames

        if (frameIndex < totalFrames) {
          window.requestAnimationFrame(runChunk)
          return
        }

        this.bakeFrames = frames
        this.bakeFps = options.fps
        this.bakeDurationSec = durationSec
        this.useBakedPlayback = true
        this.bakePlaybackElapsedMs = 0
        this.isBaking = false
        this.bakePromise = null
        this.start()
        resolve()
      }

      try {
        window.requestAnimationFrame(runChunk)
      } catch (error) {
        this.isBaking = false
        this.bakePromise = null
        this.bakeErrorMessage = error instanceof Error ? error.message : String(error)
        this.start()
        reject(error)
      }
    })

    return this.bakePromise
  }

  public cancelBake(): void {
    this.bakeCancelRequested = true
  }

  public clearBake(): void {
    this.bakeFrames.length = 0
    this.bakeProgress = 0
    this.useBakedPlayback = false
    this.bakePlaybackElapsedMs = 0
    this.bakeErrorMessage = null
    this.bakeDurationSec = 0
  }

  public setBakedPlaybackEnabled(enabled: boolean): void {
    if (!enabled) {
      this.useBakedPlayback = false
      return
    }
    if (this.bakeFrames.length === 0) {
      return
    }
    this.useBakedPlayback = true
    this.bakePlaybackElapsedMs = 0
  }

  protected abstract onSetup(container: HTMLElement): void
  protected abstract onResize(viewport: SceneViewport): void
  protected abstract update(deltaMs: number, elapsedMs: number): void
  protected abstract render(): void
  protected abstract onDestroy(): void

  protected supportsBake(): boolean {
    return false
  }

  protected resetForBake(): void {}
  protected captureBakeFrame(): unknown {
    return null
  }
  protected applyBakeFrame(_frame: unknown): void {}

  private tick(deltaMs: number, elapsedMs: number): void {
    this.currentElapsedMs = elapsedMs
    if (this.useBakedPlayback && this.bakeFrames.length > 0) {
      const frameDurationMs = 1000 / this.bakeFps
      this.bakePlaybackElapsedMs += deltaMs
      const frameIndex = Math.floor(this.bakePlaybackElapsedMs / frameDurationMs) % this.bakeFrames.length
      const frame = this.bakeFrames[frameIndex]
      if (frame !== undefined) {
        this.applyBakeFrame(frame)
      }
      this.render()
      return
    }

    this.update(deltaMs, elapsedMs)
    this.render()
  }
}
