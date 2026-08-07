/**
 * Verification for the idle + action-menu crew deck (temporary, dev-only).
 * Seeds a debug 3D character, finds it by grid-clicking the deck, then:
 *  (a) screenshots the open action menu (Talk + Dance buttons),
 *  (b) clicks Dance and screenshots two frames ~1s apart to prove the pose
 *      changes (dance clip playing).
 * Run: node scripts/verify-crew-dance.mjs
 */
import { chromium } from 'playwright-core';
import { readFileSync } from 'fs';

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
await page.waitForTimeout(3500); // model + decoder load, idle running

// Find the character: grid-click the standable deck area until the menu opens
let menuOpen = false;
outer: for (let gy = 0; gy < 8; gy++) {
  for (let gx = 0; gx < 8; gx++) {
    const x = W * (0.08 + (0.55 * gx) / 7);
    const y = H * (0.4 + (0.4 * gy) / 7);
    await page.mouse.click(x, y);
    await page.waitForTimeout(200);
    if (await page.$('[role="menu"][aria-label="Adam actions"]')) {
      menuOpen = true;
      console.log(`menu opened after click at (${Math.round(x)}, ${Math.round(y)})`);
      break outer;
    }
  }
}
if (!menuOpen) {
  console.log('FAILED: never hit the character');
  await page.screenshot({ path: `${OUT}/crew-menu-miss.png` });
  await browser.close();
  process.exit(1);
}

await page.screenshot({ path: `${OUT}/crew-idle-menu.png` });
const talkVisible = !!(await page.$('button[aria-label="Talk to Adam"]'));
const danceVisible = !!(await page.$('button[aria-label="Make Adam dance"]'));
console.log('menu buttons — talk:', talkVisible, 'dance:', danceVisible);

// Trigger the dance and capture two mid-dance frames
await page.click('button[aria-label="Make Adam dance"]');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/crew-dance-1.png` });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/crew-dance-2.png` });
const same = readFileSync(`${OUT}/crew-dance-1.png`).equals(
  readFileSync(`${OUT}/crew-dance-2.png`),
);
console.log('dance frames identical?', same);

// Tap empty deck (top corner of deck area) → menu should dismiss
await page.mouse.click(W * 0.55, H * 0.42);
await page.waitForTimeout(300);
console.log(
  'menu dismissed after deck tap?',
  !(await page.$('[role="menu"][aria-label="Adam actions"]')),
);

await browser.close();
console.log('DONE');
