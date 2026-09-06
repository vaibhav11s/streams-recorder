import type { MaybeRefOrGetter } from 'vue'
import type { AudioRecordingState, StreamRecorderErrorContext, StreamRecorderOptions, StreamsRecorderInstance } from './streamsRecorder'
import { onUnmounted, ref, toValue } from 'vue'
import { streamsRecorder } from './streamsRecorder'

export type UseStreamsRecorderOptions = Pick<
  StreamRecorderOptions,
  | 'audioContext'
  | 'console'
  | 'onDataAvailable'
  | 'onStateChange'
  | 'onAllTracksEnded'
  | 'onActiveSourcesChange'
  | 'onSourceMuteChange'
  | 'onError'
>

export type { StreamsRecorderInstance }

export const useStreamsRecorder = (
  options: MaybeRefOrGetter<UseStreamsRecorderOptions> = {},
) => {
  const recordingState = ref<AudioRecordingState>('idle')
  const activeKeys = ref<string[]>([])
  const error = ref<{ error: Error, context: StreamRecorderErrorContext } | null>(null)

  const readOptions = () => toValue(options)

  const instance = streamsRecorder({
    audioContext: readOptions().audioContext,
    console: readOptions().console,
    onDataAvailable: event => readOptions().onDataAvailable?.(event),
    onStateChange: (state) => {
      recordingState.value = state
      readOptions().onStateChange?.(state)
    },
    onAllTracksEnded: (key, stream) => readOptions().onAllTracksEnded?.(key, stream),
    onActiveSourcesChange: (keys) => {
      activeKeys.value = keys
      readOptions().onActiveSourcesChange?.(keys)
    },
    onSourceMuteChange: (key, isMuted) => readOptions().onSourceMuteChange?.(key, isMuted),
    onError: (nextError, context) => {
      error.value = { error: nextError, context }
      readOptions().onError?.(nextError, context)
    },
  })

  onUnmounted(() => {
    instance.cleanup()
  })

  return {
    recordingState,
    activeKeys,
    error,
    stream: instance.stream,
    audioContext: instance.audioContext,
    startRecording: instance.startRecording,
    pauseRecording: instance.pauseRecording,
    resumeRecording: instance.resumeRecording,
    stopRecording: instance.stopRecording,
    changeSourceStream: instance.changeSourceStream,
    cleanup: instance.cleanup,
    resumeAudioContext: instance.resumeAudioContext,
    getDurationMs: instance.getDurationMs,
  }
}
