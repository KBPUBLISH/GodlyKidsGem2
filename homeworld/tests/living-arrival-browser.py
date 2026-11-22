"""Real island arrival, selected avatar, optional bird/voice, skip and per-profile replay."""
import asyncio,os,runpy,shutil
from pathlib import Path
from playwright.async_api import async_playwright
ns=runpy.run_path(str(Path(__file__).with_name('living-test-browser.py')))
BASE=os.environ.get('LIVING_ISLAND_TEST_URL','http://127.0.0.1:3000').rstrip('/')
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  for reduced,block_bird in [(False,False),(True,True)]:
   c=await browser.new_context(viewport={'width':390,'height':844},has_touch=True,reduced_motion='reduce' if reduced else 'no-preference')
   await c.route('**/api/**',ns['api'])
   if block_bird:await c.route('**/models/mobile/perry-flight.glb*',lambda r:r.abort())
   page=await c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.goto(BASE+'/homeworld/living-test.html?players=1&livingTest=1&arrival=1&profile=arrival-fixture&player=Mikey&avatar=berry',wait_until='domcontentloaded')
   await page.wait_for_function('window.__hw?.loaded||window.__hw?.error',timeout=90000)
   assert await page.evaluate('window.__hw.loaded'),await page.evaluate('window.__hw.error')
   await ns['quality'](page)
   assert await page.evaluate('window.__hw.model.userData.avatarId')=='berry'
   await page.get_by_role('dialog',name='Welcome to your island',exact=True).wait_for()
   if not reduced:
    # Freeze only the screenshot pose; the next assertion observes the real timed reveal.
    await page.evaluate('window.__hw.livingTest.arrival.time=1.7')
    await page.wait_for_timeout(300)
    await page.screenshot(path='/tmp/island-arrival-face.png')
   await page.get_by_role('button',name='Let’s plant!',exact=True).wait_for(timeout=30000)
   assert await page.get_by_text('Hey there, Mikey!',exact=True).is_visible()
   assert not await page.get_by_role('dialog',name='My first tasks').count()
   assert not await page.get_by_role('button',name='Open Tasks').is_visible()
   await page.screenshot(path='/tmp/island-arrival-welcome'+('-reduced' if reduced else '')+'.png')
   if reduced:
    await page.get_by_role('button',name='Skip intro',exact=True).click()
   else:
    await page.get_by_role('button',name='Let’s plant!',exact=True).click()
    await page.wait_for_function('window.__hw.livingTest.farm.state.garden.planted>0',timeout=90000)
   assert await page.evaluate('window.__hw.store.state.livingArrivalSeen')
   assert await page.get_by_role('button',name='Open Tasks',exact=True).is_visible()
   await page.reload(wait_until='domcontentloaded');await page.wait_for_function('window.__hw?.loaded',timeout=90000)
   assert not await page.get_by_role('dialog',name='Welcome to your island').count()
   assert await page.evaluate('!window.__hw.livingTest.arrival?.active')
   assert not errors,errors
   print('PASS: '+('reduced motion, blocked Perry, skip' if reduced else 'face reveal, named greeting, first planting')+'; arrival saved and not repeated',flush=True)
   await c.close()
  await browser.close()
asyncio.run(main())
