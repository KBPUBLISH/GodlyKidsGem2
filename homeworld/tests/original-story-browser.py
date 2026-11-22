"""Original scene → reader → quiz → Try It → treasure → ship → Adam placement, with CMS fixtures."""
import asyncio,json,sys,shutil,runpy,re,os
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ns=runpy.run_path(str(Path(__file__).with_name('living-test-browser.py')))
BASE=os.environ.get('LIVING_ISLAND_TEST_URL','http://127.0.0.1:3000/').rstrip('/')
BOOK,STORY=ns['BOOK'],ns['STORY'];PACK={**ns['PACK'],'quizMode':'custom','customQuestions':[{'question':'Who made the world?','options':['God','A chicken'],'correctIndex':0}],'tryIt':{'videoUrl':'/assets/fixture.mp4','prompts':[{'type':'statement','text':'Thank God for something you see.'}]},'sceneBgVideoUrl':'/assets/fixture.mp4','rewards':{'pool':[{'id':'cms-adam','type':'character','characterName':'Adam','title':'Adam','voiceId':'cms-adam-fixture','modelUrl':'/homeworld/assets/mobile/adam.glb?v=mobile-1','imageUrl':'/icons/higgsfield/friends.png'}]}}
voices=[]
async def api(route):
 if route.request.url.endswith('/tts/generate') and route.request.method=='POST': voices.append(route.request.post_data_json)
 path=urlparse(route.request.url).path
 if '/bible-map/islands/genesis' in path:body={'island':ns['ISLAND'],**ns['ISLAND'],'stories':[PACK]}
 elif path.endswith('/bible-map/stories'):body=[PACK]
 else:return await ns['api'](route)
 await route.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body=json.dumps(body))
def fresh():
 saved=json.loads(Path(os.environ.get('ORIGINAL_STORY_SAVE','/tmp/garden-tested.json')).read_text())
 for origin in saved['origins']:
  origin['localStorage']=[e for e in origin['localStorage'] if not any(e['name'].startswith(k) for k in ['godlykids_rewards_v1','godlykids_island_story_progress','gk_onboarding_journey','godlykids_reading_progress','godlykids_completed_books','godlykids_read_counts'])]
  for e in origin['localStorage']:
   if e['name'].startswith('gk_living_first_friend_v1:'):e['value']=json.dumps({'version':2,'phase':'ship'})
   if e['name'].startswith('gk_living_island_requests_v2:'):
    s=json.loads(e['value']);s.update(stage=1,homeWork=0,adamUnlocked=False,adamArrived=False,welcomeSeen=False,inviteDismissed=True,gathered=['log-1','log-2','log-3'],deposits={'first-camp':3,'garden-carrots':0,'home-wood':0});e['value']=json.dumps(s)
   if e['name'].startswith('godlykids_homeworld_playtest_v1:'):
    s=json.loads(e['value']);s['buildings']=[b for b in s['buildings'] if b['id']=='living-test-camp'];e['value']=json.dumps(s)
 return saved
