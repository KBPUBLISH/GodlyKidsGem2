// Optional authoring step. Committed output keeps hosting builds dependency-free.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import fs from 'node:fs/promises';
const require = createRequire(resolve(process.env.PREVIEW_ASSET_TOOLS || '.', 'package.json'));
const sharp = require('sharp');
const dir = 'public/assets/images';
for (const [source, target, width] of [
  ['splash-adventure.jpg', 'splash-adventure-mobile-v1.webp', 768],
  ['godly-kids-logo.png', 'godly-kids-logo-mobile-v1.webp', 840],
  ['language/language-ocean-v1.png', 'language/language-ocean-mobile-v1.webp', 1024],
  ['language/language-globe-v1.png', 'language/language-globe-mobile-v1.webp', 336],
  ['map-sky-cloud-a.png', 'map-sky-cloud-a-mobile-v1.webp', 768],
  ['map-sky-cloud-b.png', 'map-sky-cloud-b-mobile-v1.webp', 768],
]) {
  await sharp(`${dir}/${source}`).resize({width, withoutEnlargement:true}).webp({quality:85, effort:6}).toFile(`${dir}/${target}`);
  console.log(target, (await fs.stat(`${dir}/${source}`)).size, '→', (await fs.stat(`${dir}/${target}`)).size);
}
