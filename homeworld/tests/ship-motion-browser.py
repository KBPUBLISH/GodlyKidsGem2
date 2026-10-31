"""Actual ship renderer: player + earned Adam stroll, wave on tap, optionally chat, and respect reduced motion."""
import asyncio,os,runpy,shutil
from pathlib import Path
from playwright.async_api import async_playwright
ns=runpy.run_path(str(Path(__file__).with_name('living-test-browser.py')))
BASE=os.environ.get('LIVING_ISLAND_TEST_URL','http://127.0.0.1:3000').rstrip('/')
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(storage_state=os.environ.get('SHIP_SAVE','/tmp/original-placement.json'),viewport={'width':390,'height':844},reduced_motion='no-preference')
  await ctx.add_init_script("""localStorage.setItem('debugCrewFeet','1');localStorage.setItem('godlykids_adam_tour_v1','1');sessionStorage.setItem('godlykids_crew_arrival_waved','1');""")
  await ctx.route('**/api/**',ns['api']);await ctx.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:(errors.append(str(e)),print('JS ERROR',e,flush=True)))
  page.on('console',lambda m:print(m.text,flush=True) if 'CrewDeck3D' in m.text else None)
  await page.goto(BASE+'/#/crew',wait_until='domcontentloaded');await page.wait_for_function('window.__crewFeet?.().length>=2',timeout=90000)
  assert await page.locator('[data-testid="crew-deck-3d"] canvas').count()==1
  async def feet():return await page.evaluate('window.__crewFeet()')
  initial=await feet();print('CREW',initial,flush=True)
  player=next(f for f in initial if f['id']=='ship-player');assert player['avatarId']=='trail'
  moved=set();gestures=set()
  for i in range(35):
   await page.wait_for_timeout(600)
   for f in await feet():
    assert f['safe'],f
    start=next((x for x in initial if x['id']==f['id']),None)
    if start and abs(start['x']-f['x'])+abs(start['y']-f['y'])>14:moved.add(f['id'])
    if f.get('gesture'):gestures.add(f['gesture'])
  assert 'ship-player' in moved and len(moved)>=2,(moved,await feet())
  print('STROLLS',moved,'IDLES',gestures,flush=True)
  # An explicit tap still waves with reduced motion, while free strolling stops.
  await page.emulate_media(reduced_motion='reduce');await page.wait_for_timeout(1000)
  async def tap(id):
   f=next(f for f in await feet() if f['id']==id)
   await page.mouse.click(f['x'],f['y']-f['h']*.5)
   await page.wait_for_function('(id)=>window.__crewFeet().find(f=>f.id===id)?.gesture==="wave"',arg=id,timeout=5000)
  await tap('ship-player');assert not await page.get_by_role('dialog').count()
  await page.wait_for_timeout(650);await page.screenshot(path='/tmp/ship-player-wave.png')
  await page.wait_for_timeout(2100)
  adam=next(f for f in await feet() if f['id']!='ship-player')
  await tap(adam['id']);assert not await page.get_by_role('dialog',name='Chat with Adam').count()
  await page.wait_for_timeout(650);await page.screenshot(path='/tmp/ship-adam-wave.png')
  await page.get_by_role('button',name='Chat',exact=True).click()
  await page.get_by_role('dialog',name='Chat with Adam').wait_for()
  await page.get_by_role('button',name='Close',exact=True).click()
  await page.get_by_role('button',name='Keep watching the crew').count()
  for w,h in [(390,844),(768,1024),(1024,768)]:
   await page.set_viewport_size({'width':w,'height':h});await page.wait_for_timeout(700)
   a=await feet();await page.wait_for_timeout(600);b=await feet()
   for f in b:
    before=next(x for x in a if x['id']==f['id']);assert abs(before['x']-f['x'])+abs(before['y']-f['y'])<1,(a,b)
    assert f['safe'] and 0<=f['x']<=w and 0<=f['y']<=h,f
   await page.screenshot(path=f'/tmp/ship-crew-{w}-{h}.png')
  await page.emulate_media(reduced_motion='no-preference');await page.wait_for_function('window.__crewFeet().some(f=>f.mode==="walking")',timeout=20000)
  assert not errors,errors
  print('PASS: chosen 3D player and Adam stroll on the deck, safe positions, tap waves, optional original chat, phone/iPad resizing, reduced-motion pause and resume',flush=True)
  await browser.close()
asyncio.run(main())
