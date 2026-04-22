import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        hmr: {
          overlay: true,
        },
        watch: {
          usePolling: true,
          interval: 100,
        },
      },
      plugins: [react()],
      // SECURITY: Never inject GEMINI_API_KEY (or any other server-side secret) into the
      // client bundle via Vite's `define`. Vite's `define` performs a raw text replacement
      // at build time, so any `process.env.API_KEY` reference in the frontend would bake
      // the literal key into the public JS bundle, where it can be scraped by bots. All
      // Gemini calls must be proxied through the backend (see backend/src/routes/*).
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
