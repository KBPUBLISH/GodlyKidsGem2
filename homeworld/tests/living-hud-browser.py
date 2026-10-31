"""Profile HUD, read-aloud controls, and garden prompts anchored to the rendered camera."""
import asyncio,os,runpy,shutil
from pathlib import Path
from playwright.async_api import async_playwright
ns=runpy.run_path(str(Path(__file__).with_name('living-test-browser.py')))
BASE=os.environ.get('LIVING_ISLAND_TEST_URL','http://127.0.0.1:3000').rstrip('/')
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(viewport={'width':390,'height':844},has_touch=True)
  page=await ctx.new_page();errors=[];voices=[];page.on('pageerror',lambda e:errors.append(str(e)))
  async def api(route):
   if route.request.url.endswith('/tts/generate') and route.request.method=='POST':voices.append(route.request.post_data_json)
   await ns['api'](route)
  await ctx.route('**/api/**',api);await ctx.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  await page.goto(BASE+'/#/my-home',wait_until='domcontentloaded');await page.wait_for_selector('iframe');frame=page.frames[-1]
  await frame.wait_for_function('window.__hw?.loaded',timeout=90000);await ns['quality'](frame)
  await frame.get_by_role('button',name='Hear my tasks',exact=True).click()
  await frame.get_by_role('button',name='Back to island',exact=True).click()
  await frame.get_by_role('button',name='Hear this task',exact=True).click()
  await page.wait_for_timeout(700)
  assert voices and all(v['voiceId']=='MF3mGyEYCl7XYWbV9V6O' for v in voices),voices
  assert '!' in await frame.get_by_role('button',name='Hear this task',exact=True).inner_text()
  assert '👂' not in await frame.locator('body').inner_text()
  await frame.wait_for_function("[...document.querySelectorAll('.island-profile-portrait,.ship-button img')].every(i=>i.complete&&i.naturalWidth>0)")
  for w,h in [(390,844),(320,568),(768,1024),(844,390)]:
   await page.set_viewport_size({'width':w,'height':h});await page.wait_for_timeout(180)
   assert await frame.locator('html').evaluate('e=>e.scrollWidth<=innerWidth')
   controls=await frame.locator('.island-top-hud>button,.living-task-info,.living-guide,.ship-button').evaluate_all('es=>es.map(e=>{const b=e.getBoundingClientRect();return {label:e.getAttribute("aria-label"),x:b.x,y:b.y,w:b.width,h:b.height}})')
   assert all(b['w']>=44 and b['h']>=44 and b['x']>=0 and b['x']+b['w']<=w+1 and b['y']>=0 and b['y']+b['h']<=h for b in controls),controls
   clock=await frame.locator('.island-profile-clock').bounding_box();bed=await frame.locator('.island-bedtime').bounding_box()
   assert clock['x']+clock['width']<=bed['x'],(clock,bed)
   await frame.evaluate('const g=window.__hw;for(let i=0;i<8;i++)g.renderer.render(g.scene,g.camera)')
   rail=await frame.locator('.side-buttons').evaluate('e=>({needed:e.scrollHeight,space:e.clientHeight})')
   assert rail['needed']<=rail['space']+1,rail
   await page.screenshot(path=f'/tmp/island-hud-{w}-{h}.png')
  await page.set_viewport_size({'width':390,'height':844})
  await frame.get_by_role('button',name='Bedtime at 10 PM. Open day and time',exact=True).click()
  await frame.get_by_role('dialog',name='Day and time',exact=True).wait_for()
  await frame.get_by_role('button',name='Back to island',exact=True).click()
  await frame.get_by_role('button',name='Sound is on. Turn music off',exact=True).click()
  assert await frame.get_by_role('button',name='Sound is off. Turn music on',exact=True).get_attribute('aria-pressed')=='false'
  # Place the test player at the garden; compare DOM positions with real camera projections through a turn.
  await frame.evaluate('''()=>{const g=window.__hw,p=g.livingTest.garden.plots[3];g.player={x:p.x+.5,y:p.y};g.path=[];}''')
  await frame.wait_for_function("[...document.querySelectorAll('.living-garden-spot')].some(e=>getComputedStyle(e).display!=='none')")
  samples=await frame.evaluate('''async()=>{const g=window.__hw,garden=g.livingTest.garden,errors=[];for(let i=0;i<12;i++){g.viewYaw+=.08;await new Promise(requestAnimationFrame);for(const [index,node] of garden.promptNodes){if(node.style.display==='none')continue;const p=g.livingTest.project(garden.plots[index],.4);errors.push(Math.hypot(parseFloat(node.style.left)-p.x,parseFloat(node.style.top)-p.y));}}return errors;}''')
  assert samples and max(samples)<1,samples
  await frame.evaluate('''()=>{const g=window.__hw;g.player.x+=20;g.livingTest.garden.updatePrompts();}''')
  assert await frame.locator('.living-garden-spot:visible,.living-garden-timer:visible').count()==0
  await frame.evaluate('''()=>{const g=window.__hw,p=g.livingTest.garden.plots[3];g.player={x:p.x+.5,y:p.y};g.viewYaw=0;g.overview=true;g.livingTest.garden.updatePrompts();}''')
  assert await frame.locator('.living-garden-spot:visible,.living-garden-timer:visible').count()==0
  await frame.evaluate('window.__hw.overview=false;window.__hw.resize()')
  await frame.get_by_role('button',name='Plant a carrot seed',exact=True).click()
  await frame.wait_for_function('window.__hw.livingTest.farm.state.garden.planted>0',timeout=90000)
  assert not errors,errors
  print('PASS: profile/bedtime/ship art; phone and iPad controls; Perry read-aloud; markers track turns within 1px and hide far away/on map; first planting',flush=True)
  await browser.close()
asyncio.run(main())
