"""Real image pipeline + mobile browser: CMS delay must not hide the first island."""
import asyncio,json,os,runpy,shutil,subprocess,tempfile,time
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ns=runpy.run_path(str(Path(__file__).with_name('living-test-browser.py')))
BASE=os.environ.get('LIVING_ISLAND_TEST_URL','http://127.0.0.1:3000/').rstrip('/')

async def main():
 with tempfile.TemporaryDirectory(prefix='crew-snapshot-') as directory:
  subprocess.run(['node','--input-type=module','-e',r"""
import {buildPreviewIslands} from './scripts/build-preview-islands.mjs';
import {readFile} from 'node:fs/promises';
const books=['genesis','exodus','joshua','1-samuel','daniel'];
const rows=books.map((book,i)=>({_id:i===0?'333333333333333333333333':String(i),slug:book,title:book==='genesis'?'Genesis':book,bookLabel:book==='genesis'?'Genesis':book,status:'published',storyCounts:{published:1},mapArtUrl:`https://storage.googleapis.com/productiongk/${book}.png`}));
await buildPreviewIslands({apiRoot:'https://cms.example/api',outputDir:process.argv[1],request:async url=>{
 if(String(url).includes('/bible-map/islands')) return Response.json(rows);
 const book=new URL(url).pathname.split('/').pop().replace('.png','');
 return new Response(await readFile(`public/assets/images/sail-carousel-${book}.png`));
}});
""",directory],check=True)
  manifest=json.loads(Path(directory,'preview-islands.json').read_text())
  first=manifest['islands'][0]['previewArtUrl']
  async with async_playwright() as p:
   browser=await p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
   context=await browser.new_context(viewport={'width':390,'height':844},service_workers='block')
   page=await context.new_page();requests=[];errors=[];art_requests=[]
   page.on('request',lambda r:requests.append(r.url));page.on('pageerror',lambda e:errors.append(str(e)))
   release_cms=asyncio.Event();release_art=asyncio.Event();first_requested=asyncio.Event()
   async def api(route):
    if urlparse(route.request.url).path.endswith('/bible-map/islands'):
     await release_cms.wait()
     await route.fulfill(content_type='application/json',body=json.dumps(manifest['islands']))
    else:await ns['api'](route)
   async def art(route):
    path=urlparse(route.request.url).path;art_requests.append(path)
    if path==first:
     first_requested.set();await release_art.wait()
    await route.fulfill(path=str(Path(directory)/path.lstrip('/')),content_type='image/webp')
   await page.route('**/api/**',api)
   await page.route('**/preview-islands.json',lambda r:r.fulfill(content_type='application/json',body=json.dumps(manifest)))
   await page.route('**/assets/preview-islands/**',art)
   await page.route('https://fonts.googleapis.com/**',lambda r:r.abort())
   await page.route('https://storage.googleapis.com/**',lambda r:r.abort())
   cdp=await context.new_cdp_session(page)
   await cdp.send('Network.enable')
   await cdp.send('Network.emulateNetworkConditions',{'offline':False,'latency':100,'downloadThroughput':1000000,'uploadThroughput':500000,'connectionType':'cellular4g'})
   started=time.monotonic()
   await page.goto(BASE+'/#/crew',wait_until='domcontentloaded')
   await asyncio.wait_for(first_requested.wait(),timeout=15)
   assert art_requests==[first],art_requests
   assert not any('/homeworld/assets/mobile/' in u for u in requests),requests
   release_art.set()
   await page.wait_for_function("document.querySelector('img[data-voyage-index=\"0\"]')?.naturalWidth > 0")
   elapsed=time.monotonic()-started
   assert elapsed<15,elapsed
   assert not release_cms.is_set()
   await page.get_by_role('button',name='Sail to Genesis',exact=True).wait_for()
   await page.wait_for_function("document.querySelectorAll('img[data-voyage-index]').length===2")
   assert len(art_requests)==2,art_requests
   assert not any('alpha=' in u or 'storage.googleapis.com' in u for u in requests),requests
   await page.wait_for_function("Array.from(document.images).filter(img => /sail-voyage-hull|crew-voyage-bow|sail-voyage-wheel/.test(img.src)).every(img => img.complete && img.naturalWidth > 0)")
   await page.screenshot(path='/tmp/crew-first-island-fast.png')
   release_cms.set()
   await page.get_by_role('button',name='Sail to Genesis',exact=True).click()
   await page.wait_for_url('**/lesson/hub?storyId=*',timeout=20000)
   assert not errors,errors
   print(f'PASS: first CMS island visible in {elapsed:.2f}s at 8Mbps/100ms while CMS remains stalled; one image first, one neighbor after; no original/alpha downloads; story opens',flush=True)
   await browser.close()

if __name__=='__main__':asyncio.run(main())
