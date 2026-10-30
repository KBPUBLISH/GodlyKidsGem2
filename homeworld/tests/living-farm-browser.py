"""Farm economy and social checks using a completed-island fixture from the full walkthrough.
Set FARM_TEST_SAVE to a Playwright storage_state export from that walkthrough.
Only the disposable browser's wall clock is advanced to exercise repeat production.
"""
from pathlib import Path
exec(Path(__file__).with_name('living-test-browser.py').read_text().split('async def main():')[0])

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(storage_state=os.environ.get('FARM_TEST_SAVE','/tmp/kids-polished-completed.json'),viewport={'width':430,'height':932})
  # Keep the earned island/story progress; exercise a fresh farm alongside it.
  await ctx.add_init_script('for(const k of Object.keys(localStorage))if(k.startsWith("gk_living_farm_v1:"))localStorage.setItem(k,JSON.stringify({version:1,coins:10,coop:0,animals:[],bag:{egg:0,milk:0},collected:0,nextId:1}));')
  page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.route('**/api/**',api)
  await page.route('https://cdn.tailwindcss.com/**',lambda r:r.fulfill(content_type='application/javascript',body='window.tailwind={config:{}}'))
  await page.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  await page.goto('http://127.0.0.1:3000/#/my-home?livingTest=1');await page.add_style_tag(path='/tmp/godlykids-current.css')
  await page.wait_for_selector('iframe[title="Players World"]');frame=page.frames[-1]
  await frame.goto(frame.url+'&player=Sarah')
  await frame.wait_for_function('window.__hw?.loaded',timeout=90000);await quality(frame)
  await frame.evaluate('''()=>{window.farmTestOffset=0;const realNow=Date.now;Date.now=()=>realNow()+window.farmTestOffset;}''')
  async def state():return await frame.evaluate('window.__hw.livingTest.farm.state')
  async def close():await frame.get_by_role('button',name='Back to island',exact=True).click()
  async def collect_due():
   await frame.evaluate('window.farmTestOffset+=540001;window.__hw.livingTest.activity()')
   await frame.wait_for_function('window.__hw.livingTest.farm.state.animals.some(a=>a.ready>0)||window.__hw.livingTest.farm.state.bag.egg>0',timeout=10000)
   await frame.get_by_role('button',name='Open my farm',exact=True).click()
   rows=frame.locator('.farm-animal')
   for i in range(await rows.count()):
    if await rows.nth(i).get_by_role('button',name='Collect',exact=True).count():
     await rows.nth(i).get_by_role('button',name='Collect',exact=True).click()
     try:await frame.wait_for_function('window.__hw.livingTest.farm.state.animals.every(a=>a.ready===0)',timeout=90000)
     except Exception:
      print('COLLECT DEBUG',await frame.evaluate('({p:window.__hw.player,path:window.__hw.path,watch:window.__hw.livingTest.watching,dialog:window.__hw.livingTest.dialogOpen,spots:window.__hw.livingTest.layout.farmSpots,farm:window.__hw.livingTest.farm.state})'),flush=True)
      raise
     return
   await close()
  await frame.get_by_role('button',name='Choose my chicken · 10 coins',exact=True).click()
  await frame.get_by_role('textbox',name='Animal’s name').fill('Sunny')
  await page.screenshot(path='/tmp/farm-chicken-confirmation.png')
  await frame.get_by_role('button',name='Not now',exact=True).click();assert (await state())['coins']==10
  await frame.get_by_role('button',name='Open my farm',exact=True).click()
  await frame.get_by_role('button',name='Buy a chicken',exact=False).click()
  await frame.get_by_role('textbox',name='Animal’s name').fill('Sunny')
  await frame.get_by_role('button',name='Buy Sunny · 10 coins',exact=True).click()
  await frame.wait_for_function('window.__hw.animals.instances.get("living-farm-1")?.root',timeout=30000)
  assert (await state())['coins']==0
  await collect_due();await frame.get_by_role('button',name='Open my bag',exact=True).click()
  n=(await state())['bag']['egg'];await frame.get_by_role('button',name='Eat 1 egg',exact=True).click();assert (await state())['bag']['egg']==n-1
  while (await state())['bag']['egg']>0:await frame.get_by_role('button',name='Sell 1 · +5 coins',exact=True).click()
  await close();assert (await state())['coins']==10
  print('PASS: named purchase, cancel, real GLB, walk-to-collect, eat and sell',flush=True)
  for _ in range(4):
   await collect_due();await frame.get_by_role('button',name='Open my bag',exact=True).click()
   while (await state())['bag']['egg']>0:await frame.get_by_role('button',name='Sell 1 · +5 coins',exact=True).click()
   await close()
  assert (await state())['coins']==70
  await frame.get_by_role('button',name='Open my farm',exact=True).click()
  await frame.get_by_role('button',name='Build a coop',exact=False).click()
  await frame.get_by_role('button',name='Not now',exact=True).click();assert (await state())['coins']==70
  await frame.get_by_role('button',name='Open my farm',exact=True).click();await frame.get_by_role('button',name='Build a coop',exact=False).click()
  await frame.get_by_role('button',name='Build this coop · 20 coins',exact=True).click();assert (await state())['coop']==1
  await frame.get_by_role('button',name='Open my farm',exact=True).click();await frame.get_by_role('button',name='Buy a cow',exact=False).click()
  await frame.get_by_role('textbox',name='Animal’s name').fill('Daisy');await frame.get_by_role('button',name='Buy Daisy · 40 coins',exact=True).click()
  await frame.wait_for_function('window.__hw.animals.instances.get("living-farm-2")?.root',timeout=30000)
  await frame.evaluate('window.farmTestOffset+=180001;window.__hw.livingTest.activity()')
  await frame.wait_for_function('window.__hw.livingTest.farm.state.animals[1].ready>0',timeout=10000)
  await frame.get_by_role('button',name='Open my farm',exact=True).click();await frame.locator('.farm-animal').filter(has_text='Daisy').get_by_role('button',name='Collect').click()
  await frame.wait_for_function('window.__hw.livingTest.farm.state.bag.milk>0',timeout=90000)
  await frame.get_by_role('button',name='Open my bag',exact=True).click();await frame.get_by_role('button',name='Drink 1 milk').click();await close()
  print('PASS: egg earnings fund a confirmed coop and named cow; milk is collected and drunk',flush=True)
  await ctx.storage_state(path='/tmp/farm-social-checkpoint.json')
  await frame.get_by_role('button',name='Friends',exact=True).click();await frame.get_by_role('button',name='Adam Say hello',exact=False).click()
  await frame.wait_for_function('window.__hw.livingTest.greetTarget===null&&window.__hw.livingTest.greeting?.text.includes("Sarah")&&window.__hw.livingTest.greeting.until>window.__hw.livingTest.elapsed',timeout=90000)
  assert await frame.evaluate('window.__hw.store.state.activeCharacter')=='you'
  await page.screenshot(path='/tmp/farm-adam-greeting.png')
  await frame.get_by_role('button',name='Friends',exact=True).click();await frame.get_by_role('button',name='Watch island life',exact=True).click()
  pos=await frame.evaluate('({...window.__hw.player})')
  await frame.wait_for_function('window.__hw.livingTest.watchIndex>=1',timeout=30000)
  assert await frame.evaluate('({...window.__hw.player})')==pos
  await frame.get_by_role('button',name='Back to me',exact=True).click()
  await frame.evaluate('window.__hw.livingTest.lastInput=Date.now()-31000')
  await frame.wait_for_function('window.__hw.livingTest.watching',timeout=10000)
  await frame.get_by_role('button',name='Back to me',exact=True).click()
  await frame.get_by_role('button',name='Open my farm',exact=True).click();await page.screenshot(path='/tmp/farm-owned-animals.png')
  saved=await ctx.storage_state(path='/tmp/living-farm-tested.json');expected=await state();island_url=frame.url
  await ctx.close()
  again=await browser.new_context(storage_state=saved,viewport={'width':430,'height':932});reload=await again.new_page()
  await reload.goto(island_url);await reload.wait_for_function('window.__hw?.loaded',timeout=90000);await quality(reload)
  actual=await reload.evaluate('window.__hw.livingTest.farm.state')
  assert actual['coins']==expected['coins'] and actual['coop']==expected['coop']
  assert [(a['kind'],a['name']) for a in actual['animals']]==[(a['kind'],a['name']) for a in expected['animals']]
  print('PASS: animal names, purchases, coop and wallet survive a new browser context',flush=True)
  assert not errors,errors
  print('PASS: Sarah greeting, manual and automatic camera rotation, fixed player identity and position; no JS errors',flush=True)
  await browser.close()

asyncio.run(main())
