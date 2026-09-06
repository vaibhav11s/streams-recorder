<script lang="ts" setup>
import { ref } from 'vue'
import MicrophoneSelector from './MicrophoneSelector.vue'
import { getMicrophoneMediaStream, verifyAudioStream } from './stream.ts'

type MicrophoneStreamSelectorEmits = {
  newStream: [stream: MediaStream | null, error: null ] | [stream: null, error: unknown]
}

const { attached } = defineProps<{
  attached: boolean
}>()

const emit = defineEmits<MicrophoneStreamSelectorEmits>()

const selectedDeviceId = ref<Nullable<string>>(null)
const lastDeviceStreamError = ref<Nullable<string>>()
const attaching = ref(false)

const attachMicrophone = async () => {
  if (!selectedDeviceId.value) return
  lastDeviceStreamError.value = null
  attaching.value = true

  try {
    const stream = await getMicrophoneMediaStream({ deviceId: selectedDeviceId.value })
    verifyAudioStream(stream)
    emit('newStream', stream, null)
  }
  catch (e) {
    emit('newStream', null, e)
    lastDeviceStreamError.value = e instanceof Error ? e.message : 'Something went wrong while getting stream'
    console.error('Error while getting stream', e)
  }
  finally {
    attaching.value = false
  }
}

const detachMicrophone = () => {
  lastDeviceStreamError.value = null
  emit('newStream', null, null)
}
</script>

<template>
  <div class="row">
    <MicrophoneSelector @device-change="selectedDeviceId = $event" />
    <button type="button" :disabled="!selectedDeviceId || attaching" @click="attachMicrophone">
      Attach microphone
    </button>
    <button type="button" :disabled="!attached" @click="detachMicrophone">
      Detach microphone
    </button>
  </div>
  <p v-if="lastDeviceStreamError" class="error">
    {{ lastDeviceStreamError }}
  </p>
</template>
