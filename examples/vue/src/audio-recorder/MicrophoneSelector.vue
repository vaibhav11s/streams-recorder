<script lang="ts" setup>
import { ref } from 'vue'
import { getMicrophonePermission, useMicrophoneDeviceList } from './microphone-device-list'

export type MicrophoneSelectorEmits = {
  deviceChange: [deviceId: string | null]
}

const emit = defineEmits<MicrophoneSelectorEmits>()

const selectedDevice = ref<Nullable<string>>()
const setSelectedDevice = (deviceId: string | null) => {
  selectedDevice.value = deviceId
  emit('deviceChange', deviceId)
}

const onDevicesChangeCallback = (devices: Array<MediaDeviceInfo>) => {
  if (devices.length === 0) {
    // first time
    if (selectedDevice.value === undefined) return
    return setSelectedDevice(null)
  }
  if (selectedDevice.value === undefined) {
    // first time
    setSelectedDevice(devices[0]!.deviceId)
  }
  if (selectedDevice.value === null) {
    // Maybe some other logic
    setSelectedDevice(devices[0]!.deviceId)
  }
}

const {
  devices,
  hasPermission,
  error,
  loading,
} = useMicrophoneDeviceList({ onDevicesChange: onDevicesChangeCallback })

defineExpose({ selectedDevice })
</script>

<template>
  <div v-if="!hasPermission" class="notice">
    <div>
      <div>Microphone access needed</div>
      <div>Please allow access to use voice features</div>
    </div>
    <button type="button" @click="getMicrophonePermission">
      Grant Access
    </button>
  </div>

  <select v-else :value="selectedDevice" @change="setSelectedDevice(($event.target as HTMLSelectElement).value)">
    <option
      v-for="device in devices"
      :key="device.deviceId"
      :value="device.deviceId"
    >
      {{ device.label }}
    </option>
  </select>
  <div v-if="error">
    {{ error }}
  </div>
  <div v-if="loading">
    Loading...
  </div>
</template>
