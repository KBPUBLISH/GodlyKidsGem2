"""Friends World: touch rod/prompt, cast, reel, save the catch and restore the island."""
import asyncio,os,runpy,shutil
from pathlib import Path
from playwright.async_api import async_playwright
ns=runpy.run_path(str(Path(__file__).with_name('living-test-browser.py')))
BASE=os.environ.get('LIVING_ISLAND_TEST_URL','http://127.0.0.1:3000').rstrip('/')
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(storage_state=os.environ.get('FRIEND_SAVE','/tmp/original-placement.json'),viewport={'width':390,'height':844},reduced_motion='reduce',has_touch=True)
  await ctx.route('**/api/**',ns['api']);await ctx.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:(errors.append(str(e)),print(e,flush=True)))
  await page.goto(BASE+'/#/my-home');await page.wait_for_selector('iframe[title="Players World"]');f=page.frames[-1]
  await f.wait_for_function('window.__hw?.loaded',timeout=90000);await ns['quality'](f)
  await f.evaluate("""()=>{const g=window.__hw,t=g.livingTest;if(t.placingAdam)t.placeAdam();g.dismissMorning();t.tasksOpen=false;t.state.welcomeSeen=true;t.state.inviteDismissed=true;t.save();t.stopWatching();g.clockChange(0,true);const s=g.store.state;g.store.save({...s,characters:{...s.characters,you:{...s.characters.you,energy:100,hunger:100,hungerAt:s.clock.minutes}}});const p=g.nav.nearest(g.fishing.landing(),1);g.player={...p};g.actor.position.set(p.x,g.fishing.deckY,-p.y);g.path=[];g.order=null;g.focus.copy(g.actor.position);g.persist();g.notify();}""")
  await f.get_by_role('button',name='Go fishing from the dock',exact=True).wait_for(timeout=15000)
  print('PROMPT visible',flush=True)
  await page.wait_for_timeout(1000)
  await page.screenshot(path='/tmp/fishing-prompt.png')
  # Zero energy gives clear feedback without entering or consuming anything.
  await f.evaluate("""()=>{const g=window.__hw,s=g.store.state;g.store.save({...s,characters:{...s.characters,you:{...s.characters.you,energy:0}}});g.notify();}""")
  await f.get_by_role('button',name='Go fishing from the dock',exact=True).tap()
  assert not await f.evaluate('window.__hw.fishing.active')
  low=await f.evaluate('({status:window.__hw.status,toasts:window.__hw.toasts,energy:window.__hw.store.state.characters.you.energy,order:window.__hw.order,action:window.__hw.action})')
  assert 'needs 4 energy' in low['status'],low
  await f.evaluate("""()=>{const g=window.__hw,s=g.store.state;g.store.save({...s,characters:{...s.characters,you:{...s.characters.you,energy:100}}});g.notify();}""")
  await page.wait_for_timeout(750)
  before=await f.evaluate('window.__hw.store.state.inventory.fish||0')
  await f.get_by_role('button',name='Go fishing from the dock',exact=True).tap()
  await f.wait_for_function('window.__hw.fishing.phase==="cast"',timeout=30000)
  assert await f.evaluate('window.__hw.store.state.activeCharacter')=='you'
  for w,h in [(390,844),(768,1024)]:
   await page.set_viewport_size({'width':w,'height':h});await page.wait_for_timeout(300)
   box=await f.locator('.fishing-cast').bounding_box();assert box['x']>=0 and box['y']>=0 and box['x']+box['width']<=w+1 and box['y']+box['height']<=h+1,box
   await page.screenshot(path=f'/tmp/living-fishing-{w}.png')
  await page.set_viewport_size({'width':390,'height':844})
  cast=await f.locator('.fishing-cast').bounding_box();frame=await page.locator('iframe[title="Players World"]').bounding_box()
  await page.mouse.move(frame['x']+cast['x']+cast['width']/2,frame['y']+cast['y']+cast['height']/2);await page.mouse.down();await page.wait_for_timeout(550);await page.mouse.up()
  await f.wait_for_function('window.__hw.fishing.phase==="bite"',timeout=30000)
  print('CAST and BITE',flush=True)
  for _ in range(100):
   phase=await f.evaluate('({phase:window.__hw.fishing.phase,struggling:window.__hw.fishing.struggling})')
   if phase['phase'] in ['landing','caught','leaving','idle']:break
   assert phase['phase'] in ['bite','reel'],phase
   if phase['struggling']:await page.wait_for_timeout(120)
   else:await f.locator('.fishing-reel').tap()
  await f.wait_for_function('(before)=>(window.__hw.store.state.inventory.fish||0)===before+1',arg=before,timeout=20000)
  await f.wait_for_function('!window.__hw.fishing.active&&!window.__hw.action',timeout=20000)
  assert await f.evaluate('window.__hw.store.state.characters.you.energy')==96
  assert await f.evaluate('window.__hw.actor.visible&&!window.__hw.fishing.firstPerson')
  print('CATCH saved, original camera/avatar restored',flush=True)
  # Direct touch on the spare rod must activate too, without a tool menu.
  await f.get_by_role('button',name='Go fishing from the dock',exact=True).wait_for()
  pt=await f.evaluate("""()=>{const g=window.__hw,p=g.fishing.pole.position.clone();p.y+=.65;p.project(g.camera);const r=g.renderer.domElement.getBoundingClientRect();return {x:(p.x+1)*r.width/2+r.left,y:(1-p.y)*r.height/2+r.top};}""")
  await page.touchscreen.tap(frame['x']+pt['x'],frame['y']+pt['y'])
  await f.wait_for_function('window.__hw.fishing.firstPerson',timeout=20000)
  await f.get_by_role('button',name='Exit fishing and go back',exact=True).tap()
  await f.wait_for_function('!window.__hw.fishing.active&&!window.__hw.action')
  assert await f.evaluate('window.__hw.store.state.inventory.fish||0')==before+1
  assert not errors,errors
  print('PASS: nearby fishing prompt, low-energy feedback, touch rod, cast/reel catch, one reward/energy charge, mobile/iPad controls and exit',flush=True)
  await browser.close()
asyncio.run(main())
