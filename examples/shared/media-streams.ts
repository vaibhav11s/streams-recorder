const DEFAULT_MIC_CONSTRAINTS = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  voiceIsolation: false,
}

type GetMicrophoneMediaStreamProps = {
  micConstraints?: MediaTrackConstraints
  deviceId?: ConstrainDOMString | null
}

export const getMicrophoneMediaStream = async ({
  micConstraints,
  deviceId,
}: GetMicrophoneMediaStreamProps = {}) => {
  const constraints = {
    audio: { ...DEFAULT_MIC_CONSTRAINTS, ...micConstraints },
  } satisfies MediaStreamConstraints
  if (deviceId) constraints.audio.deviceId = deviceId
  return navigator.mediaDevices.getUserMedia(constraints)
}

export const stopTrack = (track: { stop: () => unknown }) => track.stop()

export const stopAllTracks = (...streams: Array<MediaStream | null | undefined>) =>
  streams.forEach(stream => stream?.getTracks().forEach(stopTrack))

export class StreamError extends Error {}

export const verifyAudioStream = (stream: MediaStream) => {
  const audioTracks = stream.getAudioTracks()
  if (audioTracks.length === 0) throw new StreamError('Provided stream does not have any audio tracks')
  let enabledStreams = audioTracks.length
  let liveStreams = audioTracks.length
  for (const track of audioTracks) {
    if (!track.enabled) enabledStreams -= 1
    if (track.readyState !== 'live') liveStreams -= 1
  }
  if (enabledStreams === 0) throw new StreamError('All audio tracks are disabled')
  if (liveStreams === 0) throw new StreamError('Any audio track is not live')
}

export const getDisplayAudioStream = async () => {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
  })
  stream.getVideoTracks().forEach(stopTrack)
  try {
    verifyAudioStream(stream)
    return stream
  }
  catch {
    stopAllTracks(stream)
    throw new StreamError('No display audio track. Share a tab with audio, or enable system audio.')
  }
}
