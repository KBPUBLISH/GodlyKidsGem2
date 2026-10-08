/**
 * Verification for the redesigned crew chat popup (temporary, dev-only).
 * Seeds a 2D crew character (tap → chat opens directly), stubs the
 * character-chat endpoint (no AI tokens) + a fake portrait image, then:
 *  (a) screenshots mid-typing (partial reply in the speech bubble),
 *  (b) waits for typing to finish and screenshots the floating question pills,
 *  (c) taps a pill and confirms the follow-up reply types out.
 * Run: node scripts/verify-crew-chat.mjs
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4176';
const OUT = 'test-results';
const W = 390;
const H = 844;

const GREETING =
  "Well hello there, little friend! I'm Adam, the very first man God ever " +
  'made - can you believe I woke up in a garden with no belly button?! Want ' +
  'to hear about the amazing garden God gave me and all the funny animals I named?';
const SUGGESTIONS = [
  'Did you name the animals silly names?',
  'Was the garden really pretty?',
  'Were you scared of the animals?',
];
const FOLLOWUP =
  'Ha! I sure did - I named one wiggly fellow "Hippopotamus" and giggled all day!';

/** Simple full-body cartoon portrait (head at top → face-crop zooms on it). */
const PORTRAIT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 400">
  <rect width="200" height="400" fill="#7fb069"/>
  <ellipse cx="100" cy="330" rx="55" ry="70" fill="#8d5a2b"/>
  <circle cx="100" cy="85" r="52" fill="#e8b88a"/>
  <path d="M48 70 Q100 10 152 70 L152 55 Q100 -5 48 55 Z" fill="#4a2f1b"/>
  <circle cx="82" cy="80" r="7" fill="#2a1a0c"/>
  <circle cx="118" cy="80" r="7" fill="#2a1a0c"/>
  <path d="M78 108 Q100 126 122 108" stroke="#2a1a0c" stroke-width="5" fill="none" stroke-linecap="round"/>
</svg>`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

// Hermetic: block every backend call, then layer the chat stub on top
// (later-registered routes win in Playwright).
await page.route('**/api/**', (route) => route.abort());
let chatCalls = 0;
await page.route('**/ai/character-chat', (route) => {
  chatCalls += 1;
  const first = chatCalls === 1;
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      reply: first ? GREETING : FOLLOWUP,
      suggestedQuestions: SUGGESTIONS,
    }),
  });
});
await page.route('**/adam-portrait.svg', (route) =>
  route.fulfill({ contentType: 'image/svg+xml', body: PORTRAIT_SVG }),
);

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem(
    'godlykids_rewards_v1',
    JSON.stringify({
      characters: [
        {
          id: 'debug-char-1',
          name: 'Adam',
          imageUrl: '/adam-portrait.svg',
          unlockedAt: Date.now(),
        },
      ],
      games: [],
      bookTemplates: [],
      claimedKeys: [],
      selectedCrewIds: ['debug-char-1'],
    }),
  );
  localStorage.removeItem('debugCrewModelUrl'); // 2D avatar → tap opens chat
});

await page.goto(`${BASE}/#/crew`, { waitUntil: 'load' });
await page.waitForSelector('button[aria-label="Chat with Adam"]', { timeout: 15000 });
await page.click('button[aria-label="Chat with Adam"]');

// (a) mid-typing — partial greeting in the bubble next to the big face
await page.waitForSelector('[role="dialog"][aria-label="Chat with Adam"]', {
  timeout: 5000,
});
await page.waitForTimeout(2200); // ~55 chars in at 38ms/char
const partial = await page.evaluate(() => {
  const live = document.querySelector('[role="dialog"] [aria-live="polite"]');
  return live ? live.textContent : null;
});
console.log('mid-typing text length:', partial ? partial.length : 'NONE');
console.log(
  'partial (not full) reply?',
  !!partial && partial.length > 5 && partial.length < GREETING.length,
);
await page.screenshot({ path: `${OUT}/crew-chat-typing.png` });

// Pills must NOT be visible while still typing
const pillsEarly = await page.$(`button:has-text("${SUGGESTIONS[0]}")`);
console.log('pills hidden while typing?', !pillsEarly);

// (b) finished — full text + 3 floating question pills on the scene
await page.waitForSelector(`button:has-text("${SUGGESTIONS[0]}")`, { timeout: 20000 });
const pillCount = (await page.$$('button:has-text("?")')).length;
console.log('question pills visible:', pillCount);
const replayVisible = !!(await page.$('button[aria-label="Hear Adam say it again"]'));
console.log('replay button visible (expected false — no voiceId):', replayVisible);
await page.screenshot({ path: `${OUT}/crew-chat-final.png` });

// (c) tap a pill → thinking → follow-up reply types out
await page.click(`button:has-text("${SUGGESTIONS[0]}")`);
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/crew-chat-followup-typing.png` });
await page.waitForSelector(`button:has-text("${SUGGESTIONS[1]}")`, { timeout: 20000 });
const followupText = await page.evaluate(() => {
  const live = document.querySelector('[role="dialog"] [aria-live="polite"]');
  return live ? live.textContent : null;
});
console.log('follow-up reply typed fully?', followupText?.includes('Hippopotamus'));
console.log('chat endpoint stub calls:', chatCalls);

// Close X works
await page.click('button[aria-label="Close"]');
await page.waitForTimeout(300);
console.log(
  'dialog closed?',
  !(await page.$('[role="dialog"][aria-label="Chat with Adam"]')),
);

await browser.close();
console.log('DONE');
