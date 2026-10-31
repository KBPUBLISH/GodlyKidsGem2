"""Production preview startup, failure recovery and throttled-load checks; build and serve first."""
import asyncio,json,shutil,time,runpy,os
from pathlib import Path
from playwright.async_api import async_playwright
ns=runpy.run_path(str(Path(__file__).with_name('living-test-browser.py')))
BASE=os.environ.get('LIVING_ISLAND_TEST_URL','http://127.0.0.1:3000/').rstrip('/')
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  ctx=await b.new_context(viewport={'width':390,'height':844},service_workers='block')
  page=await ctx.new_page();requests=[];errors=[];broken=False
  page.on('request',lambda r:requests.append(r.url));page.on('pageerror',lambda e:errors.append(str(e)))
  async def api(r):
   if broken and '/bible-map/islands' in r.request.url:await r.fulfill(status=503,body='Temporary outage')
   else:await ns['api'](r)
  await page.route('**/api/**',api)
  await page.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  await page.route('**/models/mobile/perry-flight.glb*',lambda r:r.abort())
  world_waiting=asyncio.Event();release_world=asyncio.Event()
  async def hold_world(r):
   world_waiting.set()
   await release_world.wait()
   await r.abort()
  await page.route('**/homeworld/assets/mobile/environment.glb*',hold_world)
  await page.goto(BASE+'/',wait_until='domcontentloaded')
  await page.get_by_role('heading',name='A Bible Adventure Awaits').wait_for()
  await asyncio.wait_for(world_waiting.wait(),timeout=25)
  await page.wait_for_function("Array.from(document.images).some(img => img.src.includes('splash-adventure-mobile') && img.complete && getComputedStyle(img).opacity === '1')")
  await page.screenshot(path='/tmp/preview-splash-restored.png')
  assert not await page.get_by_role('heading',name='Choose your language').count()
  assert await page.get_by_role('button',name='Continue anyway',exact=True).is_enabled()
  await page.get_by_role('button',name='Continue anyway',exact=True).click()
  await page.get_by_role('heading',name='Choose your language').wait_for()
  await page.wait_for_function("document.querySelector('.language-globe img')?.complete && document.querySelector('.language-globe img')?.naturalWidth > 0")
  await page.screenshot(path='/tmp/preview-language-lightweight.png')
  assert not any('language-ocean-v1.png' in u or 'language-globe-v1.png' in u for u in requests)
  language_indices=[next(i for i,u in enumerate(requests) if asset in u) for asset in ['language-ocean-mobile-v1.webp','language-globe-mobile-v1.webp']]
  assert max(language_indices) < next(i for i,u in enumerate(requests) if '/homeworld/assets/mobile/environment.glb' in u)
  assert await page.locator('video').count()==0
  assert not any('cdn.tailwindcss' in u for u in requests)
  await page.get_by_role('button',name='Continue',exact=True).click()
  await page.get_by_role('button',name='Kid',exact=True).click()
  await page.get_by_role('textbox',name='Your name').fill('Sarah')
  await page.get_by_role('spinbutton',name='Your age').fill('8')
  await page.get_by_role('button',name="That's me!",exact=True).click()
  await page.get_by_role('button',name='This is me!',exact=True).click()
  await page.get_by_role('button',name='Take a Tour',exact=True).click()
  await page.wait_for_url('**/#/crew',timeout=15000)
  release_world.set()
  assert not any('.mp4' in u or 'map-ocean-scroll' in u or 'perry-flight-essentials' in u for u in requests),requests
  print('PASS: original splash first; language artwork and world download start there; Continue bypasses stalled world download; no videos/CDN compiler/bulk preloads; onboarding works when Perry fails',flush=True)
  await ctx.close()
  ctx=await b.new_context(viewport={'width':390,'height':844},service_workers='block');page=await ctx.new_page()
  await page.route('**/api/**',api);await page.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  await page.goto(BASE+'/#/map',wait_until='domcontentloaded')
  await page.wait_for_url('**/#/crew')
  await page.get_by_role('button',name='Sail to Genesis',exact=True).wait_for(timeout=20000)
  assert await page.locator('img[data-voyage-index]').first.evaluate('(img)=>img.complete&&img.naturalWidth>0')
  await page.screenshot(path='/tmp/preview-ship-first-island.png')
  await page.get_by_role('button',name='Sail to Genesis',exact=True).click()
  await page.wait_for_url('**/lesson/hub?storyId=*',timeout=20000)
  print('PASS: /map redirects to ship; CMS row without artwork still shows an island; tap opens first story pack',flush=True)
  await ctx.close()
  ctx=await b.new_context(viewport={'width':390,'height':844},service_workers='block');page=await ctx.new_page()
  await page.route('**/api/**',api);await page.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  broken=True
  await page.goto(BASE+'/#/crew',wait_until='domcontentloaded')
  await page.get_by_role('button',name='Try stories again',exact=True).wait_for(timeout=20000)
  broken=False
  await page.get_by_role('button',name='Try stories again',exact=True).click()
  await page.get_by_role('button',name='Sail to Genesis',exact=True).wait_for(timeout=20000)
  print('PASS: CMS outage shows retry; recovery restores island without a blank map',flush=True)
  await ctx.close()
  ctx=await b.new_context(viewport={'width':390,'height':844},service_workers='block');page=await ctx.new_page()
  requests=[];page.on('request',lambda r:requests.append(r.url));page.on('pageerror',lambda e:errors.append(str(e)))
  await page.route('**/api/**',api);await page.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  await page.route('**/mobile/adam.glb*',lambda r:r.abort())
  cdp=await ctx.new_cdp_session(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions',{'offline':False,'latency':100,'downloadThroughput':1000000,'uploadThroughput':500000,'connectionType':'cellular4g'})
  started=time.monotonic()
  await page.goto(BASE+'/#/my-home',wait_until='domcontentloaded')
  await page.wait_for_selector('iframe');frame=page.frames[-1]
  await frame.wait_for_function('window.__hw?.loaded||window.__hw?.error',timeout=90000)
  assert await frame.evaluate('window.__hw.loaded'),await frame.evaluate('window.__hw.error')
  elapsed=time.monotonic()-started
  assert 'living-test.html' in frame.url
  assert not any('/eve.glb' in u or '/noah.glb' in u or '/assets/adam.glb' in u or 'map-ocean-scroll' in u for u in requests)
  await ns['quality'](frame)
  await ns['finish_garden'](frame)
  assert await frame.get_by_role('button',name='Find a log',exact=True).is_visible()
  assert await frame.evaluate('window.__hw.livingTest.farm.state.coins')==10
  print(f'PASS: cold /my-home opens new test automatically in {elapsed:.2f}s at 8Mbps/100ms, free garden and next wood task work despite failed Adam download',flush=True)
  print('PAGE ERRORS:',errors,flush=True)
  assert not errors,errors
  await b.close()
if __name__ == '__main__':
 asyncio.run(main())
