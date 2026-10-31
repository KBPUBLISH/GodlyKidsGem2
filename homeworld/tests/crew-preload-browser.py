"""The complete crew screen must reuse splash downloads, including on a 3G-class connection."""
import asyncio,json,os,runpy,shutil,subprocess,time
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ns=runpy.run_path(str(Path(__file__).with_name('living-test-browser.py')))
BASE=os.environ.get('LIVING_ISLAND_TEST_URL','http://127.0.0.1:3000/').rstrip('/')
SHIP=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {PREVIEW_SHIP_ART} from './utils/previewAssets.mjs';console.log(JSON.stringify(Object.values(PREVIEW_SHIP_ART)))"],text=True))
FIRST='/assets/preview-islands/qa-first.webp'
MANIFEST={'version':1,'islands':[{**ns['ISLAND'],'mapArtUrl':'/assets/images/map-island-genesis.png','previewArtUrl':FIRST}]}

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  context=await browser.new_context(viewport={'width':390,'height':844},service_workers='allow')
  await context.add_init_script("Object.defineProperty(navigator,'connection',{value:{effectiveType:'3g',saveData:false},configurable:true})")
  async def api(route):
   if urlparse(route.request.url).path.endswith('/bible-map/islands'):
    await route.fulfill(content_type='application/json',body=json.dumps(MANIFEST['islands']))
   else:await ns['api'](route)
  await context.route('**/api/**',api)
  await context.route('**/preview-islands.json',lambda r:r.fulfill(content_type='application/json',body=json.dumps(MANIFEST)))
  await context.route('**/assets/preview-islands/qa-first.webp',lambda r:r.fulfill(content_type='image/webp',path='public/assets/images/explore-island-genesis.webp'))
  await context.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  await context.route('**/models/mobile/perry-flight.glb*',lambda r:r.abort())
  page=await context.new_page();requests=[];misses=[];errors=[]
  page.on('request',lambda r:requests.append(r.url));page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(BASE+'/',wait_until='domcontentloaded')
  deadline=time.monotonic()+45
  while True:
   missing=await page.evaluate("""async urls => {
    const cache=await caches.open('godlykids-images-v1');
    const results=await Promise.all(urls.map(url=>cache.match(url)));
    return urls.filter((_,index)=>!results[index]);
   }""",SHIP+[FIRST])
   if not missing:break
   assert time.monotonic()<deadline,missing
   await page.wait_for_timeout(100)
  assert not any('.glb' in url for url in requests),requests
  await page.wait_for_function('!!navigator.serviceWorker.controller')
  # Block the original network URLs once warmed: a fully drawn ship must now
  # come from cache, even after actual language and name-entry navigation.
  async def block_download(route):
   misses.append(route.request.url)
   await route.abort()
  for url in SHIP+[FIRST]:
   await context.route(BASE+url,block_download)
  await page.get_by_role('button',name='Continue →',exact=True).click()
  await page.get_by_role('button',name='Continue',exact=True).click()
  for title in ['Unlock','Build & Grow','Discover']:
   await page.get_by_role('heading',name=title,exact=True).wait_for()
   await page.get_by_role('button',name='Continue',exact=True).click()
  await page.get_by_role('button',name='Maybe later',exact=True).click()
  await page.get_by_role('textbox',name='Your name').fill('Sarah')
  await page.get_by_role('spinbutton',name='Your age').fill('8')
  await page.get_by_role('button',name="Continue",exact=True).click()
  started=time.monotonic()
  await page.get_by_role('button',name='This is me!',exact=True).click()
  await page.wait_for_url('**/#/crew')
  await page.get_by_role('button',name='Sail to Genesis',exact=True).wait_for()
  # First-run guidance intentionally hides the bottom navigation. All of its
  # art is already cached; verify every image actually rendered on this visit.
  await page.wait_for_function("""() => {
   const art=Array.from(document.images).filter(img => /sail-voyage-|crew-voyage-|crew-button-plank|map-sky-cloud-|preview-islands/.test(img.src));
   return art.length >= 2 && art.every(img => img.complete && img.naturalWidth>0);
  }""")
  assert (await page.locator('img[data-voyage-index="0"]').get_attribute('src'))==FIRST
  assert not misses,misses
  assert not errors,errors
  await page.screenshot(path='/tmp/crew-preloaded-no-network.png')
  print(f'PASS: all {len(SHIP)} ship assets + first island cached on splash with 3G classification; no speculative models; real onboarding reaches the ship with those network URLs blocked ({time.monotonic()-started:.2f}s including transition)',flush=True)
  await browser.close()

if __name__=='__main__':asyncio.run(main())
