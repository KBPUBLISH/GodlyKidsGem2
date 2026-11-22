"""Verify splash downloads are actually reused by the playable island (real service worker)."""
import asyncio, os, runpy, shutil, time
from pathlib import Path
from playwright.async_api import async_playwright

ns=runpy.run_path(str(Path(__file__).with_name('living-test-browser.py')))
BASE=os.environ.get('LIVING_ISLAND_TEST_URL','http://127.0.0.1:3000/').rstrip('/')

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  context=await browser.new_context(viewport={'width':390,'height':844},service_workers='allow')
  await context.route('**/api/**',ns['api'])
  await context.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  page=await context.new_page();errors=[];misses=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  await page.goto(BASE+'/',wait_until='domcontentloaded')
  await page.wait_for_function("""async () => {
   const cache=await caches.open('godlykids-images-v1');
   return (await cache.keys()).filter(request => request.url.includes('/homeworld/assets/mobile/')).length===6;
  }""",timeout=45000)
  await page.get_by_role('button',name='Continue →',exact=True).wait_for(timeout=45000)
  await page.wait_for_function('!!navigator.serviceWorker.controller')
  cached=await page.evaluate("""async () => {
   const cache=await caches.open('godlykids-images-v1');
   return (await cache.keys()).map(request => request.url).filter(url => url.includes('/homeworld/assets/mobile/'));
  }""")
  assert len(cached)==6,cached
  # Any network miss for an already-warmed model now fails. The SW must supply it.
  async def fail_model(route):
   misses.append(route.request.url)
   await route.abort()
  for model in ['environment','library','construction','house-upgrades','wood-storage','church']:
   await context.route(f'**/homeworld/assets/mobile/{model}.glb*',fail_model)
  started=time.monotonic()
  await page.evaluate("location.hash='/my-home'")
  await page.wait_for_selector('iframe');frame=page.frames[-1]
  await frame.wait_for_function('window.__hw?.loaded||window.__hw?.error',timeout=60000)
  assert await frame.evaluate('window.__hw.loaded'),await frame.evaluate('window.__hw.error')
  assert not misses,misses
  await ns['quality'](frame)
  await frame.get_by_role('button',name='Make my garden bigger',exact=True).wait_for()
  assert not errors,errors
  print(f'PASS: all six splash-warmed island models reused with their network requests blocked; playable in {time.monotonic()-started:.2f}s locally; no JS errors',flush=True)
  await browser.close()

if __name__=='__main__':
 asyncio.run(main())
