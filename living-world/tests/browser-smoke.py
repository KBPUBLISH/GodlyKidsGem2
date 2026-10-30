import asyncio
import os
import shutil
from playwright.async_api import async_playwright

URL = os.environ.get('LIVING_WORLD_TEST_URL', 'http://127.0.0.1:3000/living-world/index.html')
KEY = 'godlykids_living_world_playtest_v1'

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=shutil.which('chromium'), headless=True, args=['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'])
        page = await browser.new_page(viewport={'width': 430, 'height': 932}, device_scale_factor=1)
        await page.add_init_script("if (localStorage.getItem('godly_kids_data_v6') === null) localStorage.setItem('godly_kids_data_v6', 'original-save-sentinel')")
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.goto(URL, wait_until='domcontentloaded')
        await page.wait_for_timeout(1500)
        await page.screenshot(path='/tmp/living-world-test-start.png')
        async def saved():
            return await page.evaluate('(k)=>JSON.parse(localStorage.getItem(k))', KEY)
        await page.wait_for_timeout(1500)
        start = await saved()
        before = await page.get_by_role('button', name='Talk to Noah', exact=True).bounding_box()
        await page.wait_for_timeout(6000)
        after = await page.get_by_role('button', name='Talk to Noah', exact=True).bounding_box()
        assert start['player'] == (await saved())['player'], 'Player must not move autonomously'
        assert abs(before['x'] - after['x']) + abs(before['y'] - after['y']) > 1, 'Noah must move autonomously'
        print('PASS: friends move autonomously while player remains still', flush=True)
        collected = 0
        for stage, kind, count, friend in [(0, 'Collect log', 3, 'Noah'), (1, 'Pick carrot', 4, 'Eve'), (2, 'Pick flower', 3, 'Ruth')]:
            for i in range(1, count + 1):
                print('Picking',kind,i,flush=True)
                await page.get_by_role('button', name=f'{kind} {i}', exact=True).click(force=True)
                collected += 1
                await page.wait_for_function('([k,n])=>JSON.parse(localStorage.getItem(k))?.gathered.length>=n', arg=[KEY, collected], timeout=45000)
                print('Collected',collected,flush=True)
            await page.get_by_role('button', name=f'Talk to {friend}', exact=True).click(force=True)
            await page.wait_for_function('([k,n])=>JSON.parse(localStorage.getItem(k))?.stage===n', arg=[KEY, stage + 1], timeout=45000)
            print('PASS: completed request for', friend, flush=True)
            if stage == 1:
                await page.screenshot(path='/tmp/living-world-new-friend.png')
        assert (await saved())['player']['id'] == 'you'
        await page.wait_for_function('(k)=>JSON.parse(localStorage.getItem(k))?.homeWork===1', arg=KEY, timeout=45000)
        position_before = (await saved())['player']
        await page.locator('canvas').focus()
        await page.keyboard.down('ArrowRight')
        await page.wait_for_timeout(800)
        await page.keyboard.up('ArrowRight')
        await page.wait_for_timeout(2000)
        assert (await saved())['player'] != position_before, 'Arrow keys must move the player'
        await page.reload(wait_until='domcontentloaded')
        await page.wait_for_timeout(1000)
        assert (await saved())['stage'] == 3
        assert await page.get_by_role('heading', name='You belong here.').is_visible()
        await page.screenshot(path='/tmp/living-world-test-finished.png')
        await page.get_by_role('button', name='My tasks').click()
        assert await page.get_by_role('dialog').is_visible()
        await page.keyboard.press('Escape')
        assert not await page.get_by_role('dialog').is_visible()
        for width, height in [(320, 740), (820, 1180), (1366, 900)]:
            await page.set_viewport_size({'width': width, 'height': height})
            await page.wait_for_timeout(200)
            assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            if width == 1366:
                await page.screenshot(path='/tmp/living-world-test-desktop.png')
        assert not errors, errors
        assert await page.evaluate("localStorage.getItem('godly_kids_data_v6')") == 'original-save-sentinel'
        print('PASS: autonomous construction, save restoration, keyboard movement, player identity, original save isolation, task dialog, responsive sizes, zero browser errors', flush=True)
        await browser.close()

asyncio.run(main())
