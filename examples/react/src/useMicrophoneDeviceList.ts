import { useEffect, useRef, useState } from 'react'
import { getMicrophonePermission, MicrophoneDeviceList } from '../../shared/microphone-device-list'

type UseMicrophoneDeviceListOptions = {
  onDevicesChange?: (devices: Array<MediaDeviceInfo>) => unknown
}

export const useMicrophoneDeviceList = ({ onDevicesChange }: UseMicrophoneDeviceListOptions = {}) => {
  const [devices, setDevices] = useState<Array<MediaDeviceInfo>>([])
  const [hasPermission, setHasPermission] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onDevicesChangeRef = useRef(onDevicesChange)
  onDevicesChangeRef.current = onDevicesChange

  useEffect(() => {
    const list = MicrophoneDeviceList({
      onDevicesChange: (nextDevices) => {
        setDevices(nextDevices)
        onDevicesChangeRef.current?.(nextDevices)
      },
      onPermissionChange: setHasPermission,
      setIsLoading: setLoading,
      setError,
    })
    return () => list.cleanup()
  }, [])

  return {
    devices,
    hasPermission,
    loading,
    error,
    getMicrophonePermission,
  }
}
