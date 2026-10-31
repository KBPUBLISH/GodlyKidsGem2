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
  voices=[]
  async def api(route):
   if route.request.url.endswith('/tts/generate') and route.request.method=='POST': voices.append(route.request.post_data_json)
   await ns['api'](route)
  await page.route('**/api/**',api)
  await page.route('https://cdn.tailwindcss.com/**',lambda r:r.fulfill(content_type='application/javascript',body='window.tailwind={config:{}}'))
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
  assert await frame.evaluate('window.__hw.livingTest.garden.plots.filter(p=>p.cropObject.visible).length')==2
  assert await frame.get_by_role('button',name='Choose my chicken · 10 coins',exact=True).count()==0
  await expect(frame.get_by_role('dialog',name='My first tasks')).to_be_visible()
  await expect(frame.get_by_role('button',name='Plant 4 carrot seeds. 0 of 4',exact=True)).to_be_enabled()
  await expect(frame.get_by_role('button',name='Pick 1 carrot, 1 pumpkin and 1 lettuce.',exact=False)).to_be_disabled()
  await expect(frame.get_by_role('button',name='Build a tent.',exact=False)).to_be_disabled()
  await page.screenshot(path='/tmp/starter-tasks.png')
  await frame.get_by_role('button',name='Hear my tasks',exact=True).click()
  await page.wait_for_timeout(500)
  assert any(v['voiceId']=='MF3mGyEYCl7XYWbV9V6O' and 'pumpkin' in v['text'] and 'lettuce' in v['text'] for v in voices),voices
  await frame.get_by_role('button',name='Back to island',exact=True).click()
  assert await frame.get_by_role('button',name='Tools',exact=True).count()==0
  assert await frame.get_by_role('button',name='Zoom in',exact=True).count()==0
  await page.wait_for_timeout(2000)
  for width,height in [(390,844),(320,740),(844,390)]:
   await page.set_viewport_size({'width':width,'height':height})
   await page.wait_for_timeout(300)
   layout=await frame.evaluate("""()=>({overflow:document.documentElement.scrollWidth>innerWidth,covered:[...document.querySelectorAll('.living-guide,.living-round,.living-target,.living-pocket')].reduce((n,e)=>{const b=e.getBoundingClientRect();return n+b.width*b.height;},0)/(innerWidth*innerHeight),smallTargets:[...document.querySelectorAll('button')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&(b.width<44||b.height<44);}).map(e=>e.getAttribute('aria-label'))})""")
   assert not layout['overflow'] and layout['covered']<.15,layout
   assert not [x for x in layout['smallTargets'] if x not in ['Sound is on. Turn music off','Sound is off. Turn music on']],layout
   assert await frame.locator('.living-guide').evaluate("e=>getComputedStyle(e).backgroundColor==='rgba(0, 0, 0, 0)'")
   rail=await frame.locator('.side-buttons>button').evaluate_all('es=>es.map(e=>{const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y};})')
   assert len({round(r['x']) for r in rail})==1 and all(rail[i]['y']<rail[i+1]['y'] for i in range(len(rail)-1)),rail
   await page.screenshot(path=f'/tmp/tent-ui-{width}.png')
  await page.set_viewport_size({'width':390,'height':844})
  await frame.get_by_role('button',name='Hear this task',exact=True).click()
  await page.wait_for_timeout(500)
  assert any(v['voiceId']=='MF3mGyEYCl7XYWbV9V6O' and 'carrot' in v['text'] for v in voices),voices
  print('PASS: original vertical controls, transparent garden prompt, Perry ElevenLabs voice request',flush=True)
  await page.screenshot(path='/tmp/garden-first-task.png')
  await frame.get_by_role('button',name='Plant carrot spot 6',exact=True).click()
  await frame.wait_for_function('window.__hw.livingTest.farm.state.garden.planted===1',timeout=90000)
  assert await frame.evaluate('window.__hw.livingTest.farm.state.garden.plantedSpots')==[5]
  await frame.goto(frame.url);await loaded()
  assert await frame.get_by_role('dialog',name='My first tasks').count()==0
  assert await frame.evaluate('window.__hw.livingTest.farm.state.garden.planted')==1
  await frame.get_by_role('button',name='Open Tasks',exact=True).click()
  await frame.get_by_role('button',name='Plant 4 carrot seeds. 1 of 4',exact=True).click()
  await frame.wait_for_function('window.__hw.livingTest.farm.state.garden.planted===2',timeout=90000)
  while await frame.evaluate('window.__hw.livingTest.farm.state.garden.planted')<4:
   before=await frame.evaluate('window.__hw.livingTest.farm.state.garden.planted')
   await frame.get_by_role('button',name='Plant a carrot seed',exact=True).click()
   await frame.wait_for_function('(n)=>window.__hw.livingTest.farm.state.garden.planted>n',arg=before,timeout=90000)
  assert await frame.evaluate('window.__hw.livingTest.farm.state.coins')==10
  assert await frame.get_by_role('button',name='Find a log',exact=True).count()==0
  assert await frame.evaluate('window.__hw.livingTest.resources.some(r=>r.object.visible)')
  assert await frame.evaluate('window.__hw.livingTest.garden.snapshot().phase')=='water'
  assert await frame.evaluate('window.__hw.livingTest.farm.state.garden.wateredAt[0]') is None
  await page.screenshot(path='/tmp/garden-needs-water.png')
  # Water is committed only after the full pouring action, never on tap or interruption.
  await frame.get_by_role('button',name='Water carrot in garden spot 1',exact=True).click()
  await frame.wait_for_function('window.__hw.livingTest.garden.work?.poseAudit?.phase==="pour"',timeout=90000)
  assert await frame.evaluate('window.__hw.tools.watering_can.visible')
  assert await frame.evaluate('window.__hw.livingTest.farm.state.garden.wateredAt[0]') is None
  await frame.evaluate('window.__hw.walk({...window.__hw.player})')
  assert await frame.evaluate('window.__hw.livingTest.farm.state.garden.wateredAt[0]') is None
  assert not await frame.evaluate('window.__hw.tools.watering_can.visible')
  await ns['water_starter'](frame)
  timers=await frame.evaluate('window.__hw.livingTest.farm.state.garden')
  assert all(timers['readyAt'][i]-timers['wateredAt'][i]==180000 for i in [0,3,4,5])
  await frame.goto(frame.url);await loaded()
  assert await frame.evaluate('window.__hw.livingTest.farm.state.garden.readyAt')==timers['readyAt']
  assert await frame.locator('.living-garden-timer').count()==4
  await page.screenshot(path='/tmp/garden-growing-timers.png')
  print('PASS: blue water cues, real pouring, cancellation, three-minute carrots and persistent growth timers',flush=True)
  for crop in ['pumpkin','lettuce','carrot']:
   if crop=='carrot':
    assert await frame.evaluate('window.__hw.livingTest.garden.snapshot().phase')=='wait'
    await frame.get_by_role('button',name='Find a log while vegetables grow',exact=True).click()
    await frame.wait_for_function('window.__hw.livingTest.state.gathered.length>0',timeout=90000)
    assert await frame.evaluate('window.__hw.livingTest.state.stage')==0
    await ns['ripen_watered_garden'](frame)
   await frame.get_by_role('button',name=f'Pick {crop} from garden spot',exact=False).first.click()
   await frame.wait_for_function('(crop)=>window.__hw.livingTest.farm.state.garden.picked[crop]===1',arg=crop,timeout=90000)
   if crop=='pumpkin':
    await frame.goto(frame.url);await loaded()
    await frame.get_by_role('button',name='Open Tasks',exact=True).click()
    await expect(frame.get_by_role('button',name='Pick 1 carrot, 1 pumpkin and 1 lettuce. 1 of 3',exact=True)).to_be_enabled()
    await expect(frame.get_by_role('button',name='Build a tent.',exact=False)).to_be_disabled()
    await frame.get_by_role('button',name='Back to island',exact=True).click()
  assert await frame.evaluate('window.__hw.livingTest.farm.state.coins')==16
  await frame.goto(frame.url);await loaded()
  assert await frame.evaluate('window.__hw.livingTest.farm.state.coins')==16
  assert await frame.evaluate('window.__hw.livingTest.garden.plots.filter(p=>p.cropObject.visible).length')==6
  await frame.get_by_role('button',name='Open Tasks',exact=True).click()
  await expect(frame.get_by_role('button',name='Plant 4 carrot seeds. 4 of 4. Done',exact=True)).to_be_disabled()
  await expect(frame.get_by_role('button',name='Pick 1 carrot, 1 pumpkin and 1 lettuce. 3 of 3. Done',exact=True)).to_be_disabled()
  await expect(frame.get_by_role('button',name='Build a tent. 0 of 1',exact=True)).to_be_enabled()
  await page.screenshot(path='/tmp/starter-tasks-picked.png')
  await frame.get_by_role('button',name='Back to island',exact=True).click()
  print('PASS: first-visit Tasks, four free seeds, each vegetable counted separately, saved progress and 16 coins paid once',flush=True)
  assert await frame.get_by_role('button',name='Find a log',exact=True).count()==1
  while await frame.evaluate('window.__hw.livingTest.state.gathered.length')<3:
   before=await frame.evaluate('window.__hw.livingTest.state.gathered.length')
   await frame.get_by_role('button',name='Find a log',exact=True).click()
   await frame.wait_for_function('(n)=>window.__hw.livingTest.state.gathered.length>n',arg=before,timeout=90000)
  await frame.get_by_role('button',name='Take logs to tent',exact=True).click()
  await frame.get_by_role('button',name='Build prayer tent',exact=True).click(timeout=90000)
  await frame.get_by_role('button',name='No, keep exploring',exact=True).click(timeout=90000)
  await frame.get_by_role('button',name='Open Tasks',exact=True).click()
  await expect(frame.get_by_role('button',name='Build a tent. 1 of 1. Done',exact=True)).to_be_disabled()
  await expect(frame.get_by_role('status').filter(has_text='All done!')).to_be_visible()
  await page.screenshot(path='/tmp/starter-tasks-complete.png')
  await frame.get_by_role('button',name='Back to island',exact=True).click()
  print('PASS: garden leads directly to prayer tent; first friend is optional',flush=True)
  # Reproduce an old, stranded wallet. The app purse is deliberately different.
  await frame.evaluate('''()=>{const f=window.__hw.livingTest.farm;f.commit({...f.state,coins:3,chickenDismissed:false});window.__hw.coins=500;}''')
  assert await frame.get_by_role('button',name='Choose my chicken · 10 coins',exact=True).count()==0
  await frame.get_by_role('button',name='Open Market',exact=True).click()
  assert await frame.get_by_role('button',name='Buy a chicken',exact=False).is_disabled()
  await frame.get_by_role('button',name='Back to island',exact=True).click()
  # The ordinary tap-and-walk harvest loop recovers enough money to buy an animal.
  for i in range(4):
   await ns['ensure_garden_harvest'](frame)
   await frame.get_by_role('button',name='Open Market',exact=True).click()
   await frame.get_by_role('button',name='Pick vegetables · +2 coins',exact=True).click(timeout=60000)
   await frame.wait_for_function('(n)=>window.__hw.livingTest.farm.state.coins===n',arg=5+i*2,timeout=90000)
  assert await frame.evaluate('window.__hw.livingTest.farm.state.coins')==11
  await frame.get_by_role('button',name='Open Market',exact=True).click()
  await frame.get_by_role('button',name='Buy a chicken',exact=False).click()
  await frame.get_by_role('textbox',name='Animal’s name').fill('<>')
  assert await frame.get_by_role('button',name='Buy <> · 10 coins',exact=True).is_disabled()
  await frame.get_by_role('textbox',name='Animal’s name').fill('Sunny')
  await page.screenshot(path='/tmp/action-ui-purchase.png')
  # A failed save must leave both the wallet and animal ownership untouched, with retry available.
  await frame.evaluate('''()=>{window.originalGardenSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('godlykids_homeworld_playtest_v1'))throw Error('Test storage full');return window.originalGardenSet.call(this,k,v);};}''')
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
