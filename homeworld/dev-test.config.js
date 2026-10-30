import { defineConfig } from 'vite';
import config from './vite.config.js';

// Run the existing island directly, using its original checked-in assets.
// Production continues to use homeworld/vite.config.js without this dev middleware.
export default defineConfig({
  ...config,
  base: '/',
  publicDir: '../public',
  server: { host: '127.0.0.1', port: 5190, strictPort: true },
  plugins: [...config.plugins, {
    name: 'original-island-dev-assets',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (/^\/assets\/[^/]+\.(glb|json|jpg|png|webp)(\?|$)/.test(req.url || '')) req.url = `/homeworld${req.url}`;
        if ((req.url || '').startsWith('/icons/')) req.url = `/homeworld${req.url}`;
        next();
      });
    },
  }],
});
