
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    hmr: { host: 'localhost' },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Volvemos al splitting por defecto de Vite para evitar ciclos entre chunks (react-vendor/vendor).
    chunkSizeWarningLimit: 2100,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setupTests.ts',
  },
})

