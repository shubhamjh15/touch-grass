import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/ollama-1': {
        target: 'http://108.181.196.208:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ollama-1/, '')
      },
      '/ollama-2': {
        target: 'http://172.236.213.60:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ollama-2/, '')
      },
      '/ollama-3': {
        target: 'http://5.149.249.212:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ollama-3/, '')
      }
    }
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
