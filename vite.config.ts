import localization from './localization/vite-localization.mjs';
import path from 'path';
import {existsSync,readFileSync} from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import previewStyles from './scripts/preview-styles.mjs';

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
      preview: {
        port: 4173,
        host: '127.0.0.1',
        strictPort: true,
      },
      plugins: [localization(__dirname), react(), previewStyles(env.VITE_LIVING_TEST === '1'), {
        name:'living-island-test-build',
        configureServer(server){
          server.middlewares.use((req,res,next)=>{
            const pathname=(req.url||'').split('?')[0];
            const file=pathname==='/homeworld/living-test.html'?path.join(__dirname,'homeworld/dist/index.html'):
              pathname.startsWith('/homeworld/assets/')?path.join(__dirname,'homeworld/dist/assets',path.basename(pathname)):null;
            if(!file||!existsSync(file))return next();
            const ext=path.extname(file);
            res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.wasm':'application/wasm'} as Record<string,string>)[ext]||'application/octet-stream');
            res.end(readFileSync(file));
          });
        }
      }],
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
