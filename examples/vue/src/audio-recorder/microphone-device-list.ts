import { onUnmounted } from 'vue'
import { MicrophoneDeviceList } from '../../../shared/microphone-device-list'
import { useSyncState } from './synWithCallback'

export { getMicrophonePermission } from '../../../shared/microphone-device-list'

type MicrophoneDeviceListProps = {
  onDevicesChange?: Nullable<(devices: Array<MediaDeviceInfo>) => unknown>
  onPermissionChange?: Nullable<(hasPermission: boolean) => unknown>
  setIsLoading?: Nullable<(loading: boolean) => unknown>
  setError?: Nullable<(error: string | null) => unknown>
}

export const useMicrophoneDeviceList = ({
  onDevicesChange: setDevices,
  onPermissionChange: setHasPermission,
  setIsLoading,
  setError,
}: MicrophoneDeviceListProps) => {
  const [devices, _setDevices] = useSyncState<Array<MediaDeviceInfo>>([], setDevices)
  const [hasPermission, _setHasPermission] = useSyncState<boolean>(false, setHasPermission)
  const [loading, _setLoading] = useSyncState<boolean>(false, setIsLoading)
  const [error, _setError] = useSyncState<Nullable<string>>(undefined, v => setError?.(v ?? null))

  const { cleanup } = MicrophoneDeviceList({
    onDevicesChange: _setDevices,
    onPermissionChange: _setHasPermission,
    setIsLoading: _setLoading,
    setError: _setError,
  })

  onUnmounted(() => cleanup())

  return {
    devices,
    hasPermission,
    loading,
    error,
  }
}
