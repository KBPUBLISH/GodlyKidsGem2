import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {buildPreviewIslands,ISLAND_IMAGE_BUDGET} from '../scripts/build-preview-islands.mjs';
import {previewIslandArt} from '../utils/previewIslandArt.mjs';

test('build snapshots real CMS rows and compresses their original art with alpha preserved', async () => {
  const outputDir=await mkdtemp(join(tmpdir(),'crew-art-'));
  const original=await readFile(new URL('../public/assets/images/map-island-genesis.png',import.meta.url));
  const rows=[{slug:'genesis',_id:'real-cms-id',title:'Genesis',status:'published',mapArtUrl:'https://storage.googleapis.com/productiongk/real.png',storyCounts:{published:5}},
    {slug:'archived',status:'archived',mapArtUrl:'https://example.com/not-requested.png'}];
  const requests=[];
  try {
    const {islands,sizes}=await buildPreviewIslands({apiRoot:'https://cms.example/api',outputDir,request:async url=>{
      requests.push(String(url));
      return String(url).includes('/bible-map/islands') ? Response.json(rows) : new Response(original);
    }});
    assert.equal(requests.length,2);
    assert.equal(islands.length,1);
    assert.equal(islands[0]._id,'real-cms-id');
    assert.equal(islands[0].mapArtUrl,rows[0].mapArtUrl);
    assert.ok(sizes[0].previewBytes <= ISLAND_IMAGE_BUDGET);
    assert.ok(sizes[0].previewBytes < original.length / 3);
    const image=await sharp(await readFile(outputDir+islands[0].previewArtUrl)).metadata();
    assert.equal(image.format,'webp');assert.equal(image.hasAlpha,true);
    assert.ok(image.width<=768 && image.height<=768);
    assert.deepEqual(JSON.parse(await readFile(`${outputDir}/preview-islands.json`)).islands,islands);
  } finally {await rm(outputDir,{recursive:true,force:true});}
});

test('a broken first-island source fails publishing rather than silently shipping a blank island', async () => {
  const outputDir=await mkdtemp(join(tmpdir(),'crew-art-'));
  try {
    await assert.rejects(buildPreviewIslands({apiRoot:'https://cms.example/api',outputDir,request:async url=>
      String(url).includes('/bible-map/islands') ? Response.json([{slug:'genesis',status:'published',mapArtUrl:'https://example.com/missing.png'}]) : new Response('',{status:404})}),/artwork HTTP 404/);
  } finally {await rm(outputDir,{recursive:true,force:true});}
});

test('later uploaded art uses a bounded WebP transformation on the testing host', () => {
  const source='https://storage.googleapis.com/productiongk/books/bible-map/new-art.png';
  const url=new URL(previewIslandArt(source,'godlykidstesting.netlify.app'),'https://godlykidstesting.netlify.app');
  assert.equal(url.pathname,'/.netlify/images');
  assert.equal(url.searchParams.get('url'),source);
  assert.equal(url.searchParams.get('w'),'768');assert.equal(url.searchParams.get('fm'),'webp');
  assert.equal(previewIslandArt(source,'localhost'),source);
});
