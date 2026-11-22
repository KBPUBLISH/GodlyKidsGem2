/**
 * Wander-bias verification (temporary, dev-only): no forced destination,
 * watch ~150s and capture frames every 6s. The moving character's location
 * per interval is derived afterwards by diffing consecutive frames.
 * Run: node scripts/verify-crew-wander.mjs
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4176';
const OUT = 'test-results';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

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
  localStorage.removeItem('debugCrewZones');
  localStorage.removeItem('debugCrewFirstStop');
});

await page.goto(`${BASE}/#/crew`, { waitUntil: 'load' });
await page.waitForSelector('[data-testid="crew-deck-3d"] canvas', { timeout: 15000 });
await page.waitForTimeout(3000);

for (let i = 0; i < 25; i++) {
  await page.screenshot({ path: `${OUT}/crew-wander-${String(i).padStart(2, '0')}.png` });
  await page.waitForTimeout(6000);
}
await browser.close();
console.log('DONE wander');
