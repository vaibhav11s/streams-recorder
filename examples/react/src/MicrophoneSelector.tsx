import { useCallback, useState } from 'react'
import { useMicrophoneDeviceList } from './useMicrophoneDeviceList'

type MicrophoneSelectorProps = {
  onDeviceChange: (deviceId: string | null) => void
}

export const MicrophoneSelector = ({ onDeviceChange }: MicrophoneSelectorProps) => {
  const [selectedDevice, setSelectedDevice] = useState<string | null | undefined>(undefined)

  const handleDevicesChange = useCallback((nextDevices: Array<MediaDeviceInfo>) => {
    setSelectedDevice((current) => {
      if (nextDevices.length === 0) {
        if (current === undefined) return current
        onDeviceChange(null)
        return null
      }
      if (current === undefined || current === null) {
        const nextId = nextDevices[0]!.deviceId
        onDeviceChange(nextId)
        return nextId
      }
      return current
    })
  }, [onDeviceChange])

  const {
    devices,
    hasPermission,
    error,
    loading,
    getMicrophonePermission,
  } = useMicrophoneDeviceList({ onDevicesChange: handleDevicesChange })

  if (!hasPermission) {
    return (
      <div className="notice">
        <div>
          <div>Microphone access needed</div>
          <div>Please allow access to use voice features</div>
        </div>
        <button type="button" onClick={() => getMicrophonePermission()}>
          Grant Access
        </button>
      </div>
    )
  }

  return (
    <>
      <select
        value={selectedDevice ?? ''}
        onChange={(event) => {
          const deviceId = event.target.value || null
          setSelectedDevice(deviceId)
          onDeviceChange(deviceId)
        }}
      >
        {devices.map(device => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label}
          </option>
        ))}
      </select>
      {error && <div>{error}</div>}
      {loading && <div>Loading...</div>}
    </>
  )
}
