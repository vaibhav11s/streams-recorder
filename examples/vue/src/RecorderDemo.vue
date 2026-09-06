<script lang="ts" setup>
import type { StreamRecorderErrorContext } from 'streams-recorder'
import { MediaRecorderError } from 'streams-recorder'
import { useStreamsRecorder } from 'streams-recorder/vue'
import { computed, onUnmounted, ref, useTemplateRef } from 'vue'
import DisplayStreamSelector from './audio-recorder/DisplayStreamSelector.vue'
import MicrophoneStreamSelector from './audio-recorder/MicrophoneStreamSelector.vue'
import OutputStreamVisualizer from './audio-recorder/OutputStreamVisualizer.vue'

const emit = defineEmits<{
  reset: []
}>()

const lastError = ref<string | null>(null)
const durationMs = ref(0)
const visualizer = useTemplateRef<{ resume: () => Promise<void> | undefined }>('visualizer')

const chunks: Blob[] = []
let mimeType = 'audio/webm'

const formatError = (error: unknown, fallback: string) => {
  if (error instanceof MediaRecorderError) return `${error.name}: ${error.message}`
  if (error instanceof Error) return error.message
  return fallback
}

const formatRecorderError = (error: Error, context: StreamRecorderErrorContext) => {
  const name = error instanceof MediaRecorderError ? error.name : error.name || 'MediaRecorderError'
  return `${name}: ${error.message} (recorder=${context.recorderState}, audioContext=${context.audioContextState})`
}

const downloadBlob = (blob: Blob, filename: string) => {
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

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
    if (event.data.size > 0) chunks.push(event.data)
    const recorderMime = (event.target as MediaRecorder | null)?.mimeType
    if (recorderMime) mimeType = recorderMime
  },
})

const durationTimer = window.setInterval(() => {
  durationMs.value = getDurationMs()
}, 250)

onUnmounted(() => {
  clearInterval(durationTimer)
})

const hasMic = computed(() => activeKeys.value.includes('mic'))
const hasDisplay = computed(() => activeKeys.value.includes('display'))
const activeSourcesLabel = computed(() =>
  activeKeys.value.length ? activeKeys.value.join(', ') : 'none',
)
const duration = computed(() => {
  const totalSeconds = Math.floor(durationMs.value / 1000)
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
})
const displayError = computed(() => {
  if (lastError.value) return lastError.value
  if (!error.value) return null
  return formatRecorderError(error.value.error, error.value.context)
})

const runRecorderAction = async (action: () => Promise<unknown>, fallback: string) => {
  lastError.value = null
  try {
    await visualizer.value?.resume()
    await action()
  }
  catch (caught) {
    lastError.value = formatError(caught, fallback)
  }
}

const onSourceStream = (key: string) => async (nextStream: MediaStream | null, attachError: unknown) => {
  if (attachError) {
    lastError.value = formatError(attachError, `Failed to attach ${key} stream`)
    return
  }
  await runRecorderAction(() => changeSourceStream(key, nextStream), `Failed to change ${key} stream`)
}

const onMicStream = onSourceStream('mic')
const onDisplayStream = onSourceStream('display')

const handlePause = () => runRecorderAction(() => pauseRecording(), 'Failed to pause recording')
const handleResume = () => runRecorderAction(() => resumeRecording(), 'Failed to resume recording')

const handleStart = async () => {
  chunks.length = 0
  await runRecorderAction(() => startRecording(), 'Failed to start recording')
}

const handleStop = async () => {
  lastError.value = null
  try {
    await stopRecording()
  }
  catch (caught) {
    lastError.value = formatError(caught, 'Failed to stop recording')
    return
  }
  if (chunks.length === 0) {
    lastError.value = 'No audio chunks were captured.'
    return
  }
  const extension = mimeType.includes('mp4') ? 'm4a' : 'webm'
  downloadBlob(new Blob(chunks, { type: mimeType }), `recording.${extension}`)
}
</script>

<template>
  <main>
    <h1>streams-recorder</h1>
    <p class="lede">
      Mix a microphone and optional tab/display audio into one MediaRecorder timeline.
      After stop, Reset remounts this session so you get a new recorder instance.
    </p>

    <section>
      <h2>Sources</h2>
      <MicrophoneStreamSelector
        :attached="hasMic"
        @new-stream="onMicStream"
      />
      <DisplayStreamSelector
        :attached="hasDisplay"
        @new-stream="onDisplayStream"
      />
      <p class="status">
        Active sources: {{ activeSourcesLabel }}
      </p>
    </section>

    <section>
      <h2>Output mix</h2>
      <OutputStreamVisualizer
        ref="visualizer"
        :stream="stream"
        :audio-context="audioContext"
      />
    </section>

    <section>
      <h2>Recording</h2>
      <p class="status">
        State: {{ recordingState }}
      </p>
      <p class="status">
        Duration: {{ duration }}
      </p>
      <div class="row">
        <button type="button" :disabled="recordingState !== 'ready'" @click="handleStart">
          Start
        </button>
        <button type="button" :disabled="recordingState !== 'recording'" @click="handlePause">
          Pause
        </button>
        <button type="button" :disabled="recordingState !== 'paused' || !activeKeys.length" @click="handleResume">
          Resume
        </button>
        <button type="button" :disabled="recordingState === 'idle' || recordingState === 'stopped'" @click="handleStop">
          Stop &amp; download
        </button>
        <button type="button" @click="emit('reset')">
          Reset
        </button>
      </div>
    </section>

    <p v-if="displayError" class="error">
      {{ displayError }}
    </p>
  </main>
</template>
