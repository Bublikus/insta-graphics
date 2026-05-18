import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { GraphicRuntime } from '../graphics/GraphicRuntime'
import {
  DEFAULT_GRAPHIC_ID,
  GRAPHIC_TREE,
  getGraphicById,
  getNextGraphicId,
  getPreviousGraphicId,
} from '../graphics/registry'
import { transcodeToInstagramMp4 } from '../recording/transcodeToInstagramMp4'
import { GraphicNavigator } from './GraphicNavigator'
import { RecordingPanel } from './RecordingPanel'

type RecordingConfig = {
  fps: 30 | 60
  durationSec: number
}

function getRouterBasename(): string {
  const baseUrl = import.meta.env.BASE_URL
  if (baseUrl === '/') {
    return '/'
  }

  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

function getPreferredMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
  ]

  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate
    }
  }

  return ''
}

function buildRecordingFileName(graphicId: string, extension: 'webm' | 'mp4'): string {
  const date = new Date()
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    '-',
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join('')

  return `${graphicId}-${stamp}.${extension}`
}

function GraphicPage() {
  const navigate = useNavigate()
  const { graphicId } = useParams()
  const graphic = getGraphicById(graphicId)
  const previousId = getPreviousGraphicId(graphic.id)
  const nextId = getNextGraphicId(graphic.id)
  const hasUnknownGraphicId = graphicId !== undefined && graphicId !== graphic.id
  const [stageCanvas, setStageCanvas] = useState<HTMLCanvasElement | null>(null)
  const [restartNonce, setRestartNonce] = useState(0)
  const [fps, setFps] = useState<30 | 60>(60)
  const [durationSec, setDurationSec] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [convertProgress, setConvertProgress] = useState(0)
  const [conversionLogs, setConversionLogs] = useState<string[]>([])
  const [lastErrorLog, setLastErrorLog] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('Ready')
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloadFileName, setDownloadFileName] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pendingStartConfigRef = useRef<RecordingConfig | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const autoStopTimeoutRef = useRef<number | null>(null)
  const timerRafRef = useRef<number | null>(null)
  const startedAtRef = useRef<number>(0)
  const pausedAtRef = useRef<number | null>(null)
  const pausedTotalMsRef = useRef<number>(0)

  const clearAutoStop = useCallback(() => {
    if (autoStopTimeoutRef.current !== null) {
      window.clearTimeout(autoStopTimeoutRef.current)
      autoStopTimeoutRef.current = null
    }
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRafRef.current !== null) {
      window.cancelAnimationFrame(timerRafRef.current)
      timerRafRef.current = null
    }
  }, [])

  const resetRecordingUrl = useCallback(() => {
    if (downloadUrl !== null) {
      URL.revokeObjectURL(downloadUrl)
      setDownloadUrl(null)
      setDownloadFileName(null)
    }
  }, [downloadUrl])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder === null) {
      return
    }

    if (recorder.state !== 'inactive') {
      recorder.stop()
    }
  }, [])

  const beginRecording = useCallback(
    (canvas: HTMLCanvasElement, config: RecordingConfig) => {
      if (typeof MediaRecorder === 'undefined') {
        setStatusMessage('MediaRecorder is not supported in this browser.')
        return
      }

      resetRecordingUrl()
      clearAutoStop()
      chunksRef.current = []
      pausedTotalMsRef.current = 0
      pausedAtRef.current = null
      startedAtRef.current = performance.now()
      setElapsedMs(0)
      setIsRecording(true)
      setIsPaused(false)
      setIsConverting(false)
      setConvertProgress(0)
      setConversionLogs([])
      setLastErrorLog(null)
      setStatusMessage('Recording...')

      const mimeType = getPreferredMimeType()
      const videoBitsPerSecond = config.fps === 60 ? 18_000_000 : 12_000_000
      const stream = canvas.captureStream(config.fps)
      const recorderOptions: MediaRecorderOptions = {
        videoBitsPerSecond,
      }

      if (mimeType !== '') {
        recorderOptions.mimeType = mimeType
      }

      const recorder = new MediaRecorder(stream, recorderOptions)

      recorderRef.current = recorder
      streamRef.current = stream

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      })

      recorder.addEventListener('stop', () => {
        void (async () => {
          const stoppedAtMs = performance.now()
          const pauseSinceMs =
            pausedAtRef.current === null ? 0 : Math.max(0, stoppedAtMs - pausedAtRef.current)
          const totalPausedMs = pausedTotalMsRef.current + pauseSinceMs
          const expectedDurationMs = Math.max(1, stoppedAtMs - startedAtRef.current - totalPausedMs)
          const expectedDurationSec = expectedDurationMs / 1000
          const webmBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' })
          setElapsedMs(expectedDurationMs)
          pausedAtRef.current = null

          stopTimer()
          clearAutoStop()

          for (const track of stream.getTracks()) {
            track.stop()
          }
          streamRef.current = null
          recorderRef.current = null
          setIsRecording(false)
          setIsPaused(false)

          setStatusMessage('Converting to Instagram MP4 (H.264)...')
          setIsConverting(true)
          setConvertProgress(0)
          setConversionLogs([])
          setLastErrorLog(null)

          try {
            const mp4Blob = await transcodeToInstagramMp4(webmBlob, config.fps, {
              expectedDurationSec,
              onProgress: (progress) => {
                setConvertProgress(progress)
                setStatusMessage(`Converting to MP4... ${Math.round(progress * 100)}%`)
              },
              onLog: (line) => {
                const trimmed = line.trim()
                if (trimmed === '') {
                  return
                }

                setConversionLogs((prev) => [...prev.slice(-79), trimmed])
              },
            })
            const mp4Url = URL.createObjectURL(mp4Blob)
            setDownloadUrl(mp4Url)
            setDownloadFileName(buildRecordingFileName(graphic.id, 'mp4'))
            setConvertProgress(1)
            setStatusMessage('MP4 ready. Instagram-optimized export completed.')
          } catch (error) {
            const webmUrl = URL.createObjectURL(webmBlob)
            setDownloadUrl(webmUrl)
            setDownloadFileName(buildRecordingFileName(graphic.id, 'webm'))
            const errorMessage = error instanceof Error ? error.message : String(error)
            setLastErrorLog(errorMessage)
            setStatusMessage('MP4 conversion failed; WebM fallback is ready. Check logs below.')
          } finally {
            setIsConverting(false)
          }
        })()
      })

      recorder.start(1000)

      if (config.durationSec > 0) {
        autoStopTimeoutRef.current = window.setTimeout(() => {
          stopRecording()
        }, config.durationSec * 1000)
      }
    },
    [clearAutoStop, graphic.id, resetRecordingUrl, stopRecording, stopTimer],
  )

  const startCurrent = useCallback(() => {
    if (isRecording || isConverting) {
      return
    }

    if (stageCanvas === null) {
      setStatusMessage('Scene canvas is not available yet.')
      return
    }

    beginRecording(stageCanvas, { fps, durationSec })
  }, [beginRecording, durationSec, fps, isConverting, isRecording, stageCanvas])

  const startFromBeginning = useCallback(() => {
    if (isRecording || isConverting) {
      return
    }

    setStatusMessage('Restarting scene, recording will start from frame one...')
    pendingStartConfigRef.current = { fps, durationSec }
    setRestartNonce((value) => value + 1)
  }, [durationSec, fps, isConverting, isRecording])

  const togglePause = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder === null || recorder.state === 'inactive') {
      return
    }

    if (recorder.state === 'recording') {
      recorder.pause()
      pausedAtRef.current = performance.now()
      setIsPaused(true)
      setStatusMessage('Paused')
      return
    }

    if (recorder.state === 'paused') {
      recorder.resume()
      const pausedAt = pausedAtRef.current
      if (pausedAt !== null) {
        pausedTotalMsRef.current += performance.now() - pausedAt
      }
      pausedAtRef.current = null
      setIsPaused(false)
      setStatusMessage('Recording...')
    }
  }, [])

  useEffect(() => {
    if (!isRecording) {
      stopTimer()
      return
    }

    const tick = () => {
      if (!isPaused) {
        const now = performance.now()
        const elapsed = Math.max(0, now - startedAtRef.current - pausedTotalMsRef.current)
        setElapsedMs(elapsed)
      }

      timerRafRef.current = window.requestAnimationFrame(tick)
    }

    timerRafRef.current = window.requestAnimationFrame(tick)
    return () => stopTimer()
  }, [isPaused, isRecording, stopTimer])

  useEffect(() => {
    if (!hasUnknownGraphicId) {
      return
    }

    void navigate(`/g/${graphic.id}`, { replace: true })
  }, [graphic.id, hasUnknownGraphicId, navigate])

  useEffect(() => {
    stopRecording()
    pendingStartConfigRef.current = null
  }, [graphic.id, stopRecording])

  useEffect(() => {
    return () => {
      stopRecording()
      stopTimer()
      clearAutoStop()
      if (downloadUrl !== null) {
        URL.revokeObjectURL(downloadUrl)
      }

      const stream = streamRef.current
      if (stream !== null) {
        for (const track of stream.getTracks()) {
          track.stop()
        }
      }
    }
  }, [clearAutoStop, downloadUrl, stopRecording, stopTimer])

  const onCanvasChange = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      setStageCanvas(canvas)

      if (canvas === null) {
        return
      }

      const pendingStartConfig = pendingStartConfigRef.current
      if (pendingStartConfig === null) {
        return
      }

      pendingStartConfigRef.current = null
      beginRecording(canvas, pendingStartConfig)
    },
    [beginRecording],
  )

  const canRecord = stageCanvas !== null && typeof MediaRecorder !== 'undefined'
  const stageWidthPx = stageCanvas?.width ?? 0
  const stageHeightPx = stageCanvas?.height ?? 0
  const stageResolution =
    stageWidthPx > 0 && stageHeightPx > 0 ? `${stageWidthPx}x${stageHeightPx}` : '-'
  const resolutionReady = stageWidthPx >= 1080 && stageHeightPx >= 1920

  return (
    <main className="app-shell">
      <aside className="sidebar sidebar-left">
        <section className="sidebar-panel">
          <h2>{graphic.title}</h2>
          <p>{graphic.description}</p>
          <p className="deep-link">
            Deep link: <code>{`/g/${graphic.id}`}</code>
          </p>
          <GraphicNavigator
            graphicTree={GRAPHIC_TREE}
            activeId={graphic.id}
            previousId={previousId}
            nextId={nextId}
          />
        </section>
      </aside>
      <GraphicRuntime
        graphic={graphic}
        restartNonce={restartNonce}
        onCanvasChange={onCanvasChange}
      />
      <aside className="sidebar sidebar-right">
        <RecordingPanel
          isRecording={isRecording}
          isPaused={isPaused}
          elapsedMs={elapsedMs}
          fps={fps}
          durationSec={durationSec}
          downloadUrl={downloadUrl}
          fileName={downloadFileName}
          statusMessage={statusMessage}
          canRecord={canRecord}
          isConverting={isConverting}
          convertProgress={convertProgress}
          conversionLogs={conversionLogs}
          lastErrorLog={lastErrorLog}
          stageResolution={stageResolution}
          resolutionReady={resolutionReady}
          onFpsChange={setFps}
          onDurationChange={(value) =>
            setDurationSec(Number.isFinite(value) ? Math.max(0, value) : 0)
          }
          onStartCurrent={startCurrent}
          onStartFromBeginning={startFromBeginning}
          onStop={stopRecording}
          onTogglePause={togglePause}
        />
      </aside>
    </main>
  )
}

export function AppRouter() {
  return (
    <BrowserRouter basename={getRouterBasename()}>
      <Routes>
        <Route path="/" element={<Navigate to={`/g/${DEFAULT_GRAPHIC_ID}`} replace />} />
        <Route path="/g/:graphicId" element={<GraphicPage />} />
        <Route path="*" element={<Navigate to={`/g/${DEFAULT_GRAPHIC_ID}`} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
