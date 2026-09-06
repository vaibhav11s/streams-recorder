import { useState } from 'react'
import { getMicrophoneMediaStream, verifyAudioStream } from '../../shared/media-streams'
import { MicrophoneSelector } from './MicrophoneSelector'

type MicrophoneStreamSelectorProps = {
  attached: boolean
  onNewStream: (stream: MediaStream | null, error: unknown) => void
}

export const MicrophoneStreamSelector = ({ attached, onNewStream }: MicrophoneStreamSelectorProps) => {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [lastDeviceStreamError, setLastDeviceStreamError] = useState<string | null>(null)
  const [attaching, setAttaching] = useState(false)

  const attachMicrophone = async () => {
    if (!selectedDeviceId) return
    setLastDeviceStreamError(null)
    setAttaching(true)

    try {
      const stream = await getMicrophoneMediaStream({ deviceId: selectedDeviceId })
      verifyAudioStream(stream)
      onNewStream(stream, null)
    }
    catch (error) {
      onNewStream(null, error)
      setLastDeviceStreamError(error instanceof Error ? error.message : 'Something went wrong while getting stream')
      console.error('Error while getting stream', error)
    }
    finally {
      setAttaching(false)
    }
  }

  const detachMicrophone = () => {
    setLastDeviceStreamError(null)
    onNewStream(null, null)
  }

  return (
    <>
      <div className="row">
        <MicrophoneSelector onDeviceChange={setSelectedDeviceId} />
        <button
          type="button"
          disabled={!selectedDeviceId || attaching}
          onClick={attachMicrophone}
        >
          Attach microphone
        </button>
        <button type="button" disabled={!attached} onClick={detachMicrophone}>
          Detach microphone
        </button>
      </div>
      {lastDeviceStreamError && <p className="error">{lastDeviceStreamError}</p>}
    </>
  )
}
