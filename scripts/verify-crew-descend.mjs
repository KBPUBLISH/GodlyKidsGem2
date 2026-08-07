/**
 * Verification for blob shadow, stride-matched walking, hatch descent and
 * the basement 3D character (temporary, dev-only).
 * Run: node scripts/verify-crew-descend.mjs
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4176';
const OUT = 'test-results';
const W = 390;
const H = 844;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('console', (m) => {
  if (m.text().includes('CrewDeck3D')) console.log('[browser]', m.text());
});

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem(
    'godlykids_rewards_v1',
    JSON.stringify({
      characters: [
        { id: 'debug-char-1', name: 'Adam', imageUrl: '', unlockedAt: Date.now() },
      ],
      games: [],
      bookTemplates: [],
      claimedKeys: [],
      selectedCrewIds: ['debug-char-1'],
    }),
  );
  localStorage.setItem('debugCrewModelUrl', '/models/test-character.glb');
});

await page.goto(`${BASE}/#/crew`, { waitUntil: 'load' });
await page.waitForSelector('[data-testid="crew-deck-3d"] canvas', { timeout: 15000 });
await page.waitForTimeout(3000); // model + decoder load

// (a) blob shadow while idling
await page.screenshot({ path: `${OUT}/crew-shadow-idle.png` });

// Foot-skating check: strolls start after ~1.5–4s of idle; capture a burst of
// frames 400ms apart so two consecutive mid-stroll frames can be compared
// (feet phase vs ground covered).
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/crew-stride-${String(i).padStart(2, '0')}.png` });
}

// (b) hatch descent: tap OPEN → walk to hatch → sink → auto-navigate
await page.click('button[aria-label="Open hatch to the basement"]');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/crew-descend-1-walking.png` });
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/crew-descend-2-atHatch.png` });
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/crew-descend-3-sinking.png` });

// Wait for navigation into the basement (descent + hatch fade ≤ ~3.5s more)
await page.waitForFunction(() => location.hash.includes('/sail/basement'), null, {
  timeout: 8000,
});
console.log('navigated to basement:', await page.evaluate(() => location.hash));
await page.waitForSelector('[data-testid="crew-deck-3d"] canvas', { timeout: 15000 });
await page.waitForTimeout(2500); // white fade reveal + model idle
await page.screenshot({ path: `${OUT}/basement-idle.png` });

// (c) basement action menu: grid-click around the stair-base spawn area
let menuOpen = false;
outer: for (let gy = 0; gy < 6; gy++) {
  for (let gx = 0; gx < 6; gx++) {
    const x = W * (0.4 + (0.42 * gx) / 5);
    const y = H * (0.55 + (0.38 * gy) / 5);
    await page.mouse.click(x, y);
    await page.waitForTimeout(200);
    if (await page.$('[role="menu"][aria-label="Adam actions"]')) {
      menuOpen = true;
      console.log(`basement menu opened at (${Math.round(x)}, ${Math.round(y)})`);
      break outer;
    }
  }
}
console.log('basement menu open?', menuOpen);
await page.screenshot({ path: `${OUT}/basement-menu.png` });

if (menuOpen) {
  // Dance still works below deck
  await page.click('button[aria-label="Make Adam dance"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/basement-dance.png` });
}

await browser.close();
console.log('DONE');
