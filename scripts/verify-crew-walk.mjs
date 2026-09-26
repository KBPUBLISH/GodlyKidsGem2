/**
 * Verification for zone-aware idle/walk alternation (temporary, dev-only).
 * Seeds the debug 3D character and captures a sequence of screenshots over
 * ~18s to show varied stroll destinations (including toward the stern) that
 * never overlap the mast/cannon/crates/hatch cut-outs.
 * Run: node scripts/verify-crew-walk.mjs
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4176';
const OUT = 'test-results';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
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
  localStorage.removeItem('debugCrewZones');
});

await page.goto(`${BASE}/#/crew`, { waitUntil: 'load' });
await page.waitForSelector('[data-testid="crew-deck-3d"] canvas', { timeout: 15000 });
await page.waitForTimeout(3000);

for (let i = 1; i <= 4; i++) {
  await page.screenshot({ path: `${OUT}/crew-walk-seq-${i}.png` });
  console.log(`captured crew-walk-seq-${i}.png`);
  if (i < 4) await page.waitForTimeout(5500);
}

await browser.close();
console.log('DONE');
