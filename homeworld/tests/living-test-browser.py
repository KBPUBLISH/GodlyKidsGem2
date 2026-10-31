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
    # Each regression has disposable storage; the garden produces the earned-tent fixture.
    import subprocess,sys
    from pathlib import Path
    for script in ['living-garden-browser.py','original-world-browser.py','original-story-browser.py']:
        subprocess.run([sys.executable,str(Path(__file__).with_name(script))],check=True)

if __name__ == '__main__':
    asyncio.run(main())
