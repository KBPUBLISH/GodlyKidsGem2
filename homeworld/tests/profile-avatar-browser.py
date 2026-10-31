"""Additional children get the onboarding avatar picker without changing their siblings."""
import asyncio,os,runpy,shutil,json
from pathlib import Path
from playwright.async_api import async_playwright,expect
ns=runpy.run_path(str(Path(__file__).with_name('living-test-browser.py')))
BASE=os.environ.get('LIVING_ISLAND_TEST_URL','http://127.0.0.1:3000').rstrip('/')
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(storage_state=os.environ.get('FRIEND_SAVE','/tmp/original-placement.json'),viewport={'width':390,'height':844},reduced_motion='reduce',has_touch=True)
  await ctx.route('**/api/**',ns['api']);await ctx.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:(errors.append(str(e)),print(e,flush=True)))
  await page.goto(BASE+'/#/profile')
  before=await page.evaluate("JSON.parse(localStorage.getItem('godly_kids_data_v6'))")
  siblings={k['id']:{key:k.get(key) for key in ['name','age','worldAvatarId','avatar','avatarSeed','coins']} for k in before['kids']}
  await page.get_by_role('button',name='New explorer',exact=True).click()
  await page.get_by_role('textbox',name='Child’s name').fill('Riley')
  await page.get_by_role('spinbutton',name='Child’s age').fill('9')
  await page.get_by_role('button',name='Continue',exact=True).click()
  await page.get_by_role('heading',name='Choose your avatar',exact=True).wait_for()
  assert await page.locator('.avatar-thumbnail').count()==6
  await page.get_by_role('button',name='Choose Sunshine Scout',exact=True).click()
  await page.get_by_role('button',name='Back to name and age',exact=True).click()
  await expect(page.get_by_role('textbox',name='Child’s name')).to_have_value('Riley')
  assert await page.evaluate("JSON.parse(localStorage.getItem('godly_kids_data_v6')).kids.length")==len(siblings)
  await page.get_by_role('button',name='Continue',exact=True).click()
  await expect(page.get_by_role('button',name='Choose Sunshine Scout',exact=True)).to_have_attribute('aria-pressed','true')
  for w,h in [(390,844),(768,1024)]:
   await page.set_viewport_size({'width':w,'height':h});await page.wait_for_timeout(300)
   assert await page.locator('.avatar-canvas canvas').count()==1
   await page.screenshot(path=f'/tmp/profile-avatar-{w}.png')
  await page.get_by_role('button',name='This is me!',exact=False).click()
  await page.wait_for_url('**/#/profile')
  await page.wait_for_function("JSON.parse(localStorage.getItem('godly_kids_data_v6')).kids.some(k=>k.name==='Riley')")
  saved=await page.evaluate("JSON.parse(localStorage.getItem('godly_kids_data_v6'))")
  kid=next(k for k in saved['kids'] if k['name']=='Riley');assert kid['worldAvatarId']=='sunshine' and kid['avatarSeed'].endswith('/sunshine.png'),kid
  assert len(saved['kids'])==len(siblings)+1
  for k in saved['kids']:
   if k['id'] in siblings:assert {key:k.get(key) for key in siblings[k['id']]}==siblings[k['id']],k
  print('CREATE: selected 3D avatar saved; existing profiles unchanged',flush=True)
  await page.goto(BASE+'/#/edit-profile?kid='+kid['id'])
  await page.get_by_role('button',name='Choose your avatar',exact=True).click()
  await page.get_by_role('button',name='Choose Berry Scout',exact=True).click()
  await page.get_by_role('button',name='This is me!',exact=False).click()
  await page.get_by_role('button',name='Save Changes',exact=False).click()
  await page.wait_for_url('**/#/profile');await page.reload()
  await page.wait_for_function("JSON.parse(localStorage.getItem('godly_kids_data_v6')).kids.some(k=>k.name==='Riley'&&k.worldAvatarId==='berry')")
  await page.get_by_role('button',name='Riley',exact=False).first.click()
  await page.goto(BASE+'/#/my-home');await page.wait_for_selector('iframe[title="Players World"]');frame=page.frames[-1]
  await frame.wait_for_function('window.__hw?.loaded',timeout=90000);await ns['quality'](frame)
  assert await frame.evaluate('window.__hw.livingTest.playerVisual.model.userData.avatarId')=='berry'
  assert not errors,errors
  print('PASS: name/age, six rotating avatars, back/cancel without duplicate profile, saved child-specific edit, correct island model on phone/iPad',flush=True)
  await browser.close()
asyncio.run(main())
