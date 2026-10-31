"""Tap the actual child mesh, eat real bag/farm items, rest and reload on mobile/iPad."""
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
  async def load():
   await page.goto(BASE+'/#/my-home');await page.wait_for_selector('iframe[title="Players World"]');f=page.frames[-1]
   await f.wait_for_function('window.__hw?.loaded',timeout=90000);await ns['quality'](f)
   await f.evaluate("""()=>{const g=window.__hw,t=g.livingTest;if(t.placingAdam)t.placeAdam();g.dismissMorning();t.tasksOpen=false;t.state.welcomeSeen=true;t.state.inviteDismissed=true;t.save();t.stopWatching();g.notify();}""")
   return f
  f=await load()
  await f.evaluate("""()=>{const g=window.__hw,s=g.store.state;g.store.save({...s,clock:{...s.clock,paused:true},characters:{...s.characters,you:{...s.characters.you,energy:5,hunger:10,hungerAt:s.clock.minutes}},inventory:{...s.inventory,carrot:2,lettuce:1},livingFarm:{...s.livingFarm,bag:{egg:2,milk:1}}});g.notify();}""")
  async def tap_avatar():
   await f.evaluate('window.__hw.livingTest.lastInput=Date.now()')
   pt=await f.evaluate("""()=>{const g=window.__hw,p=g.actor.position.clone();p.y+=1.2;g.camera.updateMatrixWorld(true);p.project(g.camera);const r=g.renderer.domElement.getBoundingClientRect();return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};}""")
   box=await page.locator('iframe[title="Players World"]').bounding_box()
   await page.touchscreen.tap(box['x']+pt['x'],box['y']+pt['y'])
   await f.get_by_role('dialog',name='Food and energy').wait_for(timeout=10000)
  await tap_avatar()
  assert await f.get_by_role('progressbar',name='Energy',exact=True).get_attribute('value')=='5'
  for w,h in [(390,844),(768,1024)]:
   await page.set_viewport_size({'width':w,'height':h});await page.wait_for_timeout(300)
   box=await f.get_by_role('dialog',name='Food and energy').bounding_box();assert box['height']<=h*.5 and box['x']>=0 and box['x']+box['width']<=w+1,box
   await page.screenshot(path=f'/tmp/player-care-{w}.png')
  await page.set_viewport_size({'width':390,'height':844});await page.wait_for_timeout(300)
  await f.get_by_role('button',name='Eat carrot',exact=True).click()
  await f.wait_for_function('window.__hw.store.state.inventory.carrot===1',timeout=15000)
  assert await f.evaluate('window.__hw.store.state.characters.you.energy')==25
  await tap_avatar();await f.get_by_role('button',name='Eat egg from farm',exact=True).click()
  await f.wait_for_function('window.__hw.store.state.livingFarm.bag.egg===1',timeout=15000)
  assert await f.evaluate('window.__hw.store.state.characters.you.energy')==45
  await f.evaluate("""()=>{const g=window.__hw,s=g.store.state;g.store.save({...s,characters:{...s.characters,you:{...s.characters.you,energy:0}},inventory:{},livingFarm:{...s.livingFarm,bag:{egg:0,milk:0}}});g.notify();}""")
  await tap_avatar();await f.get_by_role('button',name='🌿 Take a breather',exact=True).click()
  print('REST START',await f.evaluate('({action:window.__hw.action,energy:window.__hw.store.state.characters.you.energy})'),flush=True)
  try:await f.wait_for_function('window.__hw.store.state.characters.you.energy===20',timeout=60000)
  except Exception:
   print('REST FAILED',await f.evaluate('({action:window.__hw.action,energy:window.__hw.store.state.characters.you.energy,night:window.__hw.store.state.night,status:window.__hw.status})'),flush=True);raise
  before=await f.evaluate('window.__hw.store.state.characters.you')
  await page.reload();f=await load();after=await f.evaluate('window.__hw.store.state.characters.you')
  assert after['energy']==before['energy'] and after['hunger']==before['hunger'],(before,after)
  assert not errors,errors
  print('PASS: real avatar touch, compact phone/iPad care menu, vegetable + farm feeding, free rest at zero energy, and saved needs on reload',flush=True)
  await browser.close()
asyncio.run(main())
