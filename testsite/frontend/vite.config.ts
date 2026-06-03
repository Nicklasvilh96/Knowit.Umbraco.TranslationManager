import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward Umbraco API calls to the backend during development
      '/umbraco': {
        target: 'https://localhost:44346',
        secure: false,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../Knowit.Umbraco.TranslationManager.TestSite/wwwroot/dist',
    emptyOutDir: true,
  },
})
