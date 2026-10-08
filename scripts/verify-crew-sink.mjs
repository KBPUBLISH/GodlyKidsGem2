/**
 * Focused capture of the hatch-descent sink phase (temporary, dev-only).
 * Clicks OPEN, then bursts frames every 300ms so a partially-descended frame
 * is guaranteed regardless of where the stroll started.
 * Run: node scripts/verify-crew-sink.mjs
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
});

await page.goto(`${BASE}/#/crew`, { waitUntil: 'load' });
await page.waitForSelector('[data-testid="crew-deck-3d"] canvas', { timeout: 15000 });
await page.waitForTimeout(3000);

await page.click('button[aria-label="Open hatch to the basement"]');
await page.waitForTimeout(1200);
for (let i = 0; i < 8; i++) {
  await page.screenshot({ path: `${OUT}/crew-sink-${String(i).padStart(2, '0')}.png` });
  await page.waitForTimeout(300);
}
console.log('hash now:', await page.evaluate(() => location.hash));
await browser.close();
console.log('DONE');
