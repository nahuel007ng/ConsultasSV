import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Para desarrollo local: proxy /api -> localhost:3000
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})
