/**
 * Verification for shorter/faster characters, basement sizing, and
 * autonomous basement trips (temporary, dev-only).
 * Uses localStorage.debugCrewTripSeconds to shrink trip/stay timers.
 * Run: node scripts/verify-crew-trips.mjs
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4176';
const OUT = 'test-results';
const TRIP_SEC = 8;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('console', (m) => {
  if (m.text().includes('CrewDeck3D')) console.log('[browser]', m.text());
});

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate((tripSec) => {
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
  localStorage.setItem('debugCrewTripSeconds', String(tripSec));
  sessionStorage.removeItem('crewCharacterLocations');
  sessionStorage.removeItem('crewBasementCharacterId');
}, TRIP_SEC);

await page.goto(`${BASE}/#/crew`, { waitUntil: 'load' });
await page.waitForSelector('[data-testid="crew-deck-3d"] canvas', { timeout: 15000 });
await page.waitForTimeout(2500);

// (a) new shorter deck size
await page.screenshot({ path: `${OUT}/crew-short-idle.png` });

// (b) mid-stroll cadence frames (first stroll starts ~1.5–4s after load)
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/crew-cadence-${String(i).padStart(2, '0')}.png` });
}

// (d) autonomous trip: burst frames while he walks to the hatch and sinks
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/crew-trip-${String(i).padStart(2, '0')}.png` });
  const loc = await page.evaluate(() => sessionStorage.getItem('crewCharacterLocations'));
  if (loc && JSON.parse(loc)['debug-char-1']?.loc === 'basement') {
    console.log(`location flipped to basement at frame ${i}:`, loc);
    break;
  }
}
console.log('hash after trip (must be #/crew):', await page.evaluate(() => location.hash));
console.log(
  'locations:',
  await page.evaluate(() => sessionStorage.getItem('crewCharacterLocations')),
);

// (c) basement page shows him larger
await page.goto(`${BASE}/#/sail/basement`, { waitUntil: 'load' });
await page.waitForSelector('[data-testid="crew-deck-3d"] canvas', { timeout: 15000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/basement-tall.png` });

// Back to deck before his return is due → capture the hatch emergence
await page.goto(`${BASE}/#/crew`, { waitUntil: 'load' });
await page.waitForSelector('[data-testid="crew-deck-3d"] canvas', { timeout: 15000 });
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/crew-emerge-${String(i).padStart(2, '0')}.png` });
  const loc = await page.evaluate(() => sessionStorage.getItem('crewCharacterLocations'));
  if (loc && JSON.parse(loc)['debug-char-1']?.loc === 'deck') {
    console.log(`emerged (location back to deck) at frame ${i}`);
    // two more frames to show him wandering again
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/crew-emerge-after.png` });
    break;
  }
}
console.log(
  'final locations:',
  await page.evaluate(() => sessionStorage.getItem('crewCharacterLocations')),
);
await browser.close();
console.log('DONE');
