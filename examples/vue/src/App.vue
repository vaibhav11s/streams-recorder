<script lang="ts" setup>
import { ref } from 'vue'
import RecorderDemo from './RecorderDemo.vue'

const sessionKey = ref(0)
</script>

<template>
  <RecorderDemo :key="sessionKey" @reset="sessionKey += 1" />
</template>
