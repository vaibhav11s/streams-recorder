import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      {
        find: /^streams-recorder\/vue$/,
        replacement: fileURLToPath(new URL('../../src/vue.ts', import.meta.url)),
      },
      {
        find: /^streams-recorder$/,
        replacement: fileURLToPath(new URL('../../src/index.ts', import.meta.url)),
      },
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
    ],
  },
  server: {
    fs: {
      allow: ['../..'],
    },
  },
})
