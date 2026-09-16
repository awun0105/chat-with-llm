import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
  base: process.env.VITE_BASE || '/',
  server: {
    port: 5173,
    watch: process.env.VITE_WATCH_POLLING === 'true'
      ? { usePolling: true, interval: 500 }
      : undefined,
    proxy: {
      '/api': process.env.VITE_API_PROXY || 'http://127.0.0.1:8000',
    },
  },
})
