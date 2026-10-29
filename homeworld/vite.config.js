import localization from '../localization/vite-localization.mjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const dir = path.dirname(fileURLToPath(import.meta.url));

/** Map files and icons live under public/homeworld, not the app's /assets or /icons folders. */
function rewriteHomeworldAssets(code) {
  return code
    .replace(/(?<!\/homeworld)\/assets\//g, '/homeworld/assets/')
    .replace(/(?<!\/homeworld)\/icons\//g, '/homeworld/icons/');
}

/** Players World build. Assets stay in public/homeworld; this only emits the app bundle. */
export default defineConfig({
  root: dir,
  envDir: path.resolve(dir, '..'),
  base: '/homeworld/',
  publicDir: false,
  plugins: [
    localization(path.resolve(dir,'..')),
    {
      name: 'rewrite-homeworld-assets',
      generateBundle(_options, bundle) {
        for (const file of Object.values(bundle)) {
          if (file.type === 'chunk') file.code = rewriteHomeworldAssets(file.code);
          if (file.type === 'asset' && typeof file.source === 'string') {
            file.source = rewriteHomeworldAssets(file.source);
          }
        }
      },
    },
  ],
  // Stamped into asset URLs so the app's cache-first service worker picks up re-exported maps/models.
  define: { __HW_BUILD__: JSON.stringify(Date.now().toString(36)) },
  build: {
    outDir: path.resolve(dir, 'dist'),
    emptyOutDir: true,
  },
});
