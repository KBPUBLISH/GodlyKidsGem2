"""Original tool/build controls plus the shared Market wallet; run garden regression first."""
import asyncio,json,os,runpy,shutil,re
from pathlib import Path
from playwright.async_api import async_playwright
ns=runpy.run_path(str(Path(__file__).with_name('living-test-browser.py')))
BASE=os.environ.get('LIVING_ISLAND_TEST_URL','http://127.0.0.1:3000/').rstrip('/')
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(storage_state='/tmp/garden-tested.json',viewport={'width':430,'height':932})
  page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.route('**/api/**',ns['api']);await page.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  await page.route('https://cdn.tailwindcss.com/**',lambda r:r.fulfill(content_type='application/javascript',body='window.tailwind={config:{}}'))
  await page.goto(BASE+'/#/my-home')
  await page.wait_for_selector('iframe[title="Players World"]');frame=page.frames[-1]
  async def loaded():
   await frame.wait_for_function('window.__hw?.loaded',timeout=90000);await ns['quality'](frame)
   if await frame.get_by_role('button',name='OK',exact=True).count():await frame.get_by_role('button',name='OK',exact=True).click()
  await loaded()
  await frame.get_by_role('button',name='Open Market',exact=True).click()
  assert await frame.get_by_role('button',name='Buy 3 carrot seeds · 2 coins',exact=True).is_disabled()
  await frame.get_by_role('button',name='Pick vegetables · +2 coins',exact=True).click()
  await frame.wait_for_function('window.__hw.livingTest.farm.state.coins===3',timeout=90000)
  before=await frame.evaluate('window.__hw.store.state.inventory.carrot_seed')
  await frame.get_by_role('button',name='Open Market',exact=True).click()
  await frame.get_by_role('button',name='Buy 3 carrot seeds · 2 coins',exact=True).click()
  assert await frame.evaluate('window.__hw.livingTest.farm.state.coins')==1
  assert await frame.evaluate('window.__hw.store.state.inventory.carrot_seed')==before+3
  await frame.get_by_role('button',name='Back to island',exact=True).click()
  await frame.goto(frame.url);await loaded()
  assert await frame.evaluate('window.__hw.livingTest.farm.state.coins')==1
  assert await frame.evaluate('window.__hw.store.state.inventory.carrot_seed')==before+3
  async def chop():
   await frame.get_by_role('button',name='Open build',exact=True).click();await frame.get_by_role('tab',name='Actions',exact=True).click()
   await frame.get_by_role('button',name='Chop a tree',exact=True).click()
   await frame.wait_for_function('window.__hw.action?.type==="chop"',timeout=90000)
   await frame.wait_for_function('!window.__hw.action',timeout=60000)
  await chop();print('Chopped',await frame.evaluate('window.__hw.store.state.inventory'),flush=True)
  await frame.get_by_role('button',name='Open Market',exact=True).click();await frame.get_by_role('tab',name='Sell',exact=True).click()
  await frame.get_by_role('button',name=re.compile(r'Sell one .* wood for 1 coins')).first.click()
  assert await frame.evaluate('window.__hw.livingTest.farm.state.coins')==2
  await page.screenshot(path='/tmp/restored-market-sell.png')
  await frame.get_by_role('button',name='Back to island',exact=True).click()
  await chop();print('Chopped',await frame.evaluate('window.__hw.store.state.inventory'),flush=True)
  await ctx.storage_state(path='/tmp/original-world-supplies.json')
  await frame.get_by_role('button',name='Open build',exact=True).click();await frame.get_by_role('button',name='Gardens',exact=True).click()
  await frame.locator('.build-card').filter(has_text='Garden Bed').locator('.place-now').click()
  await frame.get_by_role('button',name='Find clear grass',exact=True).click()
  await frame.get_by_role('button',name='✓ Place',exact=True).click()
  await frame.wait_for_function('window.__hw.store.state.buildings.some(b=>b.kind==="garden"&&b.status==="complete")',timeout=90000)
  assert await frame.evaluate('Object.keys(window.__hw.store.state.cells).length')>=4
  await frame.get_by_role('button',name='Open build',exact=True).click();await frame.get_by_role('tab',name='Farm',exact=True).click()
  await frame.get_by_role('button',name='Plant',exact=True).click()
  await frame.get_by_role('button',name='Open build',exact=True).click();await frame.get_by_role('tab',name='Farm',exact=True).click()
  await frame.get_by_role('button',name='Plant carrot',exact=True).click()
  await frame.wait_for_function('Object.values(window.__hw.store.state.cells).some(c=>c.seed)',timeout=90000)
  await page.screenshot(path='/tmp/restored-built-garden.png')
  print('PASS: original build and planting actions',flush=True)
  await frame.get_by_role('button',name='Day and time',exact=False).click()
  await frame.get_by_text('Grown-up test tools',exact=True).click();await frame.get_by_role('button',name='Preview bedtime',exact=True).click()
  await frame.wait_for_function('!!window.__hw.store.state.night',timeout=10000)
  await frame.wait_for_function('!window.__hw.store.state.night',timeout=20000)
  assert await frame.evaluate('Object.values(window.__hw.community.actors).every(h=>!h.actor.visible)')
  assert not errors,errors
  print('PASS: Market buy/sell/reload, original chop animation, Build placement/construction, planting, night/morning and solo control',flush=True)
  await browser.close()
if __name__=='__main__':asyncio.run(main())
