import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules[\\/]react(?:-dom|-router|-router-dom)?[\\/]/.test(id)) return 'react-vendor';
          // Icons are not grouped: one shared icon chunk made every page download every icon the app uses.
          if (id.includes('node_modules/socket.io-client') || id.includes('node_modules/sonner')) return 'app-vendor';
          return undefined;
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
});
