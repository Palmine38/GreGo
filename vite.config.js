import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/tag': {
        target: 'https://data.mobilites-m.fr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tag/, '')
      }
    }
  }
})