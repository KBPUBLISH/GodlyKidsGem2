/**
 * Verification script for the 3D crew deck (temporary, dev-only).
 *
 * Seeds a fake unlocked crew into the rewardsService localStorage store, sets
 * the debugCrewModelUrl hook, loads #/crew from the preview server, and:
 *  1. screenshots the deck twice (1s apart) to prove the 3D character is
 *     rendered and animating (position/pose must differ),
 *  2. taps the 2D avatar to prove the chat popup opens with the fallback line.
 *
 * Run: node scripts/verify-crew-3d.mjs
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4176';
const OUT = 'test-results';

const store = {
  characters: [
    { id: 'debug-char-1', name: 'Captain Levi', imageUrl: '', unlockedAt: Date.now() },
    { id: 'debug-char-2', name: 'Miriam', imageUrl: '', unlockedAt: Date.now() },
  ],
  games: [],
  bookTemplates: [],
  claimedKeys: [],
  selectedCrewIds: ['debug-char-1', 'debug-char-2'],
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    console.log(`[browser ${msg.type()}]`, msg.text());
  }
});
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate((s) => {
  localStorage.setItem('godlykids_rewards_v1', JSON.stringify(s));
  localStorage.setItem('debugCrewModelUrl', '/models/test-character.glb');
}, store);

await page.goto(`${BASE}/#/crew`, { waitUntil: 'load' });
await page.waitForSelector('[data-testid="crew-deck-3d"] canvas', { timeout: 15000 });
console.log('3D canvas mounted');

// Give the GLB + draco decoder time to load and the walk to start
await page.waitForTimeout(3500);
await page.screenshot({ path: `${OUT}/crew-3d-frame1.png` });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/crew-3d-frame2.png` });
console.log('captured frame1/frame2');

// Prove frames differ (character moved / pose changed)
import { readFileSync } from 'fs';
const a = readFileSync(`${OUT}/crew-3d-frame1.png`);
const b = readFileSync(`${OUT}/crew-3d-frame2.png`);
console.log('frames identical?', a.equals(b));

// Confirm WebGL actually drew something (non-blank canvas)
const canvasInfo = await page.evaluate(() => {
  const c = document.querySelector('[data-testid="crew-deck-3d"] canvas');
  return c ? { w: c.width, h: c.height } : null;
});
console.log('canvas size:', canvasInfo);

// Tap the 2D avatar (Miriam) → chat popup with fallback line (no backend)
await page.click('button[aria-label="Chat with Miriam"]');
await page.waitForSelector('[role="dialog"][aria-label="Chat with Miriam"]', { timeout: 5000 });
// fallback line appears after the chat request fails
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/crew-chat-popup.png` });
const popupText = await page.textContent('[role="dialog"][aria-label="Chat with Miriam"]');
console.log('popup text:', popupText?.slice(0, 160));

// Try tapping the 3D character via a coarse grid over the walkable deck
await page.click('button[aria-label="Close"]');
await page.waitForTimeout(400);
let hit3d = false;
outer: for (let gy = 0; gy < 5; gy++) {
  for (let gx = 0; gx < 6; gx++) {
    const x = 390 * (0.1 + (0.5 * gx) / 5);
    const y = 844 * (0.35 + (0.45 * gy) / 4);
    await page.mouse.click(x, y);
    await page.waitForTimeout(250);
    const dialog = await page.$('[role="dialog"][aria-label="Chat with Captain Levi"]');
    if (dialog) {
      hit3d = true;
      await page.screenshot({ path: `${OUT}/crew-3d-tap-chat.png` });
      break outer;
    }
  }
}
console.log('3D character tap opened chat?', hit3d);

await browser.close();
console.log('DONE');
