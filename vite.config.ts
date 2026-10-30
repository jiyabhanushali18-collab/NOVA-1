import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
      include: ['retry'],
      exclude: ['@decartai/sdk'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api/analyze-vision': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/upload': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/output': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        // ignore large native/android build trees to avoid dep-scan restarts
        ignored: ['**/android/**', '**/android/*/**', '**/build/**', '**/android/app/build/**', '**/server/data/**', '**/scratch/**']
      },
    },
  };
});
