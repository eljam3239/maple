import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // No rewrite: the API serves its routes under /api in every environment,
      // so dev and production request identical paths. In production one
      // process serves both and this proxy isn't involved at all.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