async def main():
 if not Path('/tmp/try-it-fixture.mp4').exists():
  import subprocess
  subprocess.run(['ffmpeg','-loglevel','error','-f','lavfi','-i','color=c=green:s=160x240:d=1','-c:v','libx264','-pix_fmt','yuv420p','-y','/tmp/try-it-fixture.mp4'],check=True)
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  ctx=await b.new_context(storage_state='/tmp/original-story-after.json' if os.environ.get('RESUME_TREASURE') else fresh(),viewport={'width':430,'height':932},reduced_motion='reduce')
  page=await ctx.new_page();page.set_default_timeout(15000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.route('**/api/**',api)
  await page.route('**/assets/fixture.mp4',lambda r:r.fulfill(content_type='video/mp4',path='/tmp/try-it-fixture.mp4'))
  await page.route('https://cdn.tailwindcss.com/**',lambda r:r.fulfill(content_type='application/javascript',body='window.tailwind={config:{}}'))
  await page.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  async def dump(label):
   print(label,page.url,await page.locator('body').inner_text(),flush=True);await page.screenshot(path='/tmp/story-'+label+'.png')
  if not os.environ.get('RESUME_TREASURE'):
   await page.goto(BASE+'/#/crew')
   await page.get_by_role('button',name='Sail to Genesis',exact=True).click(timeout=30000)
   await page.wait_for_url('**/#/sail/genesis/lesson?storyId='+STORY,timeout=30000)
   await page.wait_for_timeout(3000);await dump('scene')
   await page.get_by_role('button',name=re.compile('READ STORY',re.I)).click();print('Read tapped',page.url,await page.locator('body').inner_text(),flush=True)
   await page.get_by_role('button',name=re.compile('^(Start|Continue)$')).click();print('Start tapped',flush=True)
   await page.get_by_role('button',name='6–7',exact=False).click();print('Age tapped',flush=True)
   await page.wait_for_timeout(3000)
   for i in range(2):
    await page.get_by_role('button',name='Next page',exact=True).click();print('Page turned',i,flush=True);await page.wait_for_timeout(1200)
   await page.wait_for_url('**/lesson/hub?**',timeout=20000);await dump('hub')
   await page.get_by_role('button',name='Continue',exact=True).click()
   await page.wait_for_url('**/lesson/quiz?**');await dump('quiz')
   await page.get_by_role('button',name='God',exact=False).click()
   await page.wait_for_timeout(6000);await dump('quizdone')
   await page.get_by_role('button',name='Try it!',exact=True).click()
   await page.get_by_role('button',name='Did it',exact=True).click(timeout=20000)
   await page.wait_for_timeout(1500);await dump('trydone')
  else:
   await page.goto(BASE+'/#/sail/genesis/lesson?storyId='+STORY)
  await ctx.storage_state(path='/tmp/original-story-after.json')
  await page.get_by_role('button',name=re.compile('REWARDS')).click()
  await page.wait_for_selector('iframe');treasure=page.frames[-1]
  await treasure.wait_for_selector('#sand');await page.wait_for_timeout(800)
  chest=await treasure.locator('#chest').bounding_box()
  for sweep in range(3):
   for row in range(6):
    await page.mouse.move(chest['x']-5,chest['y']+row*chest['height']/5)
    await page.mouse.down();await page.mouse.move(chest['x']+chest['width']+5,chest['y']+row*chest['height']/5,steps=12);await page.mouse.up()
    await page.wait_for_timeout(130)
   if 'open' in await treasure.locator('#chest').get_attribute('class'):break
  await treasure.get_by_role('button',name='Continue',exact=True).wait_for(timeout=10000)
  assert await treasure.locator('.rname',has_text='Adam').is_visible()
  assert await page.evaluate('Object.keys(localStorage).filter(k=>k.startsWith("gk_living_first_friend_v1:")).every(k=>JSON.parse(localStorage[k]).phase==="aboard")')
  await page.screenshot(path='/tmp/original-treasure.png')
  await treasure.get_by_role('button',name='Continue',exact=True).click()
  await page.wait_for_url('**/#/crew');await page.get_by_role('button',name='My community',exact=True).click()
  await page.wait_for_selector('iframe[title="Players World"]');frame=page.frames[-1]
  await frame.wait_for_function('window.__hw?.loaded',timeout=90000);await ns['quality'](frame)
  if await frame.get_by_role('button',name='OK',exact=True).count():await frame.get_by_role('button',name='OK',exact=True).click()
  await ctx.storage_state(path='/tmp/original-placement.json')
  await page.wait_for_timeout(1500)
  await page.screenshot(path='/tmp/original-placement.png')
  await frame.get_by_role('button',name='Place Adam here',exact=True).click(timeout=15000)
  await frame.wait_for_function('window.__hw.livingTest.state.adamUnlocked',timeout=60000)
  await frame.get_by_role('button',name='Welcome, Adam!',exact=True).click()
  assert await frame.evaluate('window.__hw.store.state.activeCharacter')=='you'
  assert await frame.evaluate('window.__hw.selectCharacter("adam")') is False
  await frame.evaluate("window.__hw.livingTest.speak('Hello Sarah','adam')")
  await page.wait_for_timeout(500)
  assert any(v['voiceId']=='cms-adam-fixture' and v['text']=='Hello Sarah' for v in voices),voices
  assert any(v['voiceId']=='MF3mGyEYCl7XYWbV9V6O' for v in voices),voices
  assert not errors,errors
  await page.screenshot(path='/tmp/original-adam-return.png')
  print('PASS: original scene, reading, quiz, Try It, actual digging, Adam reward, ship, placement, original controls and CMS/Perry voice IDs',flush=True)
  await b.close()
if __name__=='__main__':asyncio.run(main())
