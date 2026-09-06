const trySilentCheckMicrophonePermission = async () => {
  if (!('permissions' in navigator) || !navigator.permissions.query) return
  try {
    const result = await navigator.permissions.query({ name: 'microphone' })
    return result.state === 'granted'
  }
  catch (error) {
    console.warn(error)
  }
}

const tryGetMicrophonePermission = async () => {
  if (navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      return true
    }
    catch (error) {
      console.warn(error)
      return false
    }
  }
  return false
}

export const checkMicrophonePermission = async () => {
  const hasPermission = await trySilentCheckMicrophonePermission()
  if (hasPermission != null) return hasPermission
  return tryGetMicrophonePermission()
}

export const getMicrophonePermission = async () => {
  if (await trySilentCheckMicrophonePermission()) return true
  return tryGetMicrophonePermission()
}

const getDeviceListWhileHavingPermission = async () => {
  let deviceList = await navigator.mediaDevices.enumerateDevices()
  if (!deviceList.some(device => device.kind === 'audioinput' && !device.deviceId)) {
    return { deviceList }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach(track => track.stop())
    deviceList = await navigator.mediaDevices.enumerateDevices()
  }
  catch (err) {
    console.error('Error getting user media:', err)
  }
  return { deviceList }
}

export type MicrophoneDeviceListProps = {
  onDevicesChange?: ((devices: Array<MediaDeviceInfo>) => unknown) | null
  onPermissionChange?: ((hasPermission: boolean) => unknown) | null
  setIsLoading?: ((loading: boolean) => unknown) | null
  setError?: ((error: string | null) => unknown) | null
}

export const MicrophoneDeviceList = ({
  onDevicesChange,
  onPermissionChange,
  setIsLoading,
  setError,
}: MicrophoneDeviceListProps) => {
  let devices: Array<MediaDeviceInfo> = []
  let hasPermission = false
  let loading = false
  let error: string | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const _setDevices = (_devices: Array<MediaDeviceInfo>) => {
    const previousDeviceIds = devices.map(device => device.deviceId)
    const newDeviceIds = _devices.map(device => device.deviceId)
    const hasNew = newDeviceIds.some(id => !previousDeviceIds.includes(id))
    const hasRemoved = previousDeviceIds.some(id => !newDeviceIds.includes(id))
    if (hasNew || hasRemoved) onDevicesChange?.(_devices)

    devices = _devices
  }

  const _setHasPermission = (_hasPermission: boolean) => {
    if (_hasPermission !== hasPermission) onPermissionChange?.(_hasPermission)
    hasPermission = _hasPermission
  }

  const _setIsLoading = (_loading: boolean) => {
    loading = _loading
    setIsLoading?.(_loading)
  }

  const _setError = (_error: string | null) => {
    error = _error
    setError?.(_error)
  }

  let lastRefreshDeviceCounter = 0
  const refreshAndEmitDevices = async (permissionGranted?: boolean) => {
    const refreshDeviceCounter = ++lastRefreshDeviceCounter

    _setIsLoading(true)
    _setError(null)

    try {
      const hasMicPermission = permissionGranted ?? (await checkMicrophonePermission())
      if (!hasMicPermission) {
        if (refreshDeviceCounter !== lastRefreshDeviceCounter) return
        _setHasPermission(false)
        _setError('Microphone permission denied')
        _setDevices([])
        return
      }
      _setHasPermission(true)

      const { deviceList } = await getDeviceListWhileHavingPermission()
      if (refreshDeviceCounter !== lastRefreshDeviceCounter) return

      const audioDevices = deviceList.filter(device => device.kind === 'audioinput')
      _setDevices(audioDevices)
    }
    catch (refreshError) {
      if (refreshDeviceCounter !== lastRefreshDeviceCounter) return
      console.error('Error refreshing devices:', refreshError)
      _setError('Failed to get microphone devices')
    }
    finally {
      if (refreshDeviceCounter === lastRefreshDeviceCounter) _setIsLoading(false)
    }
  }

  const init = () => {
    refreshAndEmitDevices()
    let permissionStatus: PermissionStatus | undefined

    const handleInputDevicesChange = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(refreshAndEmitDevices, 300)
    }

    const handleMicrophonePermissionStatusChange = (status: PermissionStatus) => {
      _setHasPermission(status.state === 'granted')
      refreshAndEmitDevices(status.state === 'granted')
    }

    navigator.mediaDevices.addEventListener('devicechange', handleInputDevicesChange)

    navigator.permissions
      .query({ name: 'microphone' })
      .then((status) => {
        handleMicrophonePermissionStatusChange(status)
        permissionStatus = status
        status.onchange = () => handleMicrophonePermissionStatusChange(status)
      })
      .catch(() => _setHasPermission(false))

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleInputDevicesChange)
      if (debounceTimer) clearTimeout(debounceTimer)
      if (permissionStatus) permissionStatus.onchange = null
    }
  }

  const cleanup = init()

  return {
    devices,
    hasPermission,
    loading,
    error,
    cleanup,
  }
}
