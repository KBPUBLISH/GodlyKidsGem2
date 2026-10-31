"""Earned Adam, proximity → chat/voice/camera → real autonomous garden/wood/dig jobs. Local API fixtures only."""
import asyncio,json,os,runpy,shutil
from pathlib import Path
from playwright.async_api import async_playwright,expect
ns=runpy.run_path(str(Path(__file__).with_name('living-test-browser.py')))
BASE=os.environ.get('LIVING_ISLAND_TEST_URL','http://127.0.0.1:3000').rstrip('/')
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(storage_state=os.environ.get('FRIEND_SAVE','/tmp/original-placement.json'),viewport={'width':390,'height':844},reduced_motion='reduce')
  # Exercise dictation lifecycle without sending a child's recording to any service.
  await ctx.add_init_script("""const d=JSON.parse(localStorage.getItem('godly_kids_data_v6')||'{}');d.parentName='Sarah';localStorage.setItem('godly_kids_data_v6',JSON.stringify(d));window.SpeechRecognition=class{start(){window.__recognition=this;}stop(){this.onend?.();}abort(){this.onend?.();}};""")
  page=await ctx.new_page();errors=[];calls=[];voices=[];page.on('pageerror',lambda e:(errors.append(str(e)),print('JS ERROR',e,flush=True)))
  async def api(route):
   if '/ai/character-chat' in route.request.url:
    data=route.request.post_data_json;calls.append(data)
    reply='Hey Sarah, what made you smile today?' if data['question']=='__greeting__' else 'That sounds funny! God loves hearing about your day, too.'
    return await route.fulfill(content_type='application/json',body=json.dumps({'reply':reply,'suggestedQuestions':['Tell me a Bible story','Let’s pray together','What are you growing?']}))
   if '/tts/generate' in route.request.url and route.request.method=='POST':voices.append(route.request.post_data_json)
   await ns['api'](route)
  await ctx.route('**/api/**',api);await ctx.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  await page.goto(BASE+'/#/my-home');await page.wait_for_selector('iframe[title="Players World"]');frame=page.frames[-1]
  await frame.wait_for_function('window.__hw?.loaded',timeout=90000);await ns['quality'](frame)
  await frame.evaluate("""()=>{const g=window.__hw,t=g.livingTest;if(t.placingAdam)t.placeAdam();t.state.welcomeSeen=true;t.save();t.tasksOpen=false;g.notify();}""")
  await frame.wait_for_function('window.__hw.livingTest.state.adamUnlocked&&window.__hw.community.actors.adam.modelReady!==false',timeout=90000)
  async def approach():
   await frame.evaluate("""()=>{const g=window.__hw,t=g.livingTest,h=g.community.actors.adam;t.stopWatching();t.friend.finish(false);t.friend.nextRoutine=t.elapsed+999;t.state.welcomeSeen=true;t.dialogOpen=false;const p=g.nav.nearest({x:h.actor.position.x+1.3,y:-h.actor.position.z},3);g.player={...p};g.actor.position.set(p.x,h.actor.position.y,-p.y);g.path=[];g.notify();}""")
   await frame.get_by_role('region',name='Adam nearby').wait_for(timeout=15000)
  await approach();print('NEAR',flush=True);voice_count=len(voices);await page.wait_for_timeout(700);assert len(voices)==voice_count,'Proximity must not start TTS'
  await page.screenshot(path='/tmp/friend-near.png');print(await frame.locator('.living-friend-hello').inner_text(),flush=True)
  zoom=await frame.evaluate('window.__hw.zoom')
  await frame.get_by_role('button',name='💬 Chat',exact=True).click()
  await page.get_by_role('dialog',name='Chat with Adam').wait_for()
  await page.get_by_text('Hey Sarah, what made you smile today?',exact=False).wait_for(timeout=15000)
  assert calls[-1]['userName'];assert 'Farmer' in calls[-1]['persona'];assert calls[-1]['world']['role']=='Farmer'
  assert await frame.evaluate('window.__hw.store.state.activeCharacter')=='you'
  assert await frame.evaluate('window.__hw.zoom')<zoom
  for w,h in [(390,844),(768,1024)]:
   await page.set_viewport_size({'width':w,'height':h});await page.wait_for_timeout(400)
   box=await page.locator('.island-friend-chat').bounding_box();assert box['height']<h*.55 and box['x']>=0 and box['x']+box['width']<=w+1,box
   await page.screenshot(path=f'/tmp/friend-chat-{w}.png')
  await page.set_viewport_size({'width':390,'height':844})
  await page.get_by_role('button',name='Talk to your friend',exact=True).click();await page.evaluate("window.__recognition.onresult({results:[[{transcript:'My dog did a funny dance'}]]});window.__recognition.stop()")
  await expect(page.get_by_role("textbox",name="Your message")).to_have_value("My dog did a funny dance")
  assert len(calls)==1,'Dictation needs Send confirmation'
  await page.get_by_role('button',name='Send message',exact=True).click();await page.get_by_text('That sounds funny!',exact=False).wait_for()
  assert calls[-1]['question']=='My dog did a funny dance'
  await page.get_by_role('button',name='Close friend chat').click();await frame.wait_for_function('(z)=>Math.abs(window.__hw.zoom-z)<.01',arg=zoom)
  if os.environ.get('CHAT_ONLY'):
   await approach()
   async with page.expect_response('**/ai/character-chat'):
    await frame.get_by_role('button',name='💬 Chat',exact=True).click()
   await expect(page.get_by_text('Hey Sarah, what made you smile today?',exact=False).last).to_be_visible()
   assert any(t['text']=='My dog did a funny dance' for t in calls[-1]['history']),calls
   await page.get_by_role('button',name='Talk to your friend',exact=True).click()
   await page.evaluate("window.__recognition.onerror({error:'not-allowed'});window.__recognition.stop()")
   await page.get_by_text('Microphone is off.',exact=False).wait_for()
   await page.get_by_role('button',name='Close friend chat').click()
   await frame.wait_for_function('!document.body.classList.contains("living-chat-open")')
   await ctx.route('**/ai/character-chat',lambda route:route.fulfill(status=503,body='Unavailable'))
   await page.evaluate('window.SpeechRecognition=undefined;window.webkitSpeechRecognition=undefined')
   await approach();await frame.get_by_role('button',name='💬 Chat',exact=True).click()
   await page.get_by_role('button',name='Talk to your friend',exact=True).wait_for()
   await page.wait_for_function('!document.querySelector(".friend-thinking")')
   await page.get_by_role('button',name='Talk to your friend',exact=True).click()
   await page.get_by_text('Use the keyboard microphone, or tap a choice below.',exact=True).wait_for()
   await page.get_by_role('textbox',name='Your message').fill('Will you listen?');await page.get_by_role('button',name='Send message',exact=True).click()
   await page.get_by_text('Couldn’t connect.',exact=False).wait_for()
   await page.get_by_role('button',name='Close friend chat').click()
   await frame.wait_for_function('!window.__hw.livingTest.friend.chatOpen')
   assert not errors,errors
   print('PASS: phone/iPad close-up, editable voice reply, memory on reopen, denied microphone fallback, camera restore and cleanup',flush=True)
   await browser.close();return
  # Seed a thirsty plant using normal farm state, then observe an actual helper action.
  await frame.evaluate("""()=>{const f=window.__hw.livingTest.farm,g=f.state.garden,wateredAt=[...g.wateredAt],readyAt=[...g.readyAt];wateredAt[0]=null;readyAt[0]=0;f.commit({...f.state,garden:{...g,wateredAt,readyAt}});}""")
  await approach();await frame.get_by_role('button',name='🛠 Help',exact=True).click();await page.get_by_role('button',name='Water plants',exact=False).click()
  assert not await frame.evaluate('!!window.__hw.livingTest.friend.job'),'Task must wait for confirmation'
  await page.get_by_role('button',name='Yes, please!',exact=True).click();await page.get_by_text('I’ll water a thirsty plant!',exact=False).wait_for()
  await page.get_by_role('button',name='Close friend chat').click()
  await frame.wait_for_function('window.__hw.livingTest.farm.state.garden.wateredAt[0]!==null',timeout=90000)
  assert await frame.evaluate('window.__hw.store.state.activeCharacter')=='you'
  # Complete chopping and digging through the same controller used by confirmed Help requests.
  for kind,check in [('chop','window.__hw.store.state.removedTrees.length'),('plow','window.__hw.store.state.stats.plowed')]:
   before=await frame.evaluate(check);result=await frame.evaluate('(type)=>window.__hw.livingTest.friend.assign(type)',kind);assert result['ok'],result
   await frame.wait_for_function(f'(n)=>{check}>n',arg=before,timeout=90000)
  assert await frame.evaluate('window.__hw.store.state.activeCharacter')=='you'
  await approach();await frame.get_by_role('button',name='🛠 Help',exact=True).click();await page.get_by_role('button',name='Help build',exact=False).click();await page.get_by_role('button',name='Yes, please!',exact=True).click()
  await frame.wait_for_selector('#action-menu');assert not await page.get_by_role('dialog',name='Chat with Adam').count()
  assert any(v['voiceId']=='cms-adam-fixture' for v in voices),voices
  assert not errors,errors
  print('PASS: quiet nearby greeting, real Adam persona/world/voice IDs, compact phone/iPad chat, editable dictation, camera restore, confirmed helper watering, real wood/dig actions, Build handoff, player stays controlled')
  await browser.close()
asyncio.run(main())
