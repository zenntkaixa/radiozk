import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: process.env.VITE_HOST ?? '127.0.0.1', // the dev container sets 0.0.0.0
    port: 5173,
    // APP_PORT is exported by bin/env.sh; the dev container points API_URL at the api service
    proxy: { '/api': process.env.API_URL ?? `http://127.0.0.1:${process.env.APP_PORT ?? 3000}` },
  },
  build: { outDir: '../www', emptyOutDir: true },
});
