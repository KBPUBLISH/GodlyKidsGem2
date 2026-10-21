import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    // The workspace lives on an external volume (/Volumes/...) where macOS's
    // native fs events are unreliable, so chokidar misses edits and HMR
    // silently serves stale code. Polling is a bit heavier on CPU but makes
    // file watching bulletproof here.
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  preview: {
    port: 4180,
  },
});
