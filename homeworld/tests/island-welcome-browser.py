"""Intro ordering, soft paywall, parent gate and mocked checkout return paths."""
import asyncio,json,os,re,runpy,shutil
from pathlib import Path
from playwright.async_api import async_playwright
ns=runpy.run_path(str(Path(__file__).with_name('living-test-browser.py')))
BASE=os.environ.get('LIVING_ISLAND_TEST_URL','http://127.0.0.1:3000').rstrip('/')

async def reach_offer(page):
 await page.goto(BASE+'/#/onboarding',wait_until='domcontentloaded')
 for title in ['Unlock','Build & Grow','Discover']:
  await page.get_by_role('heading',name=title,exact=True).wait_for()
  await page.get_by_role('button',name='Continue',exact=True).click()
 await page.get_by_role('heading',name='Try 14 Days Free',exact=True).wait_for()

async def parent_gate(page):
 await page.get_by_role('button',name='Try 14 Days Free',exact=True).click()
 await page.get_by_role('heading',name='Ask a Parent',exact=True).wait_for()
 problem=re.search(r'(\d+)\s*\+\s*(\d+)\s*=\s*\?',await page.locator('body').inner_text())
 assert problem
 await page.get_by_placeholder('?',exact=True).fill(str(int(problem[1])+int(problem[2])))
 await page.get_by_role('button',name='Verify & Continue',exact=True).click()

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  async def context():
   c=await browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block')
   await c.route('**/api/**',ns['api']);await c.route('**/*.glb*',lambda r:r.abort());await c.route('https://fonts.googleapis.com/**',lambda r:r.abort())
   return c
  c=await context();page=await c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(BASE+'/#/onboarding',wait_until='domcontentloaded')
  for step,title in enumerate(['Unlock','Build & Grow','Discover','Try 14 Days Free']):
   await page.get_by_role('heading',name=title,exact=True).wait_for()
   await page.wait_for_function("document.querySelector('.welcome-art>img')?.naturalWidth>0")
   assert not await page.get_by_role('textbox',name='Your name').count()
   for w,h in [(390,844),(320,568),(768,1024),(1024,768),(844,390)]:
    await page.set_viewport_size({'width':w,'height':h});await page.evaluate('document.fonts.ready')
    assert await page.locator('.island-welcome').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
    # Small screens may scroll the offer; actions must remain reachable.
    button=page.get_by_role('button',name='Maybe later' if step==3 else 'Continue',exact=True)
    await button.scroll_into_view_if_needed();assert await button.is_visible()
    await page.locator('.island-welcome').evaluate('e=>e.scrollTop=0')
    await page.screenshot(path=f'/tmp/welcome-{step+1}-{w}-{h}.png')
   await page.set_viewport_size({'width':390,'height':844})
   if step<3:await page.get_by_role('button',name='Continue',exact=True).click()
  await page.reload();await page.get_by_role('heading',name='Try 14 Days Free',exact=True).wait_for()
  await page.get_by_role('button',name='Back',exact=True).click();await page.get_by_role('heading',name='Discover',exact=True).wait_for()
  await page.get_by_role('button',name='Continue',exact=True).click()
  await page.get_by_role('button',name='Maybe later',exact=True).click()
  await page.get_by_role('heading',name='Let’s meet you!',exact=True).wait_for()
  assert await page.get_by_role('button',name='Continue',exact=True).is_disabled()
  await page.get_by_role('textbox',name='Your name',exact=True).fill('Sarah')
  await page.get_by_role('spinbutton',name='Your age',exact=True).fill('18')
  assert await page.get_by_role('button',name='Continue',exact=True).is_disabled()
  await page.get_by_role('spinbutton',name='Your age',exact=True).fill('8')
  assert await page.get_by_role('button',name='Continue',exact=True).is_enabled()
  assert await page.evaluate("!localStorage.getItem('godlykids_premium') || localStorage.getItem('godlykids_premium')!=='true'")
  assert not errors,errors
  await c.close()
  print('PASS: three distinct illustrated intros, offer fourth, mobile/tablet layouts, back/reload, free skip and name/age validation',flush=True)

  # All checkout responses below are local fixtures. No real checkout is made.
  for outcome in ['failure','cancel','verified','unverified']:
   c=await context();page=await c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));requests=[]
   async def checkout(route):
    requests.append(route.request.post_data_json)
    if outcome=='failure':await route.fulfill(status=503,content_type='application/json',body=json.dumps({'error':'Checkout unavailable in this test'}));return
    url=BASE+('/#/onboarding?trial=cancelled' if outcome=='cancel' else '/#/payment-success?onboarding=1&session_id=welcome-fixture')
    await route.fulfill(status=200,content_type='application/json',body=json.dumps({'url':url}))
   async def verify(route):await route.fulfill(status=200,content_type='application/json',body=json.dumps({'success':True,'isPremium':outcome=='verified'}))
   await c.route('**/api/stripe/create-checkout-session',checkout)
   await c.route('**/api/stripe/verify-session/*',verify)
   await reach_offer(page)
   await page.get_by_role('button',name=re.compile('Monthly')).click()
   await page.get_by_role('button',name='Try 14 Days Free',exact=True).click()
   await page.get_by_role('heading',name='Ask a Parent',exact=True).wait_for();assert not requests
   problem=re.search(r'(\d+)\s*\+\s*(\d+)\s*=\s*\?',await page.locator('body').inner_text())
   await page.get_by_placeholder('?',exact=True).fill(str(int(problem[1])+int(problem[2])))
   await page.get_by_role('button',name='Verify & Continue',exact=True).click()
   if outcome=='verified':
    await page.get_by_role('heading',name='Let’s meet you!',exact=True).wait_for(timeout=20000)
    assert await page.evaluate("localStorage.getItem('godlykids_premium')==='true'")
   elif outcome=='unverified':
    await page.get_by_role('button',name='Continue setup',exact=True).wait_for(timeout=20000)
    assert await page.evaluate("localStorage.getItem('godlykids_premium')!=='true'")
    await page.get_by_role('button',name='Continue setup',exact=True).click()
    await page.get_by_role('heading',name='Let’s meet you!',exact=True).wait_for()
   else:
    if outcome=='failure':await page.get_by_role('alert').filter(has_text='Checkout unavailable').wait_for()
    else:await page.wait_for_url('**/#/onboarding?trial=cancelled')
    await page.get_by_role('button',name='Maybe later',exact=True).click()
    await page.get_by_role('heading',name='Let’s meet you!',exact=True).wait_for()
    assert await page.evaluate("localStorage.getItem('godlykids_premium')!=='true'")
   assert len(requests)==1,requests
   assert requests[0]['plan']=='monthly'
   assert 'onboarding=1&session_id={CHECKOUT_SESSION_ID}' in requests[0]['successUrl']
   assert '/onboarding?trial=cancelled' in requests[0]['cancelUrl']
   assert not errors,errors
   await c.close();print('PASS: parent-gated mocked checkout '+outcome,flush=True)
  await browser.close()

asyncio.run(main())
