interface RecordingPanelProps {
  isRecording: boolean
  isPaused: boolean
  elapsedMs: number
  fps: 30 | 60
  durationSec: number
  downloadUrl: string | null
  fileName: string | null
  statusMessage: string
  canRecord: boolean
  canBake: boolean
  isConverting: boolean
  isBaking: boolean
  bakeProgress: number
  hasBake: boolean
  useBakedPlayback: boolean
  convertProgress: number
  conversionLogs: string[]
  lastErrorLog: string | null
  stageResolution: string
  resolutionReady: boolean
  onFpsChange: (fps: 30 | 60) => void
  onDurationChange: (durationSec: number) => void
  onStartCurrent: () => void
  onStartBaked: () => void
  onStartFromBeginning: () => void
  onStop: () => void
  onTogglePause: () => void
  onBakeCurrent: () => void
  onBakeFromBeginning: () => void
  onCancelBake: () => void
  onToggleBakedPlayback: () => void
  onClearBake: () => void
}

function formatTimer(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const ms = Math.floor((elapsedMs % 1000) / 10)
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms
    .toString()
    .padStart(2, '0')}`
}

export function RecordingPanel({
  isRecording,
  isPaused,
  elapsedMs,
  fps,
  durationSec,
  downloadUrl,
  fileName,
  statusMessage,
  canRecord,
  canBake,
  isConverting,
  isBaking,
  bakeProgress,
  hasBake,
  useBakedPlayback,
  convertProgress,
  conversionLogs,
  lastErrorLog,
  stageResolution,
  resolutionReady,
  onFpsChange,
  onDurationChange,
  onStartCurrent,
  onStartBaked,
  onStartFromBeginning,
  onStop,
  onTogglePause,
  onBakeCurrent,
  onBakeFromBeginning,
  onCancelBake,
  onToggleBakedPlayback,
  onClearBake,
}: RecordingPanelProps) {
  return (
    <section className="sidebar-panel recording-panel" aria-label="Recording controls">
      <h3>Recording</h3>
      <p className="recording-hint">
        Instagram max mode: high bitrate capture + MP4 (H.264) export at 1080x1920.
      </p>
      <p className={`recording-resolution ${resolutionReady ? 'is-good' : 'is-neutral'}`}>
        Stage pixels: <strong>{stageResolution}</strong> <span>(target: 1080x1920)</span>
      </p>

      <div className="recording-row">
        <label htmlFor="recording-fps">FPS</label>
        <select
          id="recording-fps"
          value={fps}
          disabled={isRecording || isConverting}
          onChange={(event) => onFpsChange(Number(event.target.value) as 30 | 60)}
        >
          <option value={60}>60</option>
          <option value={30}>30</option>
        </select>
      </div>

      <div className="recording-row">
        <label htmlFor="recording-duration">Auto stop (sec)</label>
        <input
          id="recording-duration"
          type="number"
          min={0}
          max={300}
          step={1}
          value={durationSec}
          disabled={isRecording || isConverting}
          onChange={(event) => onDurationChange(Number(event.target.value))}
        />
      </div>

      <p className="recording-timer">{formatTimer(elapsedMs)}</p>

      <div className="recording-buttons">
        <button
          type="button"
          disabled={!canRecord || isRecording || isConverting}
          onClick={onStartCurrent}
        >
          Start (current)
        </button>
        <button
          type="button"
          disabled={!canRecord || !hasBake || isRecording || isConverting || isBaking}
          onClick={onStartBaked}
        >
          Start baked
        </button>
        <button
          type="button"
          disabled={!canRecord || isRecording || isConverting}
          onClick={onStartFromBeginning}
        >
          Start from beginning
        </button>
        <button type="button" disabled={!isRecording} onClick={onTogglePause}>
          {isPaused ? 'Resume' : 'Pause'}
        </button>
        <button type="button" disabled={!isRecording} onClick={onStop}>
          Stop
        </button>
      </div>

      <div className="recording-buttons">
        <button
          type="button"
          disabled={!canBake || isRecording || isConverting || isBaking}
          onClick={onBakeCurrent}
        >
          Bake (current)
        </button>
        <button
          type="button"
          disabled={!canBake || isRecording || isConverting || isBaking}
          onClick={onBakeFromBeginning}
        >
          Bake from beginning
        </button>
        <button type="button" disabled={!isBaking} onClick={onCancelBake}>
          Cancel bake
        </button>
      </div>

      <div className="recording-buttons">
        <button type="button" disabled={!hasBake || isBaking} onClick={onToggleBakedPlayback}>
          {useBakedPlayback ? 'Use live simulation' : 'Use baked playback'}
        </button>
        <button type="button" disabled={!hasBake || isBaking} onClick={onClearBake}>
          Clear bake
        </button>
      </div>

      {isBaking ? (
        <div className="conversion-progress-wrap" aria-label="Bake progress">
          <progress className="conversion-progress" value={Math.round(bakeProgress * 100)} max={100} />
          <span>{Math.round(bakeProgress * 100)}%</span>
        </div>
      ) : null}

      <p className="recording-status">{statusMessage}</p>
      {isConverting ? (
        <div className="conversion-progress-wrap" aria-label="Conversion progress">
          <progress
            className="conversion-progress"
            value={Math.round(convertProgress * 100)}
            max={100}
          />
          <span>{Math.round(convertProgress * 100)}%</span>
        </div>
      ) : null}

      {lastErrorLog !== null ? <p className="recording-error">Error: {lastErrorLog}</p> : null}
      {conversionLogs.length > 0 ? (
        <details className="conversion-logs">
          <summary>Conversion logs</summary>
          <pre>{conversionLogs.join('\n')}</pre>
        </details>
      ) : null}

      {downloadUrl !== null && fileName !== null ? (
        <a className="download-button" href={downloadUrl} download={fileName}>
          Download video
        </a>
      ) : null}
    </section>
  )
}
