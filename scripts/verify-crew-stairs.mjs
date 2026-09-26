/**
 * Verification for quarterdeck stairs + wander bias (temporary, dev-only).
 * Pass --zones to only capture the debugCrewZones overlay screenshot.
 * Otherwise: forces the first stroll onto the quarterdeck
 * (debugCrewFirstStop) and captures walking → mid-climb → platform idle.
 * Run: node scripts/verify-crew-stairs.mjs [--zones] [--platform quarterdeck-left]
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4176';
const OUT = 'test-results';
const zonesOnly = process.argv.includes('--zones');
const platIdx = process.argv.indexOf('--platform');
const platform = platIdx > -1 ? process.argv[platIdx + 1] : 'quarterdeck-right';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('console', (m) => {
  if (m.text().includes('CrewDeck3D')) console.log('[browser]', m.text());
});

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(
  ([zones, plat]) => {
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
    if (zones) localStorage.setItem('debugCrewZones', '1');
    else {
      localStorage.removeItem('debugCrewZones');
      localStorage.setItem('debugCrewFirstStop', plat);
    }
  },
  [zonesOnly, platform],
);

await page.goto(`${BASE}/#/crew`, { waitUntil: 'load' });
await page.waitForSelector('[data-testid="crew-deck-3d"] canvas', { timeout: 15000 });
await page.waitForTimeout(3000);

if (zonesOnly) {
  await page.screenshot({ path: `${OUT}/crew-zones-stairs.png` });
  await browser.close();
  console.log('DONE zones');
  process.exit(0);
}

// First stroll starts after 1.5–4s idle and is forced onto the quarterdeck.
// Burst frames every 700ms to catch walking → climbing → platform idle.
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/crew-climb-${String(i).padStart(2, '0')}.png` });
}
await browser.close();
console.log('DONE climb');
