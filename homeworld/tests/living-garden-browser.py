"""Mobile first-run garden, insufficient funds, save failure and reload progression."""
import asyncio,os,runpy,shutil
from pathlib import Path
from playwright.async_api import async_playwright,expect
ns=runpy.run_path(str(Path(__file__).with_name('living-test-browser.py')))
BASE=os.environ.get('LIVING_ISLAND_TEST_URL','http://127.0.0.1:3000/').rstrip('/')
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(viewport={'width':390,'height':844},has_touch=True)
  page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.route('**/api/**',ns['api'])
  await page.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  await page.goto(BASE+'/#/my-home')
  await page.wait_for_selector('iframe[title="Players World"]');frame=page.frames[-1]
  async def loaded():
   await frame.wait_for_function('window.__hw?.loaded||window.__hw?.error',timeout=90000)
   assert await frame.evaluate('window.__hw.loaded'),await frame.evaluate('window.__hw.error')
   await ns['quality'](frame)
  await loaded()
  assert await frame.evaluate('window.__hw.livingTest.farm.state.coins')==0
  assert await frame.evaluate('Object.values(window.__hw.community.actors).every(h=>!h.actor.visible)')
  assert await frame.evaluate('Object.keys(window.__hw.store.state.cells).length')==0
  assert await frame.evaluate('window.__hw.livingTest.garden.plots.filter(p=>p.cropObject.visible).length')==3
  assert await frame.get_by_role('button',name='Choose my chicken · 10 coins',exact=True).count()==0
  await page.wait_for_timeout(2000)
  for width,height in [(390,844),(320,740),(844,390)]:
   await page.set_viewport_size({'width':width,'height':height})
   await page.wait_for_timeout(300)
   layout=await frame.evaluate("""()=>({overflow:document.documentElement.scrollWidth>innerWidth,covered:[...document.querySelectorAll('.living-guide,.living-round,.living-target,.living-pocket')].reduce((n,e)=>{const b=e.getBoundingClientRect();return n+b.width*b.height;},0)/(innerWidth*innerHeight),smallTargets:[...document.querySelectorAll('button')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&(b.width<44||b.height<44);}).map(e=>e.getAttribute('aria-label'))})""")
   assert not layout['overflow'] and layout['covered']<.15,layout
   assert not layout['smallTargets'],layout
   await page.screenshot(path=f'/tmp/action-ui-{width}.png')
  await page.set_viewport_size({'width':390,'height':844})
  await frame.evaluate("()=>{window.spokenTask='';speechSynthesis.speak=words=>{window.spokenTask=words.text;};}")
  await frame.get_by_role('button',name='Hear this task',exact=True).click()
  assert 'garden' in await frame.evaluate('window.spokenTask')
  print('PASS: compact controls cover under 15% on portrait and landscape phones; 44px targets and correct spoken garden prompt',flush=True)
  await page.screenshot(path='/tmp/garden-first-task.png')
  await frame.get_by_role('button',name='Make my garden bigger',exact=True).click()
  await frame.get_by_role('button',name='Not now',exact=True).click()
  assert not await frame.evaluate('window.__hw.livingTest.farm.state.garden.approved')
  await frame.get_by_role('button',name='Make my garden bigger',exact=True).click()
  await page.screenshot(path='/tmp/action-ui-confirmation.png')
  await frame.get_by_role('button',name='Yes, let’s grow!',exact=True).click()
  await frame.get_by_role('button',name='Go to the garden spot',exact=True).click()
  try:await frame.wait_for_function('window.__hw.livingTest.farm.state.garden.dug===1',timeout=90000)
  except Exception:
   print('DIG DEBUG',await frame.evaluate('({p:window.__hw.player,path:window.__hw.path,work:window.__hw.livingTest.garden.work,dialog:window.__hw.livingTest.dialogOpen,garden:window.__hw.livingTest.garden.snapshot()})'),flush=True)
   raise
  print('PASS: solo start, three vegetable types, free confirmation and walking to dig',flush=True)
  await frame.goto(frame.url);await loaded()
  assert await frame.evaluate('window.__hw.livingTest.farm.state.garden.dug')==1
  await ns['finish_garden'](frame)
  assert await frame.evaluate('window.__hw.livingTest.farm.state.coins')==10
  await page.screenshot(path='/tmp/garden-earned-coins.png')
  await frame.goto(frame.url);await loaded()
  assert await frame.evaluate('window.__hw.livingTest.farm.state.coins')==10
  assert await frame.evaluate('window.__hw.livingTest.garden.plots.filter(p=>p.cropObject.visible).length')==6
  print('PASS: all six garden actions, partial reload, 10-coin reward paid once, six planted spots',flush=True)
  await frame.get_by_role('button',name='Keep exploring',exact=True).click()
  assert await frame.get_by_role('button',name='Find a log',exact=True).count()==1
  await frame.get_by_role('button',name='Find a log',exact=True).click()
  await frame.wait_for_function('window.__hw.livingTest.state.gathered.length>0',timeout=90000)
  print('PASS: camp task progresses with no chicken purchased',flush=True)
  # Reproduce an old, stranded wallet. The app purse is deliberately different.
  await frame.evaluate('''()=>{const f=window.__hw.livingTest.farm;f.commit({...f.state,coins:3,chickenDismissed:false});window.__hw.coins=500;}''')
  await expect(frame.locator('.living-farm .living-coins b')).to_have_text('3')
  assert await frame.get_by_role('button',name='Choose my chicken · 10 coins',exact=True).count()==0
  await frame.get_by_role('button',name='Open my farm',exact=True).click()
  assert await frame.get_by_role('button',name='Buy a chicken',exact=False).is_disabled()
  await frame.get_by_role('button',name='Back to island',exact=True).click()
  # The ordinary tap-and-walk harvest loop recovers enough money to buy an animal.
  for i in range(4):
   await frame.get_by_role('button',name='Pick vegetables · +2 coins',exact=True).click(timeout=60000)
   await frame.wait_for_function('(n)=>window.__hw.livingTest.farm.state.coins===n',arg=5+i*2,timeout=90000)
  assert await frame.evaluate('window.__hw.livingTest.farm.state.coins')==11
  await frame.get_by_role('button',name='Choose my chicken · 10 coins',exact=True).click()
  await frame.get_by_role('textbox',name='Animal’s name').fill('<>')
  assert await frame.get_by_role('button',name='Buy <> · 10 coins',exact=True).is_disabled()
  await frame.get_by_role('textbox',name='Animal’s name').fill('Sunny')
  await page.screenshot(path='/tmp/action-ui-purchase.png')
  # A failed save must leave both the wallet and animal ownership untouched, with retry available.
  await frame.evaluate('''()=>{window.originalGardenSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('gk_living_farm_v1'))throw Error('Test storage full');return window.originalGardenSet.call(this,k,v);};}''')
  await frame.get_by_role('button',name='Buy Sunny · 10 coins',exact=True).click()
  assert 'couldn’t save' in await frame.get_by_role('alert').inner_text()
  assert await frame.evaluate('window.__hw.livingTest.farm.state.coins')==11
  assert await frame.evaluate('window.__hw.livingTest.farm.state.animals.length')==0
  await frame.evaluate('()=>{Storage.prototype.setItem=window.originalGardenSet;}')
  await frame.get_by_role('button',name='Buy Sunny · 10 coins',exact=True).click()
  assert await frame.evaluate('window.__hw.livingTest.farm.state.coins')==1
  await frame.wait_for_function('window.__hw.animals.instances.get("living-farm-1")?.root',timeout=30000)
  await frame.goto(frame.url);await loaded()
  assert await frame.evaluate('window.__hw.livingTest.farm.state.coins')==1
  assert await frame.evaluate('window.__hw.livingTest.farm.state.animals[0].name')=='Sunny'
  print('PASS: saved low balance displayed correctly, vegetables fund chicken, save failure retries, exact debit survives reload',flush=True)
  await page.set_viewport_size({'width':320,'height':740})
  await page.screenshot(path='/tmp/garden-small-phone.png')
  assert await frame.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors
  await ctx.storage_state(path='/tmp/garden-tested.json')
  await browser.close()
if __name__=='__main__':asyncio.run(main())
