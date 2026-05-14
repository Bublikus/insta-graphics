import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import coreUrl from '@ffmpeg/core?url'
import wasmUrl from '@ffmpeg/core/wasm?url'
import workerUrl from '@ffmpeg/ffmpeg/worker?url'

let ffmpegInstance: FFmpeg | null = null
let ffmpegLoadPromise: Promise<boolean> | null = null
let transcodeQueue: Promise<void> = Promise.resolve()

export interface TranscodeOptions {
  onProgress?: (progress: number) => void
  onLog?: (line: string) => void
  expectedDurationSec?: number
}

function parseTimestampToSeconds(value: string): number | null {
  const match = /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(value)
  if (match === null) {
    return null
  }

  const [, hoursText, minutesText, secondsText] = match
  const hours = Number(hoursText)
  const minutes = Number(minutesText)
  const seconds = Number(secondsText)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null
  }

  return hours * 3600 + minutes * 60 + seconds
}

async function getFfmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance === null) {
    ffmpegInstance = new FFmpeg()
  }

  if (ffmpegLoadPromise === null) {
    ffmpegLoadPromise = ffmpegInstance.load({
      coreURL: coreUrl,
      wasmURL: wasmUrl,
      workerURL: workerUrl,
    })
  }

  await ffmpegLoadPromise
  return ffmpegInstance
}

function enqueueTranscode<T>(task: () => Promise<T>): Promise<T> {
  const run = transcodeQueue.then(task, task)
  transcodeQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

function createTempName(prefix: string, extension: string): string {
  const randomPart = Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now()}-${randomPart}.${extension}`
}

export async function transcodeToInstagramMp4(
  webmBlob: Blob,
  fps: 30 | 60,
  options: TranscodeOptions = {},
): Promise<Blob> {
  return enqueueTranscode(async () => {
    const ffmpeg = await getFfmpeg()
    const inputFileName = createTempName('input', 'webm')
    const outputFileName = createTempName('output', 'mp4')
    const handleProgress = options.onProgress
    const handleLog = options.onLog
    const expectedDurationSec = options.expectedDurationSec
    let maxProgress = 0

    const progressHandler = ({ progress }: { progress: number }) => {
      maxProgress = Math.max(maxProgress, Math.min(1, Math.max(0, progress)))
      handleProgress?.(maxProgress)
    }
    const logHandler = ({ message }: { message: string }) => {
      handleLog?.(message)

      if (expectedDurationSec === undefined || expectedDurationSec <= 0) {
        return
      }

      const timeMatch = /time=(\d+:\d+:\d+(?:\.\d+)?)/.exec(message)
      if (timeMatch === null) {
        return
      }
      const timestamp = timeMatch[1]
      if (timestamp === undefined) {
        return
      }

      const convertedSec = parseTimestampToSeconds(timestamp)
      if (convertedSec === null) {
        return
      }

      const derivedProgress = Math.min(0.995, Math.max(0, convertedSec / expectedDurationSec))
      maxProgress = Math.max(maxProgress, derivedProgress)
      handleProgress?.(maxProgress)
    }

    ffmpeg.on('progress', progressHandler)
    ffmpeg.on('log', logHandler)

    try {
      await ffmpeg.writeFile(inputFileName, await fetchFile(webmBlob))
      await ffmpeg.exec([
        '-i',
        inputFileName,
        '-vf',
        `scale=1080:1920:flags=lanczos,fps=${fps},format=yuv420p`,
        '-c:v',
        'libx264',
        '-profile:v',
        'high',
        '-level',
        '4.1',
        '-preset',
        'slow',
        '-crf',
        '17',
        '-movflags',
        '+faststart',
        '-an',
        outputFileName,
      ])

      const outputData = await ffmpeg.readFile(outputFileName)
      if (!(outputData instanceof Uint8Array)) {
        throw new Error('Failed to produce MP4 output')
      }

      const copiedData = new Uint8Array(outputData)
      return new Blob([copiedData], { type: 'video/mp4' })
    } finally {
      ffmpeg.off('progress', progressHandler)
      ffmpeg.off('log', logHandler)
      options.onProgress?.(1)

      try {
        await ffmpeg.deleteFile(inputFileName)
      } catch {
        // Ignore cleanup errors.
      }
      try {
        await ffmpeg.deleteFile(outputFileName)
      } catch {
        // Ignore cleanup errors.
      }
    }
  })
}
