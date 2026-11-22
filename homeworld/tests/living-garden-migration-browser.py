"""An earlier farm and a worked garden must keep progress when the new intro ships."""
import asyncio,json,os,runpy,shutil
from pathlib import Path
from playwright.async_api import async_playwright
ns=runpy.run_path(str(Path(__file__).with_name('living-test-browser.py')))
BASE=os.environ.get('LIVING_ISLAND_TEST_URL','http://127.0.0.1:3000/').rstrip('/')
async def main():
 saved=json.loads(Path('/tmp/kids-polished-completed.json').read_text())
 for origin in saved['origins']:
  for entry in origin['localStorage']:
   if entry['name'].startswith('gk_living_farm_v1:'):
    s=json.loads(entry['value']);s.pop('garden',None);s.pop('chickenDismissed',None);entry['value']=json.dumps(s);expected_farm=s
   if entry['name'].startswith('godlykids_homeworld_playtest_v1:'):
    s=json.loads(entry['value']);s.pop('livingGardenLayout',None);s['stats']['plowed']=1;s['cells']['58:52']={'soil':'tilled','emptySince':s['clock']['minutes']};entry['value']=json.dumps(s)
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  ctx=await b.new_context(storage_state=saved,viewport={'width':390,'height':844})
  page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.route('**/api/**',ns['api'])
  await page.goto(BASE+'/#/my-home');await page.wait_for_selector('iframe');frame=page.frames[-1]
  await frame.wait_for_function('window.__hw?.loaded',timeout=90000);await ns['quality'](frame)
  assert await frame.evaluate('window.__hw.store.state.cells["58:52"].soil')=='tilled'
  assert await frame.evaluate('window.__hw.livingTest.state.homeWork')==1
  assert await frame.evaluate('window.__hw.livingTest.farm.state.garden.completed')
  assert not await frame.evaluate('window.__hw.livingTest.garden.small')
  assert await frame.evaluate('window.__hw.livingTest.farm.state.coins')==expected_farm['coins']
  assert await frame.evaluate('window.__hw.livingTest.farm.state.animals.map(a=>a.name)')==[a['name'] for a in expected_farm['animals']]
  await frame.evaluate('window.__hw.livingTest.garden.go(0)')
  assert not await frame.evaluate('window.__hw.livingTest.garden.work')
  assert await frame.get_by_role('button',name='Make my garden bigger',exact=True).count()==0
  print('PASS: legacy wallet, named animals, completed home and worked garden preserved; no repeated introduction',flush=True)
  await ctx.close()
  fresh=await b.new_context(viewport={'width':320,'height':740},has_touch=True)
  page=await fresh.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  await page.route('**/api/**',ns['api']);await page.goto(BASE+'/#/my-home');await page.wait_for_selector('iframe');frame=page.frames[-1]
  await frame.wait_for_function('window.__hw?.loaded',timeout=90000);await ns['quality'](frame)
  await frame.get_by_role('button',name='Plant 4 carrot seeds. 0 of 4',exact=True).click()
  await frame.wait_for_function('window.__hw.livingTest.farm.state.garden.planted===1',timeout=90000)
  assert await frame.evaluate('window.__hw.livingTest.farm.state.coins')==0
  assert await frame.evaluate('document.documentElement.scrollWidth<=innerWidth')
  await page.screenshot(path='/tmp/garden-small-phone.png')
  assert not errors,errors
  print('PASS: final build opens the free garden task on a 320px phone, and planting works',flush=True)
  await b.close()
if __name__=='__main__':asyncio.run(main())
