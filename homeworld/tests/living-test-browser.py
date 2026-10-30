"""Play the opt-in behavior through the original island's real navigation/render loop."""
import asyncio
import os
import shutil
from playwright.async_api import async_playwright

BASE = os.environ.get('LIVING_ISLAND_TEST_URL', 'http://127.0.0.1:5190/')
URL = BASE + ('&' if '?' in BASE else '?') + 'livingTest=1'

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=shutil.which('chromium'), headless=True, args=['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'])
        page = await browser.new_page(viewport={'width': 430, 'height': 932}, device_scale_factor=1)
        await page.add_init_script("""
          for (const key of ['godlykids_homeworld_playtest_v1','godlykids_players_world_residents_v1','godly_kids_data_v6']) localStorage.setItem(key,'original-save-sentinel');
          localStorage.setItem('godlykids_profile_scope_migrated_v1','real-kid');
        """)
        errors, requests = [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('request', lambda r: requests.append(r.url))
        await page.goto(URL, wait_until='domcontentloaded')
        await page.wait_for_function('window.__hw?.loaded || window.__hw?.error', timeout=90000)
        assert await page.evaluate('window.__hw.loaded'), await page.evaluate('window.__hw.error')
        assert any('/assets/environment.glb' in url for url in requests)
        assert any('/assets/adam.glb' in url for url in requests)
        assert await page.evaluate('window.__hw.store.state.activeCharacter') == 'you'
        assert await page.evaluate("window.__hw.selectCharacter('eve')") is False
        assert await page.evaluate("window.__hw.residents.playAs('noah')") is False
        assert await page.locator('[aria-label*="joystick" i]').count() == 0
        await page.wait_for_timeout(1200)
        await page.screenshot(path='/tmp/original-island-living-test.png')
        async def software_quality():
            # Software Chromium cannot establish device performance. Reduce rendering
            # cost only; keep the real simulation, navigation, assets, and assertions.
            await page.evaluate('''() => {
              const g=window.__hw;
              g.renderer.setPixelRatio(.5);g.renderer.shadowMap.enabled=false;
              g.sun.castShadow=false;g.resize();
              // Render periodically while the actual game loop continues on every RAF.
              // This is a functional test, not a device frame-rate benchmark.
              const render=g.renderer.render.bind(g.renderer);let frame=0;
              g.renderer.render=(...args)=>{
                g.camera.updateMatrixWorld();
                if(++frame%8===0)render(...args);
              };
            }''')
        await software_quality()
        async def state():
            return await page.evaluate('window.__hw.livingTest.state')
        before = await page.evaluate('({player:{...window.__hw.player},friends:Object.values(window.__hw.community.actors).map(h=>[h.actor.position.x,h.actor.position.z])})')
        for _ in range(15):
            await page.wait_for_timeout(1000)
            after = await page.evaluate('({player:{...window.__hw.player},friends:Object.values(window.__hw.community.actors).map(h=>[h.actor.position.x,h.actor.position.z])})')
            if before['friends'] != after['friends']:
                break
        assert before['player'] == after['player']
        assert before['friends'] != after['friends']
        print('PASS: original island GLBs, autonomous Bible friends, fixed player, no joystick', flush=True)
        # Use the same public walk action as the UI; do not teleport or edit progress.
        async def walk_to_supply(resource_id):
            if resource_id in (await state())['gathered']:
                return
            print('Walking to',resource_id,flush=True)
            await page.evaluate('(id)=>{const t=window.__hw.livingTest;t.walk(t.resources.find(r=>r.id===id));}', resource_id)
            await page.wait_for_function('(id)=>window.__hw.livingTest.state.gathered.includes(id)', arg=resource_id, timeout=60000)
        async def walk_to_circle():
            print('Walking to delivery circle',flush=True)
            await page.evaluate('window.__hw.livingTest.walk(window.__hw.livingTest.site())')
        await walk_to_supply('log-1')
        await walk_to_circle()
        await page.wait_for_function('window.__hw.livingTest.state.deposits.wood===1', timeout=60000)
        assert (await state())['stage'] == 0
        await page.reload(wait_until='domcontentloaded')
        await page.wait_for_function('window.__hw?.loaded || window.__hw?.error', timeout=90000)
        await software_quality()
        assert (await state())['deposits']['wood'] == 1
        print('PASS: partial delivery and reload on the original island', flush=True)
        for stage, prefix, count in [(0, 'log', 3), (1, 'carrot', 4), (2, 'flower', 3)]:
            for i in range(1, count + 1):
                await walk_to_supply(f'{prefix}-{i}')
            if stage == 1:
                await page.screenshot(path='/tmp/original-island-carrying.png')
            await walk_to_circle()
            await page.wait_for_function('(stage)=>window.__hw.livingTest.state.stage===stage', arg=stage + 1, timeout=60000)
            assert await page.evaluate('window.__hw.store.state.activeCharacter') == 'you'
            print('PASS: real navigation, auto pickup and delivery for', prefix, flush=True)
        await page.wait_for_function('window.__hw.livingTest.state.homeWork===1', timeout=90000)
        assert await page.evaluate('window.__hw.store.state.buildings.some(b=>b.id==="living-test-home"&&b.kind==="hut"&&b.status==="complete")')
        assert await page.evaluate('window.__hw.building.nodes.has("living-test-home")')
        await page.reload(wait_until='domcontentloaded')
        await page.wait_for_function('window.__hw?.loaded || window.__hw?.error', timeout=90000)
        await software_quality()
        assert (await state())['stage'] == 3
        for name in ['Open the island to-do list', 'Open my bag', 'Open build', 'Friends']:
            await page.get_by_role('button', name=name, exact=True).click()
            assert await page.get_by_role('dialog').is_visible()
            assert await page.get_by_role('button', name='Play as', exact=False).count() == 0
            await page.get_by_role('button', name='Back to island', exact=True).click()
        for width, height in [(320, 740), (820, 1180), (1366, 900)]:
            await page.set_viewport_size({'width': width, 'height': height})
            await page.wait_for_timeout(250)
            assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        await page.set_viewport_size({'width':430,'height':932})
        await page.wait_for_timeout(700)
        await page.screenshot(path='/tmp/original-island-completed.png')
        for key in ['godlykids_homeworld_playtest_v1', 'godlykids_players_world_residents_v1', 'godly_kids_data_v6']:
            assert await page.evaluate('(k)=>localStorage.getItem(k)', key) == 'original-save-sentinel'
        assert await page.evaluate('localStorage.getItem("godlykids_profile_scope_migrated_v1")') == 'real-kid'
        assert not errors, errors
        print('PASS: original hut, retained button artwork, drawers, responsive sizes, reload, original save isolation, zero browser errors', flush=True)
        await browser.close()

asyncio.run(main())
