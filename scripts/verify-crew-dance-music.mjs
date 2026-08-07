/**
 * Verification for dance background music (temporary, dev-only).
 * Deck: opens the action menu, clicks Dance, and asserts via the DOM audio
 * element ([data-gk-role="dance-music"]) that the tune plays during the dance
 * and stops (fade) when the dance ends / is interrupted by a deck tap.
 * Also checks ducking of another playing <audio> element, then repeats the
 * play check in the basement zone.
 * Run: node scripts/verify-crew-dance-music.mjs
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4176';
const W = 390;
const H = 844;

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('console', (m) => {
  const t = m.text();
  if (t.includes('CrewDeck3D') || t.includes('danceMusic')) console.log('[browser]', t);
});

const musicState = () =>
  page.evaluate(() => {
    const a = document.querySelector('audio[data-gk-role="dance-music"]');
    return a
      ? { present: true, paused: a.paused, t: a.currentTime, vol: a.volume, loop: a.loop }
      : { present: false };
  });

/** Grid-click a safe scene area (away from nav buttons) until the menu opens. */
const findAndOpenMenu = async ([x0, y0, x1, y1]) => {
  for (let pass = 0; pass < 2; pass++) {
    for (let gy = 0; gy < 8; gy++) {
      for (let gx = 0; gx < 8; gx++) {
        const x = W * (x0 + ((x1 - x0) * gx) / 7);
        const y = H * (y0 + ((y1 - y0) * gy) / 7);
        await page.mouse.click(x, y);
        await page.waitForTimeout(150);
        if (await page.$('[role="menu"][aria-label="Adam actions"]')) return true;
      }
    }
  }
  return false;
};

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem(
    'godlykids_rewards_v1',
    JSON.stringify({
      characters: [{ id: 'debug-char-1', name: 'Adam', imageUrl: '', unlockedAt: Date.now() }],
      games: [],
      bookTemplates: [],
      claimedKeys: [],
      selectedCrewIds: ['debug-char-1'],
    }),
  );
  localStorage.setItem('debugCrewModelUrl', '/models/test-character.glb');
});

/* ------------------------------- deck ---------------------------------- */
await page.goto(`${BASE}/#/crew`, { waitUntil: 'load' });
await page.waitForSelector('[data-testid="crew-deck-3d"] canvas', { timeout: 15000 });
await page.waitForTimeout(3500);

// A decoy playing <audio> to prove ducking (stands in for story audio)
await page.evaluate(() => {
  const decoy = document.createElement('audio');
  decoy.id = 'decoy-audio';
  decoy.src = '/sounds/dance-loop.mp3';
  decoy.loop = true;
  decoy.volume = 0.8;
  document.body.appendChild(decoy);
  return decoy.play().catch((e) => console.log('decoy play failed:', e.name));
});

if (!(await findAndOpenMenu([0.08, 0.35, 0.6, 0.8]))) {
  console.log('FAILED: never hit the character on deck');
  await browser.close();
  process.exit(1);
}
await page.click('button[aria-label="Make Adam dance"]');
await page.waitForTimeout(600);

const during = await musicState();
const decoyDuring = await page.evaluate(() => document.getElementById('decoy-audio').volume);
console.log('DECK during dance:', JSON.stringify(during), '| decoy vol:', decoyDuring);

// Wait for the dance clip to finish (mixer 'finished' → danceMusic.stop())
let after = during;
for (let i = 0; i < 40 && !after.paused; i++) {
  await page.waitForTimeout(500);
  after = await musicState();
}
const decoyAfter = await page.evaluate(() => document.getElementById('decoy-audio').volume);
console.log('DECK after dance:', JSON.stringify(after), '| decoy vol restored:', decoyAfter);

// Interrupt check: start another dance, then tap empty deck to dismiss
await page.click('button[aria-label="Make Adam dance"]');
await page.waitForTimeout(600);
const during2 = await musicState();
await page.mouse.click(W * 0.5, H * 0.9); // empty area tap → dismiss + interrupt
await page.waitForTimeout(600); // > 300ms fade
const after2 = await musicState();
console.log(
  'DECK interrupt: playing before tap:',
  !during2.paused,
  '| stopped after tap:',
  after2.paused,
);

/* ----------------------------- basement -------------------------------- */
await page.evaluate(() => {
  sessionStorage.setItem(
    'crewCharacterLocations',
    JSON.stringify({ 'debug-char-1': { loc: 'basement', returnAt: Date.now() + 300000 } }),
  );
});
await page.goto(`${BASE}/#/sail/basement`, { waitUntil: 'load' });
await page.waitForSelector('[data-testid="crew-deck-3d"] canvas', { timeout: 15000 });
await page.waitForTimeout(3500);

if (!(await findAndOpenMenu([0.3, 0.5, 0.8, 0.9]))) {
  console.log('FAILED: never hit the character in the basement');
  await browser.close();
  process.exit(1);
}
await page.click('button[aria-label="Make Adam dance"]');
await page.waitForTimeout(600);
const bDuring = await musicState();
let bAfter = bDuring;
for (let i = 0; i < 40 && !bAfter.paused; i++) {
  await page.waitForTimeout(500);
  bAfter = await musicState();
}
console.log('BASEMENT during dance:', JSON.stringify(bDuring));
console.log('BASEMENT after dance:', JSON.stringify(bAfter));

await browser.close();
console.log('DONE');
