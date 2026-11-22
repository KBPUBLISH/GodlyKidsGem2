"""Swipeable avatar selection, background downloads, profile persistence, and the actual island model."""
import asyncio,json,os,runpy,shutil
from pathlib import Path
from playwright.async_api import async_playwright
ns=runpy.run_path(str(Path(__file__).with_name('living-test-browser.py')))
BASE=os.environ.get('LIVING_ISLAND_TEST_URL','http://127.0.0.1:3000/').rstrip('/')

async def enter_name(page):
 await page.goto(BASE+'/#/onboarding',wait_until='domcontentloaded')
 for title in ['Unlock','Build & Grow','Discover']:
  await page.get_by_role('heading',name=title,exact=True).wait_for()
  await page.get_by_role('button',name='Continue',exact=True).click()
 await page.get_by_role('textbox',name='Your name').fill('Sarah')
 await page.get_by_role('spinbutton',name='Your age').fill('8')
 await page.get_by_role('button',name="Continue",exact=True).click()
 await page.get_by_role('heading',name='Choose your avatar',exact=True).wait_for()

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block')
  await ctx.route('**/api/**',ns['api']);await ctx.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  await ctx.route('**/models/mobile/perry-flight.glb*',lambda r:r.abort())
  waiting=asyncio.Event();release=asyncio.Event();next_model=asyncio.Event()
  async def hold_world(route):waiting.set();await release.wait();await route.continue_()
  await ctx.route('**/homeworld/assets/mobile/environment.glb*',hold_world)
  page=await ctx.new_page();errors=[];requests=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  def requested(request):
   requests.append(request.url)
   if '/homeworld/assets/mobile/library.glb' in request.url:next_model.set()
  page.on('request',requested)
  await enter_name(page)
  assert await page.locator('.avatar-canvas canvas').count()==1
  assert await page.locator('canvas').count()==1,'Perry should release its scene while choosing'
  assert await page.evaluate("(JSON.parse(localStorage.getItem('godly_kids_data_v6')||'{}').kids||[]).length")==0
  canvas=page.locator('.avatar-canvas canvas')
  before=await canvas.screenshot();await page.wait_for_timeout(1200);after=await canvas.screenshot()
  assert before!=after,'3D character should rotate when reduced motion is off'
  await page.emulate_media(reduced_motion='reduce');await page.wait_for_timeout(100)
  still=await canvas.screenshot();await page.wait_for_timeout(200)
  assert still==await canvas.screenshot(),'Reduced motion should keep the character still'
  # Long drags turn the real 3D model, even with automatic motion disabled.
  bounds=await page.locator('.avatar-viewport').bounding_box();x=bounds['x']+55;y=bounds['y']+bounds['height']*.45
  for turn in range(2):
   await page.mouse.move(x,y);await page.mouse.down();await page.wait_for_timeout(500)
   await page.mouse.move(bounds['x']+bounds['width']-55,y,steps=12);await page.mouse.up()
   assert await page.locator('.avatar-caption h2').inner_text()=='Trail Scout'
  assert still!=await canvas.screenshot(),'Two long drags should rotate through a full turn without choosing another avatar'
  await page.emulate_media(reduced_motion='no-preference')
  await page.screenshot(path='/tmp/avatar-picker-trail.png')
  await asyncio.wait_for(waiting.wait(),timeout=20);release.set()
  await asyncio.wait_for(next_model.wait(),timeout=20)
  assert await page.get_by_role('heading',name='Choose your avatar').is_visible()
  names=[]
  for i in range(6):
   names.append(await page.locator('.avatar-caption h2').inner_text())
   if i<5:await page.get_by_role('button',name='Next avatar',exact=True).click()
  assert len(set(names))==6,names
  # Real touch swipe from the sixth design wraps to the first.
  bounds=await page.locator('.avatar-viewport').bounding_box();y=bounds['y']+bounds['height']*.4
  cdp=await ctx.new_cdp_session(page)
  for kind,x in [('touchStart',bounds['x']+bounds['width']*.75),('touchMove',bounds['x']+bounds['width']*.25)]:
   await cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'x':x,'y':y}]})
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
  assert await page.locator('.avatar-caption h2').inner_text()==names[0]
  await page.locator('.avatar-viewport').focus();await page.keyboard.press('ArrowLeft')
  assert await page.locator('.avatar-caption h2').inner_text()==names[5]
  await page.get_by_role('button',name='Previous avatar',exact=True).click()
  assert await page.locator('.avatar-caption h2').inner_text()=='Sky Scout'
  assert await page.locator('.avatar-thumbnail').count()==6
  await page.get_by_role('button',name='Choose Berry Scout',exact=True).click()
  await page.get_by_role('button',name='You can add another profile later',exact=True).click()
  assert await page.get_by_text('More kids in your family?',exact=False).is_visible()
  await page.screenshot(path='/tmp/avatar-picker-berry.png')
  await page.get_by_role('button',name='Back to name and age',exact=True).click()
  assert await page.get_by_role('textbox',name='Your name').input_value()=='Sarah'
  assert await page.get_by_role('spinbutton',name='Your age').input_value()=='8'
  await page.get_by_role('button',name="Continue",exact=True).click()
  assert await page.locator('.avatar-caption h2').inner_text()=='Berry Scout'
  for width,height in [(390,844),(768,1024),(1024,768),(1366,1024),(844,390),(320,568)]:
   await page.set_viewport_size({'width':width,'height':height});await page.wait_for_timeout(150)
   assert await page.locator('.choose-avatar').evaluate('e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1'),(width,height)
   grounded=await page.locator('.choose-avatar').evaluate("""root=>{
    const art=root.querySelector('.avatar-harbor img').getBoundingClientRect();
    const stage=root.querySelector('.avatar-viewport').getBoundingClientRect();
    const screen=root.getBoundingClientRect();
    const feet={x:stage.left+stage.width/2,y:stage.top+stage.height*.959341567};
    return Math.abs(art.left+art.width*.5-feet.x)<2 && Math.abs(art.top+art.height*.66-feet.y)<2
      && art.left<=screen.left+1 && art.right>=screen.right-1 && art.top<=screen.top+1 && art.bottom>=screen.bottom-1;
   }""")
   assert grounded,('Feet must align with the stone dock and scenery must cover the screen',width,height)
   targets=await page.locator('.choose-avatar button').evaluate_all('es=>es.map(e=>{const b=e.getBoundingClientRect();return {label:e.getAttribute("aria-label"),w:b.width,h:b.height};})')
   assert all(t['w']>=44 and t['h']>=44 for t in targets),targets
   await page.screenshot(path=f'/tmp/avatar-final-{width}-{height}.png')
  await page.set_viewport_size({'width':320,'height':568})
  assert await page.locator('.choose-avatar').evaluate('el=>el.scrollWidth<=el.clientWidth+1')
  await page.get_by_role('button',name='This is me!',exact=True).scroll_into_view_if_needed()
  await page.screenshot(path='/tmp/avatar-picker-small-phone.png')
  await page.get_by_role('button',name='This is me!',exact=True).click()
  await page.get_by_role('button',name='Maybe later',exact=True).click()
  await page.wait_for_url('**/#/my-home')
  await page.wait_for_function("JSON.parse(localStorage.getItem('godly_kids_data_v6')||'{}').kids?.[0]?.worldAvatarId==='berry'")
  saved=await page.evaluate("JSON.parse(localStorage.getItem('godly_kids_data_v6'))")
  assert len(saved['kids'])==1,saved['kids']
  assert saved['kids'][0]['avatarSeed']=='/avatars/adventurers/berry.png'
  await page.set_viewport_size({'width':390,'height':844})
  await page.evaluate("location.hash='/my-home'")
  await page.wait_for_selector('iframe');frame=page.frames[-1]
  await frame.wait_for_function('window.__hw?.loaded||window.__hw?.error',timeout=90000)
  assert 'avatar=berry' in frame.url,frame.url
  assert await frame.evaluate('window.__hw.loaded'),await frame.evaluate('window.__hw.error')
  await ns['quality'](frame)
  assert await frame.evaluate('window.__hw.model.userData.avatarId')=='berry'
  # Existing cloud API preserves avatarSeed; it need not understand a new field.
  await page.evaluate("const s=JSON.parse(localStorage.getItem('godly_kids_data_v6'));delete s.kids[0].worldAvatarId;localStorage.setItem('godly_kids_data_v6',JSON.stringify(s))")
  await page.reload(wait_until='domcontentloaded')
  await page.wait_for_selector('iframe[src*="avatar=berry"]',timeout=30000)
  assert not errors,errors
  print('PASS: six rotating designs; touch swipe, keyboard, arrows and back; background model downloads during selection; family note; small-phone layout; one saved child; selected 3D model in island; avatarSeed recovery after reload',flush=True)
  await ctx.close()
  ctx=await browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce',service_workers='block')
  await ctx.add_init_script("const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(String(type).includes('webgl'))return null;return original.call(this,type,...args)}")
  await ctx.route('**/api/**',ns['api']);await ctx.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  page=await ctx.new_page();await enter_name(page)
  await page.locator('.avatar-static').wait_for()
  await page.get_by_role('button',name='Next avatar',exact=True).click()
  await page.wait_for_function("document.querySelector('.avatar-static')?.naturalWidth>0")
  await page.get_by_role('button',name='This is me!',exact=True).click()
  await page.get_by_role('button',name='Maybe later',exact=True).click()
  await page.wait_for_url('**/#/my-home')
  print('PASS: unavailable WebGL uses the matching portrait and still allows selection and Continue',flush=True)
  await browser.close()

if __name__=='__main__':asyncio.run(main())
