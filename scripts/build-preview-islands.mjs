// Publish the actual CMS artwork alongside the preview. Children should not
// wait for the CMS to wake up, then download its full-size upload.
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {resolveApiEndpoint} from '../utils/apiEndpoint.mjs';

export const ISLAND_IMAGE_BUDGET = 250000;
export async function compactIslandImage(input) {
  for (const [width, quality] of [[768,82], [640,76], [512,70], [384,65]]) {
    const output = await sharp(input, {limitInputPixels:40000000}).rotate()
      .resize({width, height:768, fit:'inside', withoutEnlargement:true})
      .webp({quality, effort:5}).toBuffer();
    if (output.length <= ISLAND_IMAGE_BUDGET) return output;
  }
  throw Error('Island artwork exceeds the mobile byte budget');
}

export async function buildPreviewIslands({apiRoot, outputDir='dist', request=fetch}) {
  const res = await request(`${apiRoot.replace(/\/$/,'')}/bible-map/islands?status=all`, {signal:AbortSignal.timeout(90000)});
  if (!res.ok) throw Error(`Island catalogue HTTP ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows) || !rows.length) throw Error('Island catalogue is empty');
  const islands = [], sizes = [];
  await mkdir(`${outputDir}/assets/preview-islands`, {recursive:true});
  for (const row of rows.filter(row => row.status !== 'archived')) {
    // This is public catalogue data only. Do not include unpublished story bodies.
    const island = Object.fromEntries(['_id','slug','title','bookLabel','description','mapArtUrl','sailArtUrl','mainMapUrl','mainMapVideoUrl','mapPosition','order','unlockRule','status','storyCounts']
      .filter(key => row[key] !== undefined).map(key => [key,row[key]]));
    const art = row.mapArtUrl || row.sailArtUrl;
    if (art) {
      const url = new URL(art, apiRoot.replace(/\/api\/?$/,'/'));
      const source = url.pathname.startsWith('/assets/') && !/^https?:/.test(art)
        ? await readFile(resolve('public', decodeURIComponent(url.pathname).slice(1)))
        : await (async () => {
          const image = await request(url, {signal:AbortSignal.timeout(60000)});
          if (!image.ok) throw Error(`Island artwork HTTP ${image.status}`);
          if (Number(image.headers.get('content-length')) > 25000000) throw Error('Island source exceeds 25 MB');
          return Buffer.from(await image.arrayBuffer());
        })();
      const output = await compactIslandImage(source);
      const hash = createHash('sha256').update(output).digest('hex').slice(0,16);
      island.previewArtUrl = `/assets/preview-islands/${hash}.webp`;
      await writeFile(`${outputDir}${island.previewArtUrl}`, output);
      sizes.push({island:row.slug || row._id, originalBytes:source.length, previewBytes:output.length});
    }
    islands.push(island);
  }
  await writeFile(`${outputDir}/preview-islands.json`, JSON.stringify({version:1, islands}));
  await writeFile(`${outputDir}/preview-island-sizes.json`, JSON.stringify(sizes));
  console.log('Crew island artwork:', JSON.stringify(sizes));
  return {islands, sizes};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.env.NETLIFY === 'true' || process.env.PREVIEW_BUILD_ISLANDS === '1') {
    // Netlify must have real optimized art before publishing this build.
    const base=resolveApiEndpoint(process.env.VITE_API_BASE_URL, 'preview.netlify.app').replace(/\/$/,'');
    await buildPreviewIslands({apiRoot:base.endsWith('/api') ? base : `${base}/api`});
  } else {
    await writeFile('dist/preview-islands.json', JSON.stringify({version:1,islands:[]}));
    console.log('Local build: live CMS snapshot omitted. Netlify creates it before publishing.');
  }
}
