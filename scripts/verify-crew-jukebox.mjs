/**
 * Verification for the jukebox dance party (temporary, dev-only).
 * Seeds TWO 3D characters, screenshots the deck in daylight, taps the
 * jukebox, captures mid-party frames (night sky + disco ball + spotlights +
 * both characters dancing), verifies the music element state and re-tap
 * ignoring, then confirms daylight + silence after the party.
 * Run: node scripts/verify-crew-jukebox.mjs
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4176';
const OUT = 'test-results';

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('console', (m) => {
  const t = m.text();
  if (t.includes('CrewDeck3D') || t.includes('danceMusic')) console.log('[browser]', t);
});

const musicState = () =>
  page.evaluate(() => {
    const a = document.querySelector('audio[data-gk-role="dance-music"]');
    return a ? { paused: a.paused, t: a.currentTime, vol: a.volume } : { paused: true, t: -1 };
  });

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem(
    'godlykids_rewards_v1',
    JSON.stringify({
      characters: [
        {
          id: 'debug-char-1', name: 'Adam', imageUrl: '',
          modelUrl: '/models/test-character.glb', unlockedAt: Date.now(),
        },
        {
          id: 'debug-char-2', name: 'Eli', imageUrl: '',
          modelUrl: '/models/test-character.glb', unlockedAt: Date.now(),
        },
      ],
      games: [],
      bookTemplates: [],
      claimedKeys: [],
      selectedCrewIds: ['debug-char-1', 'debug-char-2'],
    }),
  );
});

await page.goto(`${BASE}/#/crew`, { waitUntil: 'load' });
await page.waitForSelector('[data-testid="crew-deck-3d"] canvas', { timeout: 15000 });
await page.waitForTimeout(4000); // models loaded, idling in daylight

await page.screenshot({ path: `${OUT}/crew-party-day.png` });

// Hit the jukebox
await page.click('button[aria-label="Jukebox — start a dance party"]');
await page.waitForTimeout(1200); // ball dropped, night faded in
const during = await musicState();
await page.screenshot({ path: `${OUT}/crew-party-mid-1.png` });

// Re-tap must be ignored: music position keeps advancing, never resets
await page.click('button[aria-label="Jukebox — start a dance party"]');
await page.waitForTimeout(400);
const afterRetap = await musicState();
console.log(
  'music during party:', JSON.stringify(during),
  '| after re-tap t advanced (no reset):', afterRetap.t > during.t,
);

await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/crew-party-mid-2.png` }); // dancers mid-pose

// Party ends at 8s; wait past the fade + ball rise
await page.waitForTimeout(5500);
const after = await musicState();
await page.screenshot({ path: `${OUT}/crew-party-after.png` });
console.log('music after party (should be paused):', JSON.stringify(after));

await browser.close();
console.log('DONE');
