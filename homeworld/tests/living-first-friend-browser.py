"""Final handoff regression from an earned tent, with a failed CMS request and failed Perry model."""
import asyncio,json,os,runpy,shutil
from pathlib import Path
from playwright.async_api import async_playwright
ns=runpy.run_path(str(Path(__file__).with_name('living-test-browser.py')))
BASE=os.environ.get('LIVING_ISLAND_TEST_URL','http://127.0.0.1:3000/').rstrip('/')
async def main():
 saved=json.loads(Path('/tmp/kids-polished-completed.json').read_text())
 for origin in saved['origins']:
  origin['localStorage']=[e for e in origin['localStorage'] if not e['name'].startswith('godlykids_rewards_v1:')]
  for e in origin['localStorage']:
   if e['name'].startswith('gk_living_first_friend_v1:'):
    friendkey=e['name'];receipt={'version':2,'phase':'pack','islandId':'genesis','storyId':ns['STORY']};e['value']=json.dumps(receipt)
   if e['name'].startswith('gk_living_island_requests_v2:'):
    s=json.loads(e['value']);s.update(stage=1,homeWork=0,adamUnlocked=False,adamArrived=False,welcomeSeen=False,inviteDismissed=True,gathered=['log-1','log-2','log-3'],deposits={'first-camp':3,'garden-carrots':0,'home-wood':0});e['value']=json.dumps(s)
   if e['name'].startswith('godlykids_homeworld_playtest_v1:'):
    s=json.loads(e['value']);s['buildings']=[b for b in s['buildings'] if b['id']=='living-test-camp'];e['value']=json.dumps(s)
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  ctx=await b.new_context(storage_state=saved,viewport={'width':390,'height':844},has_touch=True)
  page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  await page.route('**/models/mobile/perry-flight.glb*',lambda r:r.abort())
  fail=[True]
  async def api(route):
   if '/bible-map/islands/genesis' in route.request.url and fail[0]:
    fail[0]=False;await route.fulfill(status=503,body='Unavailable');return
   await ns['api'](route)
  await page.route('**/api/**',api)
  hub=BASE+'/#/sail/genesis/lesson/hub?storyId='+ns['STORY']+'&livingFirstFriend=1'
  await page.goto(hub);await page.get_by_role('button',name='Try again',exact=True).click()
  await page.get_by_role('button',name='Read story',exact=True).wait_for()
  assert await page.locator('.living-perry-portrait').inner_text()=='🦜'
  await page.screenshot(path='/tmp/tent-pack-final.png')
  print('PASS: failed CMS request offers retry; Perry fallback appears immediately and never blocks actions',flush=True)
  # The real reader is covered by living-test-browser.py. Resume its durable reward here.
  receipt['phase']='reward';await page.evaluate('(args)=>localStorage.setItem(args[0],JSON.stringify(args[1]))',[friendkey,receipt]);await page.reload()
  await page.get_by_role('button',name='Collect Adam',exact=True).click()
  await page.wait_for_url('**/#/crew');await page.get_by_role('button',name='My community',exact=True).click()
  await page.wait_for_url('**/#/my-home');await page.wait_for_selector('iframe');frame=page.frames[-1]
  await frame.wait_for_function('window.__hw?.loaded',timeout=90000);await ns['quality'](frame)
  assert await frame.evaluate('window.__hw.livingTest.placingAdam&&!window.__hw.community.actors.adam.actor.visible')
  await page.wait_for_timeout(2000);await page.screenshot(path='/tmp/tent-placement-final.png')
  await frame.get_by_role('button',name='Place Adam here',exact=True).click()
  await frame.wait_for_function('window.__hw.livingTest.state.adamUnlocked',timeout=60000)
  assert await frame.evaluate('Math.hypot(window.__hw.community.actors.adam.actor.position.x-window.__hw.player.x,window.__hw.community.actors.adam.actor.position.z+window.__hw.player.y)>1')
  assert await frame.evaluate('window.__hw.livingTest.reservedFriends().includes("adam")')
  assert await frame.evaluate('Math.hypot(window.__hw.community.actors.adam.model.position.x,window.__hw.community.actors.adam.model.position.z)<3')
  await page.wait_for_timeout(2000);await page.screenshot(path='/tmp/tent-welcome-final.png')
  await frame.get_by_role('button',name='Welcome, Adam!',exact=True).click()
  await frame.get_by_role('button',name='Back to ship',exact=True).click()
  await page.wait_for_url('**/#/crew');await page.wait_for_timeout(1000)
  assert await page.get_by_role('button',name='Chat with Adam',exact=True).count()==0
  assert await page.evaluate('(k)=>JSON.parse(localStorage[k]).phase',friendkey)=='placed'
  assert not errors,errors
  print('PASS: explicit reward, return ship, visible drop spot, separate Adam/player positions, welcome, and Adam remains ashore',flush=True)
  await b.close()
if __name__=='__main__':asyncio.run(main())
