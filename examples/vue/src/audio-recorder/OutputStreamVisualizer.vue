<script lang="ts" setup>
import { onMounted, onUnmounted, useTemplateRef } from 'vue'
import { attachOutputVisualizer } from '../../../shared/output-visualizer'

const { stream, audioContext } = defineProps<{
  stream: MediaStream
  audioContext?: AudioContext
}>()

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
let visualizer: ReturnType<typeof attachOutputVisualizer> | undefined

onMounted(() => {
  if (!canvas.value) return
  visualizer = attachOutputVisualizer(stream, canvas.value, { audioContext })
})

onUnmounted(() => {
  visualizer?.dispose()
})

defineExpose({
  resume: () => visualizer?.resume(),
})
</script>

<template>
  <canvas
    ref="canvas"
    width="640"
    height="96"
    aria-label="Mixed output audio levels"
  />
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 6rem;
  border-radius: 0.375rem;
  --viz-bg: color-mix(in srgb, CanvasText 8%, Canvas);
  --viz-bar: #0d9488;
}
</style>
