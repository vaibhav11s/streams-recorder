export const getSupportedMimeType = () => {
  // WebM / Opus format for Chrome, Firefox, and Edge
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
  // Native MP4 containers for modern Safari / iOS ecosystems
  if (MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a.40.2')) return 'audio/mp4;codecs=mp4a.40.2'
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4'
  return undefined
}

export const getRecorderMimeType = () => {
  const preferred = getSupportedMimeType()
  if (preferred) return preferred
  try {
    const ctx = new AudioContext()
    const probe = new MediaRecorder(ctx.createMediaStreamDestination().stream)
    const mimeType = probe.mimeType
    ctx.close().catch(() => {})
    return mimeType
  }
  catch {
    return ''
  }
}

const once = <K extends keyof MediaRecorderEventMap>(recorder: MediaRecorder, event: K) =>
  new Promise<MediaRecorderEventMap[K]>(resolve => recorder.addEventListener(event, resolve, { once: true }))

export type AudioRecordingState
  = | 'idle'
    | 'ready'
    | 'recording'
    | 'paused'
    | 'stopped'

export class MediaRecorderError extends Error {}

type CleanupProps = {
  skipTrackStop?: boolean
}

export type StreamRecorderErrorContext = {
  recorderState: RecordingState
  audioContextState: AudioContextState
  mimeType: string
  trackStates: Array<{
    kind: string
    enabled: boolean
    readyState: MediaStreamTrackState
    muted: boolean
    label: string
  }>
}

export type StreamRecorderOptions = {
  audioContext?: AudioContext
  onStateChange?: (state: AudioRecordingState) => unknown
  onDataAvailable?: (blobEvent: BlobEvent) => unknown
  onAllTracksEnded?: (key: string, stream: MediaStream) => unknown
  onActiveSourcesChange?: (activeKeys: string[]) => unknown
  onSourceMuteChange?: (key: string, isMuted: boolean) => unknown
  onError?: (error: Error, context: StreamRecorderErrorContext) => unknown
  console?: Pick<Console, 'log' | 'warn' | 'info' | 'error'> | null
}
export const streamsRecorder = ({
  audioContext: _audioContext,
  onStateChange,
  onDataAvailable,
  onAllTracksEnded,
  onActiveSourcesChange,
  onSourceMuteChange,
  onError,
  console = window.console,
}: StreamRecorderOptions) => {
  const audioContext = _audioContext ?? new AudioContext()
  const mainMediaStreamDestination = audioContext.createMediaStreamDestination()
  const outputMediaStream = mainMediaStreamDestination.stream

  const factoryAbortController = new AbortController()

  const mediaRecorder = new MediaRecorder(outputMediaStream, { mimeType: getSupportedMimeType() })
  mediaRecorder.ondataavailable = event => onDataAvailable?.(event)

  mediaRecorder.onerror = (event) => {
    const error = event.error ?? new MediaRecorderError('Unknown MediaRecorder error')
    console?.error('MediaRecorder catastrophic error:', error)
    onError?.(error, {
      recorderState: mediaRecorder.state,
      audioContextState: audioContext.state,
      mimeType: mediaRecorder.mimeType,
      trackStates: mediaRecorder.stream.getTracks().map(track => ({
        kind: track.kind,
        enabled: track.enabled,
        readyState: track.readyState,
        muted: track.muted,
        label: track.label,
      })),
    })
  }

  const sourceMediaStreams: Record<string, { stream: MediaStream, source: MediaStreamAudioSourceNode, abortController: AbortController } | undefined> = {}

  const hasLiveTracksAttached = (): boolean => {
    return Object.values(sourceMediaStreams)
      .filter(Boolean)
      .some(item => item!.stream.getAudioTracks().some(track => track.readyState === 'live'))
  }

  let recordingState: AudioRecordingState = 'idle'
  let startTime = 0
  let totalElapsedMs = 0
  let wasTrackAutoPause = false
  let wasContextAutoPause = false

  const setRecordingState = (newState: AudioRecordingState) => {
    recordingState = newState
    onStateChange?.(newState)
  }

  const emitActiveSources = () => {
    const activeKeys = Object.keys(sourceMediaStreams).filter((key) => {
      const item = sourceMediaStreams[key]
      return item && item.stream.getAudioTracks().some(track => track.readyState === 'live')
    })
    onActiveSourcesChange?.(activeKeys)
  }

  const resumeAudioContext = async () => {
    if (audioContext.state === 'running' || audioContext.state === 'closed') return
    try {
      await audioContext.resume()
    }
    catch (err) {
      console?.warn('AudioContext.resume() failed', err)
    }
  }

  const startRecording = async (timeslice = 5000) => {
    await resumeAudioContext()
    if (recordingState !== 'ready') throw new MediaRecorderError(`Can't start recording from current state: ${recordingState}. Ensure a live stream is attached first.`)
    if (!hasLiveTracksAttached()) throw new MediaRecorderError('Cannot start recording: No live input audio streams are attached. Call changeSourceStream first.')

    try {
      const startPromise = once(mediaRecorder, 'start')
      mediaRecorder.start(timeslice)
      const returnValue = await startPromise

      startTime = performance.now()
      totalElapsedMs = 0
      setRecordingState('recording')
      return returnValue
    }
    catch (error) {
      console?.error(error)
      return false
    }
  }

  const pauseRecording = async () => {
    if (mediaRecorder.state !== 'recording') return true

    try {
      const pausePromise = once(mediaRecorder, 'pause')
      mediaRecorder.pause()
      const returnValue = await pausePromise

      totalElapsedMs += performance.now() - startTime
      setRecordingState('paused')
      return returnValue
    }
    catch (error) {
      console?.error(error)
      return false
    }
  }

  const resumeRecording = async () => {
    wasTrackAutoPause = false
    wasContextAutoPause = false
    await resumeAudioContext()

    if (audioContext.state !== 'running') {
      console?.warn('Cannot resume recording: The underlying AudioContext is still suspended or interrupted.')
      return false
    }
    if (mediaRecorder.state !== 'paused') return true
    if (!hasLiveTracksAttached()) throw new MediaRecorderError('Cannot resume recording: Attach an active stream source first.')

    try {
      const resumePromise = once(mediaRecorder, 'resume')
      mediaRecorder.resume()
      const returnValue = await resumePromise

      startTime = performance.now()
      setRecordingState('recording')
      return returnValue
    }
    catch (error) {
      console?.error(error)
      return false
    }
  }

  const syncStateAfterTrackLoss = async () => {
    if (hasLiveTracksAttached()) return

    if (recordingState === 'recording') {
      console?.warn('[Auto-Pause] All active audio tracks dropped out. Pausing timeline to prevent empty chunks.')
      await pauseRecording()
      wasTrackAutoPause = true
      return
    }

    if (recordingState === 'ready') {
      console?.warn('[State Sync] No live tracks remain. Dropping from ready back to idle.')
      setRecordingState('idle')
    }
  }

  const cleanup = async ({ skipTrackStop = false }: CleanupProps = {}) => {
    factoryAbortController.abort()

    Object.keys(sourceMediaStreams).forEach((key) => {
      const item = sourceMediaStreams[key]
      if (item) {
        item.abortController.abort()
        item.source.disconnect()
        if (!skipTrackStop) item.stream.getTracks().forEach(track => track.stop())
        delete sourceMediaStreams[key]
      }
    })

    // Safely close the AudioContext if it exists and isn't already closed
    try {
      if (audioContext.state !== 'closed') {
        // Anti-iOS deadlock shield: wake up thread for a split millisecond if suspended/interrupted
        if (['suspended', 'interrupted'].includes(audioContext.state)) {
          await audioContext.resume().catch(() => {})
        }
        await audioContext.close()
        console?.warn('[Audio Pipeline] AudioContext closed and destroyed successfully.')
      }
    }
    catch (err) {
      console?.error('Failed to close AudioContext cleanly:', err)
    }

    setRecordingState('stopped')
    emitActiveSources()
  }

  const stopRecording = async (cleanupProps: CleanupProps = {}) => {
    if (recordingState === 'stopped') return

    if (!['recording', 'paused'].includes(recordingState)) {
      setRecordingState('stopped')
      await cleanup(cleanupProps)
      return
    }

    try {
      const stopPromise = once(mediaRecorder, 'stop')
      mediaRecorder.stop()
      await stopPromise
    }
    finally {
      if (recordingState === 'recording') totalElapsedMs += performance.now() - startTime
      setRecordingState('stopped')
      await cleanup(cleanupProps)
    }
  }

  const changeSourceStream = async (key: string, newStream: MediaStream | null) => {
    const currentSource = sourceMediaStreams[key]
    if (currentSource) {
      currentSource.abortController.abort()
      currentSource.source.disconnect()
      currentSource.stream.getTracks().forEach(track => track.stop())
    }

    try {
      await resumeAudioContext()

      if (!newStream) {
        delete sourceMediaStreams[key]
        emitActiveSources()
        await syncStateAfterTrackLoss()
        return recordingState
      }

      const abortController = new AbortController()
      const source = audioContext.createMediaStreamSource(newStream)
      source.connect(mainMediaStreamDestination)
      sourceMediaStreams[key] = { stream: newStream, source, abortController }

      // Set up monitoring on individual tracks
      newStream.getAudioTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          console?.warn(`[Hardware Drop] Track "${track.label}" inside key "${key}" ended.`)

          // Verify if any sibling tracks inside this stream are still alive
          const hasRemainingLiveTracks = newStream.getAudioTracks().some(t => t.readyState === 'live')
          if (hasRemainingLiveTracks) return

          // Safely execute async pauses using a clean execution chain
          const handleDisconnect = async () => {
            emitActiveSources()
            await syncStateAfterTrackLoss()
            // Notify parent container layout safely after evaluation checks are secure
            onAllTracksEnded?.(key, newStream)
          }

          handleDisconnect()
        }, { signal: abortController.signal })

        track.addEventListener('mute', () => {
          console?.warn(`[Track Mute Event] Track "${track.label}" inside key "${key}" went silent.`)

          // Verify if EVERY audio track inside this specific stream bucket is now muted
          const areAllTracksInStreamMuted = newStream.getAudioTracks().every(t => t.muted)

          if (areAllTracksInStreamMuted) onSourceMuteChange?.(key, true)
        }, { signal: abortController.signal })

        track.addEventListener('unmute', () => {
          console?.info(`[Track Unmute Event] Track "${track.label}" inside key "${key}" woke up.`)

          // If even ONE single track inside this stream bucket unmutes, the channel is active again
          onSourceMuteChange?.(key, false)
        }, { signal: abortController.signal })
      })

      // Transition from 'idle' to 'ready' upon successful stream attachment
      if (recordingState === 'idle' && hasLiveTracksAttached()) setRecordingState('ready')
      // Auto-Resume if an active device mounts after a dropout
      if (recordingState === 'paused' && wasTrackAutoPause && hasLiveTracksAttached()) await resumeRecording()

      emitActiveSources() // Emit updated list when a fresh stream successfully hooks up
    }
    catch (err) {
      console?.error(`Failed to handle stream updates on key ${key}:`, err)
    }

    return recordingState
  }

  audioContext.addEventListener('statechange', () => {
    console?.warn(`[Audio Graph Notification] AudioContext transitioned to: ${audioContext.state}`)

    if (['suspended', 'interrupted'].includes(audioContext.state)) {
      const handleSpontaneousSuspension = async () => {
        if (recordingState === 'recording') {
          console?.warn('[Auto-Pause] AudioContext frozen by system. Attempting native pipeline pause.')

          try {
            await pauseRecording()
            wasContextAutoPause = true
          }
          catch (e) {
            console?.error('Native pauseRecording failed during suspension.', e)
          }
        }
      }
      handleSpontaneousSuspension()
    }

    if (audioContext.state === 'running' && recordingState === 'paused' && wasContextAutoPause) {
      console?.log('[Auto-Resume] AudioContext awakened. Thawing timeline.')

      const handleSpontaneousResume = async () => {
        try {
          await resumeRecording()
        }
        catch (e) {
          console?.error('[Auto-Resume] Failed to resume recording layout on wake:', e)
        }
        finally {
          wasContextAutoPause = false
          try {
            if (mediaRecorder.state !== 'inactive') mediaRecorder.requestData()
          }
          catch {}
        }
      }
      handleSpontaneousResume()
    }
  }, { signal: factoryAbortController.signal })

  const getDurationMs = (): number => {
    if (['idle', 'ready'].includes(recordingState)) return 0
    if (['paused', 'stopped'].includes(recordingState)) return totalElapsedMs
    const activeSegmentMs = performance.now() - startTime
    return totalElapsedMs + activeSegmentMs
  }
  return {
    get audioContext() { return audioContext },
    get stream() { return outputMediaStream },
    get recordingState() { return recordingState },
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cleanup,
    changeSourceStream,
    resumeAudioContext,
    getDurationMs,
  }
}

export type StreamsRecorderInstance = ReturnType<typeof streamsRecorder>
