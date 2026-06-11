import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5051',
        changeOrigin: true,
      },
      '/translate': {
        target: 'http://127.0.0.1:5051',
        changeOrigin: true,
      },
      '/translate_stream': {
        target: 'http://127.0.0.1:5051',
        changeOrigin: true,
      },
      '/v1': {
        target: 'http://127.0.0.1:5051',
        changeOrigin: true,
      }
    }
  }
})
