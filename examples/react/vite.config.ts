import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^streams-recorder\/react$/,
        replacement: fileURLToPath(new URL('../../src/react.ts', import.meta.url)),
      },
      {
        find: /^streams-recorder$/,
        replacement: fileURLToPath(new URL('../../src/index.ts', import.meta.url)),
      },
    ],
  },
  server: {
    fs: {
      allow: ['../..'],
    },
  },
})
