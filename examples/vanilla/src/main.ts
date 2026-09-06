import type { AudioRecordingState, StreamRecorderErrorContext } from 'streams-recorder'
import { MediaRecorderError, streamsRecorder } from 'streams-recorder'
import { attachOutputVisualizer } from '../../shared/output-visualizer'
import './style.css'

const attachMicButton = document.querySelector<HTMLButtonElement>('#attach-mic')!
const detachMicButton = document.querySelector<HTMLButtonElement>('#detach-mic')!
const attachDisplayButton = document.querySelector<HTMLButtonElement>('#attach-display')!
const detachDisplayButton = document.querySelector<HTMLButtonElement>('#detach-display')!
const startButton = document.querySelector<HTMLButtonElement>('#start')!
const pauseButton = document.querySelector<HTMLButtonElement>('#pause')!
const resumeButton = document.querySelector<HTMLButtonElement>('#resume')!
const stopButton = document.querySelector<HTMLButtonElement>('#stop')!
const stateEl = document.querySelector('#state')!
const durationEl = document.querySelector('#duration')!
const sourcesEl = document.querySelector('#sources')!
const errorEl = document.querySelector<HTMLElement>('#error')!
const visualizerCanvas = document.querySelector<HTMLCanvasElement>('#visualizer')!

const chunks: Blob[] = []
let mimeType = 'audio/webm'

const formatError = (error: unknown, fallback: string) => {
  if (error instanceof MediaRecorderError) return `${error.name}: ${error.message}`
  if (error instanceof Error) return error.message
  return fallback
}

const formatMediaRecorderEventError = (error: Error, context: StreamRecorderErrorContext) => {
  const name = error instanceof MediaRecorderError ? error.name : error.name || 'MediaRecorderError'
  return `${name}: ${error.message} (recorder=${context.recorderState}, audioContext=${context.audioContextState})`
}

const setError = (message: string | null) => {
  errorEl.hidden = !message
  errorEl.textContent = message ?? ''
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

const syncButtons = (state: AudioRecordingState, activeKeys: string[]) => {
  const hasMic = activeKeys.includes('mic')
  const hasDisplay = activeKeys.includes('display')

  attachMicButton.disabled = hasMic
  detachMicButton.disabled = !hasMic
  attachDisplayButton.disabled = hasDisplay
  detachDisplayButton.disabled = !hasDisplay

  startButton.disabled = state !== 'ready'
  pauseButton.disabled = state !== 'recording'
  resumeButton.disabled = state !== 'paused' || activeKeys.length === 0
  stopButton.disabled = state === 'idle' || state === 'stopped'
}

let activeKeys: string[] = []

const recorder = streamsRecorder({
  onStateChange(state) {
    stateEl.textContent = `State: ${state}`
    durationEl.textContent = `Duration: ${formatDuration(recorder.getDurationMs())}`
    syncButtons(state, activeKeys)
  },
  onDataAvailable(event) {
    if (event.data.size > 0) chunks.push(event.data)
    const recorderMime = (event.target as MediaRecorder | null)?.mimeType
    if (recorderMime) mimeType = recorderMime
  },
  onActiveSourcesChange(keys) {
    activeKeys = keys
    sourcesEl.textContent = `Active sources: ${keys.length ? keys.join(', ') : 'none'}`
    syncButtons(recorder.recordingState, keys)
  },
  onError(error, context) {
    setError(formatMediaRecorderEventError(error, context))
  },
})

syncButtons(recorder.recordingState, activeKeys)

const visualizer = attachOutputVisualizer(recorder.stream, visualizerCanvas, {
  audioContext: recorder.audioContext,
})

const runRecorderAction = async (action: () => Promise<unknown>, fallback: string) => {
  try {
    await visualizer.resume()
    await action()
  }
  catch (error) {
    setError(formatError(error, fallback))
  }
}

setInterval(() => {
  durationEl.textContent = `Duration: ${formatDuration(recorder.getDurationMs())}`
}, 250)

attachMicButton.addEventListener('click', async () => {
  setError(null)
  try {
    await visualizer.resume()
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })
    await recorder.changeSourceStream('mic', stream)
  }
  catch (error) {
    setError(formatError(error, 'Failed to attach microphone'))
  }
})

detachMicButton.addEventListener('click', async () => {
  setError(null)
  await runRecorderAction(() => recorder.changeSourceStream('mic', null), 'Failed to detach microphone')
})

attachDisplayButton.addEventListener('click', async () => {
  setError(null)
  try {
    await visualizer.resume()
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    })
    stream.getVideoTracks().forEach(track => track.stop())
    if (stream.getAudioTracks().length === 0) {
      stream.getTracks().forEach(track => track.stop())
      throw new Error('No display audio track. Share a tab with audio, or enable system audio.')
    }
    await recorder.changeSourceStream('display', stream)
  }
  catch (error) {
    setError(formatError(error, 'Failed to attach display audio'))
  }
})

detachDisplayButton.addEventListener('click', async () => {
  setError(null)
  await runRecorderAction(() => recorder.changeSourceStream('display', null), 'Failed to detach display')
})

startButton.addEventListener('click', async () => {
  setError(null)
  chunks.length = 0
  await runRecorderAction(() => recorder.startRecording(), 'Failed to start recording')
})

pauseButton.addEventListener('click', async () => {
  setError(null)
  await runRecorderAction(() => recorder.pauseRecording(), 'Failed to pause recording')
})

resumeButton.addEventListener('click', async () => {
  setError(null)
  await runRecorderAction(() => recorder.resumeRecording(), 'Failed to resume recording')
})

stopButton.addEventListener('click', async () => {
  setError(null)
  try {
    await recorder.stopRecording()
  }
  catch (error) {
    setError(formatError(error, 'Failed to stop recording'))
    return
  }
  if (chunks.length === 0) {
    setError('No audio chunks were captured.')
    return
  }
  const extension = mimeType.includes('mp4') ? 'm4a' : 'webm'
  downloadBlob(new Blob(chunks, { type: mimeType }), `recording.${extension}`)
})

window.addEventListener('pagehide', () => {
  visualizer.dispose()
  recorder.cleanup()
})
