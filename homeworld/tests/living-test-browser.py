"""Full-app solo onboarding with CMS fixtures; requires the built island and app dev server."""
import asyncio,json,os,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright

BOOK='111111111111111111111111'
STORY='222222222222222222222222'
ISLAND={'_id':'333333333333333333333333','slug':'genesis','title':'Genesis','bookLabel':'Genesis','status':'published','storyCounts':{'published':1},'order':0}
PACK={'_id':STORY,'title':'God Makes a World','displayTitle':'God Makes a World','islandId':'genesis','status':'published','order':0,'bookId':BOOK,'quizMode':'none','heroImageUrl':'/assets/images/splash-adventure.jpg'}
BOOK_DATA={'_id':BOOK,'title':'God Makes a World','bookType':'bible_map','orientation':'portrait','coverImage':'/assets/images/splash-adventure.jpg','isMembersOnly':False,'status':'published','description':'Browser test fixture'}
PAGES=[{'_id':f'{i+4:024d}','bookId':BOOK,'pageNumber':i+1,'backgroundUrl':'/assets/images/splash-adventure.jpg','backgroundType':'image','textBoxes':[{'id':f'text-{i}','text':text,'x':5,'y':65,'width':90,'height':25,'fontSize':24,'color':'#172b24'}]} for i,text in enumerate(['God made a beautiful world.','God made Adam. The world was full of good things.'])]

async def api(route):
    path=urlparse(route.request.url).path
    if '/bible-map/islands/genesis' in path:body={**ISLAND,'stories':[PACK]}
    elif path.endswith('/bible-map/islands'):body=[ISLAND]
    elif path.endswith('/bible-map/stories'):body=[PACK]
    elif f'/pages/book/{BOOK}' in path:body=PAGES
    elif path.endswith(f'/books/{BOOK}'):body=BOOK_DATA
    elif '/tts' in path:body={'audioUrl':None}
    else:body=[]
    await route.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS'},body=json.dumps(body))

async def quality(frame):
    await frame.evaluate('''()=>{const g=window.__hw;g.renderer.setPixelRatio(.5);g.renderer.shadowMap.enabled=false;g.sun.castShadow=false;g.resize();const render=g.renderer.render.bind(g.renderer);let n=0;g.renderer.render=(...args)=>{g.camera.updateMatrixWorld();if(++n%8===0)render(...args);};}''')

