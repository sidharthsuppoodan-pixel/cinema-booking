import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, proxy API and media requests to a locally running stack
// (e.g. `docker compose up` exposes everything on http://localhost).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.VITE_PROXY_TARGET || 'http://localhost',
      '/media': process.env.VITE_PROXY_TARGET || 'http://localhost',
    },
  },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 900 },
});
