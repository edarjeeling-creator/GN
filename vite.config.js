import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  preview: {
    allowedHosts: true
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    reportCompressedSize: false,
    minify: 'esbuild',
    cssMinify: true,
    chunkSizeWarningLimit: 2000
  }
})

