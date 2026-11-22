/**
 * Verification for client-side suggestion freshness (temporary, dev-only).
 * Stubbed character-chat endpoint intentionally returns OVERLAPPING
 * suggestion sets (like the backend's 7-day response cache does). Flow:
 *  1. greeting → pills A/B/C,
 *  2. tap A → response repeats A (as a case/punctuation VARIANT) in its
 *     suggestions → rendered pills must exclude A and backfill from the
 *     seen-but-unasked pool (D from the response + C from the greeting),
 *  3. tap B → response suggests only already-seen questions → pills must
 *     backfill with D, then fall back to the LEAST-recently-asked repeat
 *     (A, not B, since B was asked more recently),
 *  4. sanity-check the crewChatAsked localStorage record.
 * Run: node scripts/verify-crew-chat-suggestions.mjs
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4176';
const OUT = 'test-results';

const Q_A = 'Did you name the animals silly names?';
const Q_A_VARIANT = 'did you name the animals silly names!'; // same question, different case/punct
const Q_B = 'Was the garden really pretty?';
const Q_C = 'Were you scared of the animals?';
const Q_D = 'What was your favorite fruit tree?';

const GREETING = "Hello little friend! I'm Adam!";
const REPLY_2 = 'Ha! I named one fellow Hippopotamus!';
const REPLY_3 = 'Oh yes, the garden was so beautiful!';

const PORTRAIT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 400">
  <rect width="200" height="400" fill="#7fb069"/>
  <circle cx="100" cy="85" r="52" fill="#e8b88a"/>
  <circle cx="82" cy="80" r="7" fill="#2a1a0c"/><circle cx="118" cy="80" r="7" fill="#2a1a0c"/>
  <path d="M78 108 Q100 126 122 108" stroke="#2a1a0c" stroke-width="5" fill="none"/>
</svg>`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

let chatCalls = 0;
await page.route('**/api/**', (route) => route.abort());
await page.route('**/ai/character-chat', (route) => {
  chatCalls += 1;
  // Overlapping sets on purpose — mimics cached backend responses.
  const byCall = {
    1: { reply: GREETING, suggestedQuestions: [Q_A, Q_B, Q_C] },
    2: { reply: REPLY_2, suggestedQuestions: [Q_A_VARIANT, Q_D, Q_B] },
    3: { reply: REPLY_3, suggestedQuestions: [Q_A, Q_B, Q_C] },
  };
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(byCall[chatCalls] ?? byCall[3]),
  });
});
await page.route('**/adam-portrait.svg', (route) =>
  route.fulfill({ contentType: 'image/svg+xml', body: PORTRAIT_SVG }),
);

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem(
    'godlykids_rewards_v1',
    JSON.stringify({
      characters: [
        { id: 'debug-char-1', name: 'Adam', imageUrl: '/adam-portrait.svg', unlockedAt: Date.now() },
      ],
      games: [],
      bookTemplates: [],
      claimedKeys: [],
      selectedCrewIds: ['debug-char-1'],
    }),
  );
});

/** Suggestion pills = the only unlabeled buttons inside the chat dialog. */
const readPills = () =>
  page.$$eval('[role="dialog"] button:not([aria-label])', (els) =>
    els.map((e) => e.textContent.trim()),
  );
const waitForPills = async () => {
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[role="dialog"] button:not([aria-label])').length >= 1,
    { timeout: 20000 },
  );
  await page.waitForTimeout(250); // let all 3 settle in the same render
  return readPills();
};

await page.goto(`${BASE}/#/crew`, { waitUntil: 'load' });
await page.waitForSelector('button[aria-label="Chat with Adam"]', { timeout: 15000 });
await page.click('button[aria-label="Chat with Adam"]');

// 1) Greeting: nothing asked yet → the response's own 3 suggestions
const pills1 = await waitForPills();
console.log('greeting pills:', JSON.stringify(pills1));
console.log(
  'greeting shows all 3 fresh suggestions?',
  pills1.length === 3 && pills1.includes(Q_A) && pills1.includes(Q_B) && pills1.includes(Q_C),
);

// 2) Ask A → response repeats A (variant spelling) → pill must exclude it,
//    backfilled so 3 still show (D fresh, B fresh, C from the greeting pool)
await page.click(`button:has-text("${Q_A}")`);
await page.waitForFunction(
  (t) => document.querySelector('[role="dialog"] [aria-live="polite"]')?.textContent?.includes(t),
  REPLY_2.slice(0, 20),
  { timeout: 20000 },
);
const pills2 = await waitForPills();
console.log('after asking A, pills:', JSON.stringify(pills2));
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
console.log(
  'asked question A excluded (incl. variant)?',
  !pills2.some((p) => norm(p) === norm(Q_A)),
);
console.log(
  'backfilled to exactly 3 pills (B, C, D)?',
  pills2.length === 3 && pills2.includes(Q_B) && pills2.includes(Q_C) && pills2.includes(Q_D),
);
await page.screenshot({ path: `${OUT}/crew-chat-suggestions-filtered.png` });

// 3) Ask B → response has NO never-seen questions → backfill D, then the
//    exhausted path must repeat the LEAST-recently-asked (A, not B)
await page.click(`button:has-text("${Q_B}")`);
await page.waitForFunction(
  (t) => document.querySelector('[role="dialog"] [aria-live="polite"]')?.textContent?.includes(t),
  REPLY_3.slice(0, 20),
  { timeout: 20000 },
);
const pills3 = await waitForPills();
console.log('after asking B (all seen), pills:', JSON.stringify(pills3));
console.log('still exactly 3 pills?', pills3.length === 3);
console.log(
  'unasked C and D preferred?',
  pills3.includes(Q_C) && pills3.includes(Q_D),
);
console.log(
  'least-recently-asked repeat is A (not B)?',
  pills3.some((p) => norm(p) === norm(Q_A)) && !pills3.some((p) => norm(p) === norm(Q_B)),
);
await page.screenshot({ path: `${OUT}/crew-chat-suggestions-lru-repeat.png` });

// 4) Storage sanity: asked list tracks A then B, 24h-expiring record
const record = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('crewChatAsked:debug-char-1') ?? 'null'),
);
console.log(
  'asked record tracks [A, B] in order?',
  record?.asked?.length === 2 &&
    record.asked[0].text === Q_A &&
    record.asked[1].text === Q_B &&
    record.asked[0].at <= record.asked[1].at,
);
console.log('record has savedAt for 24h expiry?', typeof record?.savedAt === 'number');
console.log('seen-but-unasked pool kept?', Array.isArray(record?.pool) && record.pool.length >= 2);

await browser.close();
console.log('DONE');
