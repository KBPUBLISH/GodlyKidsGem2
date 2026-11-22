"""Last real action of each starter milestone → Perry → tent → selected ship avatar → original pack."""
import asyncio,json,os,runpy,shutil
from pathlib import Path
from playwright.async_api import async_playwright
ns=runpy.run_path(str(Path(__file__).with_name('living-test-browser.py')))
BASE=os.environ.get('LIVING_ISLAND_TEST_URL','http://127.0.0.1:3000').rstrip('/')
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce')
  await ctx.add_init_script("""if(!localStorage.getItem('godly_kids_data_v6'))localStorage.setItem('godly_kids_data_v6',JSON.stringify({kids:[{id:'mikey-guide',name:'Mikey',age:8,worldAvatarId:'berry',avatarSeed:'/avatars/adventurers/berry.png',avatar:'/avatars/adventurers/berry.png',coins:500,coinTransactions:[],ownedItems:['f1','anim1'],unlockedVoices:[]}],currentProfileId:'mikey-guide',parentName:'Parent',coins:500,ownedItems:['f1','anim1'],coinTransactions:[],unlockedVoices:[]}));""")
  page=await ctx.new_page();errors=[];voices=[];page.on('pageerror',lambda e:errors.append(str(e)))
  async def api(route):
   if '/tts/generate' in route.request.url and route.request.method=='POST':voices.append(route.request.post_data_json)
   await ns['api'](route)
  await ctx.route('**/api/**',api);await ctx.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  # Perry model failure must not block coaching or the ship invitation.
  await ctx.route('**/models/mobile/perry-flight.glb*',lambda r:r.abort())
  await page.goto(BASE+'/#/my-home',wait_until='domcontentloaded');await page.wait_for_selector('iframe');frame=page.frames[-1]
  await frame.wait_for_function('window.__hw?.loaded',timeout=90000);await ns['quality'](frame)
  await frame.get_by_role('button',name='Back to island',exact=True).click()
  await frame.evaluate("""()=>{const f=window.__hw.livingTest.farm;f.commit({...f.state,garden:{...f.state.garden,planted:3,plantedSpots:[0,3,4]}});} """)
  await frame.get_by_role('button',name='Plant a carrot seed',exact=True).click()
  await page.get_by_text('Seeds planted! Now water.',exact=True).wait_for(timeout=90000)
  await page.screenshot(path='/tmp/perry-planted.png')
  assert not await page.get_by_role('button',name='Find a friend',exact=True).count()
  await page.get_by_role('button',name='Water seeds',exact=True).click()
  await frame.wait_for_function('window.__hw.livingTest.farm.state.garden.wateredAt[0]!==null',timeout=90000)
  await frame.evaluate("""()=>{const f=window.__hw.livingTest.farm,g=f.state.garden,wateredAt=[...g.wateredAt],readyAt=[...g.readyAt];for(const i of [3,4]){wateredAt[i]=Date.now();readyAt[i]=Date.now()+180000;}f.commit({...f.state,garden:{...g,wateredAt,readyAt}});} """)
  await frame.get_by_role('button',name='Water carrot',exact=True).click()
  await page.get_by_text('Great watering! Time to pick.',exact=True).wait_for(timeout=90000)
  await page.get_by_role('button',name='Check garden',exact=True).click()
  await frame.wait_for_function('window.__hw.livingTest.farm.state.garden.picked.pumpkin===1',timeout=90000)
  await ns['ripen_watered_garden'](frame)
  while not await frame.evaluate('window.__hw.livingTest.farm.state.garden.completed'):
   before=await frame.evaluate('Object.values(window.__hw.livingTest.farm.state.garden.picked).reduce((a,b)=>a+b,0)')
   label=await frame.evaluate('window.__hw.livingTest.garden.snapshot().label')
   await frame.get_by_role('button',name=label,exact=True).click()
   await frame.wait_for_function('(n)=>Object.values(window.__hw.livingTest.farm.state.garden.picked).reduce((a,b)=>a+b,0)>n',arg=before,timeout=90000)
  await page.get_by_text('You grew it! Find 3 logs.',exact=True).wait_for()
  await page.get_by_role('button',name='Find logs',exact=True).click()
  await frame.wait_for_function('window.__hw.livingTest.state.inventory.wood>=1',timeout=90000)
  while await frame.evaluate('window.__hw.livingTest.state.inventory.wood')<3:
   before=await frame.evaluate('window.__hw.livingTest.state.inventory.wood')
   await frame.get_by_role('button',name='Find a log',exact=True).click()
   await frame.wait_for_function('(n)=>window.__hw.livingTest.state.inventory.wood>n',arg=before,timeout=90000)
  await page.get_by_text('Wood collected! Build a tent.',exact=True).wait_for()
  await page.get_by_role('button',name='Build a tent',exact=True).click()
  await frame.get_by_role('button',name='Build prayer tent',exact=True).click(timeout=90000)
  await page.get_by_text('A home for your first friend!',exact=True).wait_for(timeout=90000)
  assert await frame.evaluate('window.__hw.store.state.buildings.some(b=>b.id==="living-test-camp"&&b.status==="complete")')
  await page.screenshot(path='/tmp/perry-tent.png')
  assert page.url.endswith('/#/my-home')
  await page.get_by_role('button',name='Find a friend',exact=True).click()
  await page.wait_for_url('**/#/crew')
  await page.get_by_text('Welcome aboard, Mikey!',exact=True).wait_for()
  await page.wait_for_selector('[data-testid="crew-deck-3d"][data-player-avatar="berry"] canvas')
  for w,h in [(390,844),(768,1024)]:
   await page.set_viewport_size({'width':w,'height':h});await page.wait_for_timeout(500)
   box=await page.locator('[data-testid="crew-deck-3d"]').bounding_box()
   assert box['x']>=0 and box['x']+box['width']<=w and box['y']>=0 and box['y']+box['height']<=h,box
   await page.screenshot(path=f'/tmp/perry-ship-{w}-{h}.png')
  await page.get_by_role('button',name='Show me!',exact=True).click()
  await page.get_by_text('Tap Genesis!',exact=True).wait_for()
  assert await page.locator('.living-island-point').count()==1
  assert any('Mikey' in v['text'] and 'four seeds' in v['text'] for v in voices),voices
  assert any('somewhere for a friend to stay' in v['text'] for v in voices),voices
  assert all(v['voiceId']=='MF3mGyEYCl7XYWbV9V6O' for v in voices),voices
  await page.get_by_role('button',name='Sail to Genesis',exact=True).click()
  await page.wait_for_url('**/#/sail/genesis/lesson?storyId=*',timeout=30000)
  await page.get_by_role('button',name='Read story',exact=False).wait_for(timeout=30000)
  assert not errors,errors
  print('PASS: named milestone praise and next actions; tent before invitation; slow Perry fallback; selected avatar on ship; two-beat ship guide; original story pack',flush=True)
  await browser.close()
asyncio.run(main())
