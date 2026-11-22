import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for (const file of ['sw-image-cache.js','asset-cache-sw.js']) {
  function worker() {
    const handlers = {};
    let cacheReads = 0;
    const context = {
      self: { location:{origin:'https://app.godlykids.com'}, addEventListener:(name,fn)=>handlers[name]=fn, skipWaiting(){}, clients:{claim(){}} },
      URL, Response, console,
      caches:{open:async()=>{cacheReads++;return {match:async()=>new Response('cached whole file',{status:200})};}},
    };
    vm.runInNewContext(fs.readFileSync(new URL('../public/'+file,import.meta.url),'utf8'),context);
    return {handlers,cacheReads:()=>cacheReads};
  }
  for (const [label,url,destination,range] of [
    ['Safari two-byte probe','https://app.godlykids.com/assets/story.mp4','video','bytes=0-1'],
    ['extensionless range','https://storage.googleapis.com/bucket/media','', 'bytes=100-200'],
    ['video without Range','https://storage.googleapis.com/bucket/media','video',null],
    ['signed video prefetch','https://storage.googleapis.com/bucket/story.mp4?token=example','',null],
    ['audio streaming','https://app.godlykids.com/assets/story.mp3','audio',null],
  ]) test(`${file}: ${label} bypasses whole-file cache`,()=>{
    const w=worker();let intercepted=false;
    w.handlers.fetch({request:{method:'GET',url,destination,mode:'cors',headers:new Headers(range?{Range:range}:{})},respondWith(){intercepted=true;}});
    assert.equal(intercepted,false);assert.equal(w.cacheReads(),0);
  });
  test(`${file}: images retain cache hits`,async()=>{
    const w=worker();let response;
    w.handlers.fetch({request:{method:'GET',url:'https://app.godlykids.com/assets/cover.png',destination:'image',mode:'cors',headers:new Headers()},respondWith(p){response=p;}});
    assert.equal(await (await response).text(),'cached whole file');assert.equal(w.cacheReads(),1);
  });
}
