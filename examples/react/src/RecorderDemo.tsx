import type { StreamRecorderErrorContext } from 'streams-recorder'
import type { OutputVisualizer } from '../../shared/output-visualizer'
import { useEffect, useRef, useState } from 'react'
import { MediaRecorderError } from 'streams-recorder'
import { useStreamsRecorder } from 'streams-recorder/react'
import { getDisplayAudioStream } from '../../shared/media-streams'
import { MicrophoneStreamSelector } from './MicrophoneStreamSelector'
import { OutputMixVisualizer } from './OutputMixVisualizer'

type RecorderDemoProps = {
  onReset: () => void
}

const formatError = (error: unknown, fallback: string) => {
  if (error instanceof MediaRecorderError) return `${error.name}: ${error.message}`
  if (error instanceof Error) return error.message
  return fallback
}

const formatRecorderError = (error: Error, context: StreamRecorderErrorContext) => {
  const name = error instanceof MediaRecorderError ? error.name : error.name || 'MediaRecorderError'
  return `${name}: ${error.message} (recorder=${context.recorderState}, audioContext=${context.audioContextState})`
}

const formatDuration = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

const downloadBlob = (blob: Blob, filename: string) => {
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export const RecorderDemo = ({ onReset }: RecorderDemoProps) => {
  const [durationMs, setDurationMs] = useState(0)
  const [lastError, setLastError] = useState<string | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mimeTypeRef = useRef('audio/webm')
  const visualizerRef = useRef<OutputVisualizer | null>(null)

  const {
    recordingState,
    activeKeys,
    error,
    stream,
    audioContext,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    changeSourceStream,
    getDurationMs,
  } = useStreamsRecorder({
    onDataAvailable(event) {
      if (event.data.size > 0) chunksRef.current.push(event.data)
      const recorderMime = (event.target as MediaRecorder | null)?.mimeType
      if (recorderMime) mimeTypeRef.current = recorderMime
    },
  })

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDurationMs(getDurationMs())
    }, 250)
    return () => window.clearInterval(timer)
  }, [getDurationMs])

  const displayError = lastError
    ?? (error ? formatRecorderError(error.error, error.context) : null)

  const runRecorderAction = async (action: () => Promise<unknown>, fallback: string) => {
    setLastError(null)
    try {
      await visualizerRef.current?.resume()
      await action()
    }
    catch (caught) {
      setLastError(formatError(caught, fallback))
    }
  }

  const attachMicStream = async (nextStream: MediaStream | null, attachError: unknown) => {
    if (attachError) {
      setLastError(formatError(attachError, 'Failed to attach microphone'))
      return
    }
    await runRecorderAction(() => changeSourceStream('mic', nextStream), 'Failed to change microphone stream')
  }

  const attachDisplay = async () => {
    setLastError(null)
    try {
      await visualizerRef.current?.resume()
      const displayStream = await getDisplayAudioStream()
      await changeSourceStream('display', displayStream)
    }
    catch (caught) {
      setLastError(formatError(caught, 'Failed to attach display audio'))
    }
  }

  const handleStart = async () => {
    chunksRef.current = []
    await runRecorderAction(() => startRecording(), 'Failed to start recording')
  }

  const handleStop = async () => {
    setLastError(null)
    try {
      await stopRecording()
    }
    catch (caught) {
      setLastError(formatError(caught, 'Failed to stop recording'))
      return
    }
    if (chunksRef.current.length === 0) {
      setLastError('No audio chunks were captured.')
      return
    }
    const mimeType = mimeTypeRef.current
    const extension = mimeType.includes('mp4') ? 'm4a' : 'webm'
    downloadBlob(new Blob(chunksRef.current, { type: mimeType }), `recording.${extension}`)
  }

  const hasMic = activeKeys.includes('mic')
  const hasDisplay = activeKeys.includes('display')

  return (
    <main>
      <h1>streams-recorder</h1>
      <p className="lede">
        Mix a microphone and optional tab/display audio into one MediaRecorder timeline.
        After stop, Reset remounts this session so you get a new recorder instance.
      </p>

      <section>
        <h2>Sources</h2>
        <MicrophoneStreamSelector attached={hasMic} onNewStream={attachMicStream} />
        <div className="row">
          <button type="button" disabled={hasDisplay} onClick={attachDisplay}>
            Attach display audio
          </button>
          <button
            type="button"
            disabled={!hasDisplay}
            onClick={() => runRecorderAction(() => changeSourceStream('display', null), 'Failed to detach display')}
          >
            Detach display
          </button>
        </div>
        <p className="status">
          Active sources:
          {' '}
          {activeKeys.length ? activeKeys.join(', ') : 'none'}
        </p>
      </section>

      <section>
        <h2>Output mix</h2>
        <OutputMixVisualizer
          stream={stream}
          audioContext={audioContext}
          visualizerRef={visualizerRef}
        />
      </section>

      <section>
        <h2>Recording</h2>
        <p className="status">
          State:
          {' '}
          {recordingState}
        </p>
        <p className="status">
          Duration:
          {' '}
          {formatDuration(durationMs)}
        </p>
        <div className="row">
          <button type="button" disabled={recordingState !== 'ready'} onClick={handleStart}>
            Start
          </button>
          <button
            type="button"
            disabled={recordingState !== 'recording'}
            onClick={() => runRecorderAction(() => pauseRecording(), 'Failed to pause recording')}
          >
            Pause
          </button>
          <button
            type="button"
            disabled={recordingState !== 'paused' || activeKeys.length === 0}
            onClick={() => runRecorderAction(() => resumeRecording(), 'Failed to resume recording')}
          >
            Resume
          </button>
          <button
            type="button"
            disabled={recordingState === 'idle' || recordingState === 'stopped'}
            onClick={handleStop}
          >
            Stop & download
          </button>
          <button type="button" onClick={onReset}>
            Reset
          </button>
        </div>
      </section>

      {displayError && <p className="error">{displayError}</p>}
    </main>
  )
}