async def finish_garden(frame):
    if not await frame.evaluate('window.__hw.livingTest.farm.state.garden.approved'):
        await frame.get_by_role('button',name='Make my garden bigger',exact=True).click()
        await frame.get_by_role('button',name='Yes, let’s grow!',exact=True).click()
    for field,label in [('dug','Dig a spot'),('planted','Plant a seed')]:
        while await frame.evaluate(f'window.__hw.livingTest.farm.state.garden.{field}')<3:
            before=await frame.evaluate(f'window.__hw.livingTest.farm.state.garden.{field}')
            await frame.get_by_role('button',name=label,exact=True).click()
            await frame.wait_for_function(f'(n)=>window.__hw.livingTest.farm.state.garden.{field}>n',arg=before,timeout=90000)
    await frame.wait_for_function('window.__hw.livingTest.farm.state.garden.completed')

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
        page=await b.new_page(viewport={'width':430,'height':932});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        await page.route('**/api/**',api)
        css=os.environ.get('LIVING_TEST_CSS','/tmp/godlykids-current.css')
        if os.path.isfile(css):
            await page.route('https://cdn.tailwindcss.com/**',lambda r:r.fulfill(content_type='application/javascript',body='window.tailwind={config:{}}'))
        await page.route('https://fonts.googleapis.com/**',lambda r:r.abort())
        await page.goto(os.environ.get('LIVING_ISLAND_TEST_URL','http://127.0.0.1:3000/')+'#/my-home?livingTest=1',wait_until='domcontentloaded')
        if os.path.isfile(css): await page.add_style_tag(path=css)
        await page.wait_for_selector('iframe[title="Players World"]',timeout=30000)
        frame=page.frames[-1]
        await frame.wait_for_function('window.__hw?.loaded||window.__hw?.error',timeout=90000)
        assert await frame.evaluate('window.__hw.loaded'),await frame.evaluate('window.__hw.error')
        assert await frame.evaluate('Object.values(window.__hw.community.actors).every(h=>!h.actor.visible)')
        assert 'Noah' not in await frame.locator('body').inner_text()
        assert await frame.get_by_role('button',name='Open build',exact=True).count()==0
        assert await frame.get_by_role('button',name='Friends',exact=True).count()==0
        assert await frame.locator('[aria-label*="joystick" i]').count()==0
        await quality(frame)
        await finish_garden(frame)
        await frame.get_by_role('button',name='Choose my chicken · 10 coins',exact=True).click()
        await frame.get_by_role('button',name='Not now',exact=True).click()
        assert await frame.evaluate('window.__hw.livingTest.farm.state.coins')==10
        await frame.get_by_role('button',name='Open my farm',exact=True).click()
        await frame.get_by_role('button',name='Buy a chicken',exact=False).click()
        await frame.get_by_role('textbox',name='Animal’s name',exact=True).fill('Sunny')
        await frame.get_by_role('button',name='Buy Sunny · 10 coins',exact=True).click()
        assert await frame.evaluate('window.__hw.livingTest.farm.state.coins')==0
        await page.wait_for_timeout(1000)
        await page.screenshot(path='/tmp/solo-island-start.png')
        print('PASS: child starts alone with a personal task in the original island',flush=True)
        async def gather(label,count):
            while await frame.evaluate('window.__hw.livingTest.state.gathered.length')<count:
                before=await frame.evaluate('window.__hw.livingTest.state.gathered.length')
                await frame.get_by_role('button',name=label,exact=True).click()
                await frame.wait_for_function('(n)=>window.__hw.livingTest.state.gathered.length>n',arg=before,timeout=90000)
        await gather('Find a log',3)
        assert '3 / 3' in await frame.locator('.living-progress').inner_text() or 'delivered' in await frame.locator('.living-progress').inner_text()
        await page.screenshot(path='/tmp/kids-carrying.png')
        await frame.get_by_role('button',name='Take logs to camp',exact=True).click()
        await frame.get_by_role('button',name='Build camp',exact=True).click(timeout=90000)
        await frame.wait_for_function('window.__hw.livingTest.state.stage===1',timeout=60000)
        assert await frame.evaluate('Object.values(window.__hw.community.actors).every(h=>!h.actor.visible)')
        assert await frame.evaluate('window.__hw.store.state.buildings.some(b=>b.id==="living-test-camp")')
        await frame.get_by_role('button',name='Let’s read a story',exact=True).wait_for(timeout=30000)
        await page.screenshot(path='/tmp/solo-first-friend-invite.png')
        print('PASS: solo camp completed; invitation appears with no friend granted',flush=True)
        await frame.get_by_role('button',name='Let’s read a story',exact=True).click()
        await page.wait_for_url('**/#/sail/genesis/lesson/hub?storyId='+STORY+'&livingFirstFriend=1',timeout=20000)
        print('PASS: actual app bridge opens the first CMS story pack',flush=True)
        await page.wait_for_timeout(2000)
        await page.get_by_role('button',name='6–7',exact=False).click()
        await page.wait_for_timeout(4000)
        assert await page.evaluate('Object.keys(localStorage).filter(k=>k.startsWith("gk_living_first_friend_v1:")).every(k=>JSON.parse(localStorage[k]).phase==="reading")')
        for i in range(2):
            await page.get_by_role('button',name='Next page',exact=True).click()
            await page.wait_for_timeout(1200)
        await page.wait_for_url('**/#/my-home?livingTest=1',timeout=20000)
        frame=page.frames[-1]
        await frame.wait_for_function('window.__hw?.loaded',timeout=90000)
        await quality(frame)
        await frame.wait_for_function('window.__hw.community.actors.adam.modelReady',timeout=60000)
        assert await frame.evaluate('window.__hw.community.actors.adam.actor.visible&&!window.__hw.community.actors.eve?.actor.visible&&!window.__hw.community.actors.noah?.actor.visible')
        assert await frame.evaluate('window.__hw.store.state.activeCharacter')=='you'
        assert await frame.evaluate('window.__hw.selectCharacter("adam")') is False
        await page.screenshot(path='/tmp/solo-adam-arrival.png')
        print('PASS: finishing the real reader returns to the island with only Adam and fixed player control',flush=True)
        await frame.get_by_role('button',name='Welcome, Adam!',exact=True).click()
        await page.screenshot(path='/tmp/kids-adam-and-player.png')
        await gather('Find a carrot',7)
        await frame.get_by_role('button',name='Take carrots to camp',exact=True).click()
        await frame.wait_for_function('window.__hw.livingTest.state.stage===2',timeout=90000)
        assert await frame.evaluate('window.__hw.livingTest.picnic.visible')
        await gather('Find a log',10)
        await frame.get_by_role('button',name='Take logs to home',exact=True).click()
        await frame.get_by_role('button',name='Build home',exact=True).click(timeout=90000)
        await frame.wait_for_function('window.__hw.livingTest.state.homeWork===1',timeout=120000)
        if await frame.evaluate('window.__hw.livingTest.watching'):await frame.get_by_role('button',name='Back to me',exact=True).click()
        await frame.get_by_role('button',name='Explore our home',exact=True).click()
        await frame.wait_for_function('window.__hw.interior?.phase==="inside"',timeout=30000)
        await page.screenshot(path='/tmp/kids-home-interior.png')
        await frame.get_by_role('button',name='Back to our island',exact=False).click()
        await frame.wait_for_function('!window.__hw.interior',timeout=30000)
        await page.context.storage_state(path='/tmp/kids-polished-completed.json')
        for width,height in [(320,740),(820,1180)]:
            await page.set_viewport_size({'width':width,'height':height})
            assert await frame.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
            await frame.get_by_role('button',name='Open my bag',exact=True).click()
            assert await frame.get_by_role('dialog').is_visible()
            await frame.get_by_role('button',name='Back to island',exact=True).click()
        print('PASS: visible goal buttons complete the full loop, picnic appears, home can be entered and left',flush=True)
        assert not errors,errors
        print('ERRORS:',errors,flush=True)
        await b.close()

if __name__ == '__main__':
    asyncio.run(main())
