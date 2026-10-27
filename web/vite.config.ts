import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: { '/api': `http://127.0.0.1:${process.env.APP_PORT ?? 3000}` }, // APP_PORT is exported by bin/env.sh
  },
  build: { outDir: '../www', emptyOutDir: true },
});
