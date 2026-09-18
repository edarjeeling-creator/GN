import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function forceExitPlugin() {
  return {
    name: 'force-exit',
    apply: 'build',
    closeBundle() {
      setTimeout(() => {
        process.exit(0);
      }, 500);
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    forceExitPlugin(),
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

