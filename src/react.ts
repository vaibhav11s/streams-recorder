import type { AudioRecordingState, StreamRecorderErrorContext, StreamRecorderOptions, StreamsRecorderInstance } from './streamsRecorder'
import { useCallback, useEffect, useRef, useState } from 'react'
import { streamsRecorder } from './streamsRecorder'

const useSyncRef = <T>(value: T) => {
  const ref = useRef(value)
  ref.current = value
  return ref
}

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

type RecorderError = { error: Error, context: StreamRecorderErrorContext }

type RecorderSession = {
  instance: StreamsRecorderInstance
  detach: () => void
}

export const useStreamsRecorder = (options: UseStreamsRecorderOptions = {}) => {
  const [recordingState, setRecordingState] = useState<AudioRecordingState>('idle')
  const [activeKeys, setActiveKeys] = useState<string[]>([])
  const [error, setError] = useState<RecorderError | null>(null)

  const optionsRef = useSyncRef(options)

  const createSession = useCallback((): RecorderSession => {
    // Updates from a disposed instance must not leak into the next session.
    let attached = true

    const instance = streamsRecorder({
      audioContext: optionsRef.current.audioContext,
      console: optionsRef.current.console,
      onDataAvailable: event => optionsRef.current.onDataAvailable?.(event),
      onStateChange: (state) => {
        if (attached) setRecordingState(state)
        optionsRef.current.onStateChange?.(state)
      },
      onAllTracksEnded: (key, stream) => optionsRef.current.onAllTracksEnded?.(key, stream),
      onActiveSourcesChange: (keys) => {
        if (attached) setActiveKeys(keys)
        optionsRef.current.onActiveSourcesChange?.(keys)
      },
      onSourceMuteChange: (key, isMuted) => optionsRef.current.onSourceMuteChange?.(key, isMuted),
      onError: (nextError, context) => {
        if (attached) setError({ error: nextError, context })
        optionsRef.current.onError?.(nextError, context)
      },
    })

    const detach = () => {
      attached = false
    }

    return { instance, detach }
  }, [optionsRef])

  const sessionRef = useRef<RecorderSession | null>(null)
  const [generation, setGeneration] = useState(0)

  // Created during render (not in an effect) so StrictMode's double render
  // reuses the same instance instead of leaking a second AudioContext.
  if (!sessionRef.current) sessionRef.current = createSession()
  const session = sessionRef.current

  useEffect(() => {
    // A remount after cleanup (StrictMode in dev) needs a fresh single-use recorder.
    if (!sessionRef.current) {
      setRecordingState('idle')
      setActiveKeys([])
      setError(null)
      setGeneration(current => current + 1)
      return
    }

    const active = sessionRef.current
    return () => {
      active.detach()
      active.instance.cleanup()
      sessionRef.current = null
    }
  }, [generation])

  return {
    recordingState,
    activeKeys,
    error,
    stream: session.instance.stream,
    audioContext: session.instance.audioContext,
    startRecording: session.instance.startRecording,
    pauseRecording: session.instance.pauseRecording,
    resumeRecording: session.instance.resumeRecording,
    stopRecording: session.instance.stopRecording,
    changeSourceStream: session.instance.changeSourceStream,
    cleanup: session.instance.cleanup,
    resumeAudioContext: session.instance.resumeAudioContext,
    getDurationMs: session.instance.getDurationMs,
  }
}
