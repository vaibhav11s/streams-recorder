<script lang="ts" setup>
import { ref } from 'vue'
import { getDisplayAudioStream } from './stream.ts'

const { attached } = defineProps<{
  attached: boolean
}>()

const emit = defineEmits<DisplayStreamSelectorEmits>()

type DisplayStreamSelectorEmits = {
  newStream: [stream: MediaStream | null, error: null] | [stream: null, error: unknown]
}

const lastError = ref<string | null>(null)

const attachDisplay = async () => {
  lastError.value = null
  try {
    const stream = await getDisplayAudioStream()
    emit('newStream', stream, null)
  }
  catch (error) {
    lastError.value = error instanceof Error ? error.message : 'Failed to attach display audio'
    emit('newStream', null, error)
  }
}

const detachDisplay = () => {
  lastError.value = null
  emit('newStream', null, null)
}
</script>

<template>
  <div class="row">
    <button type="button" :disabled="attached" @click="attachDisplay">
      Attach display audio
    </button>
    <button type="button" :disabled="!attached" @click="detachDisplay">
      Detach display
    </button>
  </div>
  <p v-if="lastError" class="error">
    {{ lastError }}
  </p>
</template>
