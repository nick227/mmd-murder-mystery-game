import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Required for path-based routing (/play/:gameId/:characterId, /host/:gameId)
    // Without this, direct navigation or page refresh on any path returns 404
    historyApiFallback: true,
    // Dev proxy: forwards /api/* to the backend on :3000, avoiding CORS in dev
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
