/**
 * Verification for per-character crew chat memory (temporary, dev-only).
 * Stubbed character-chat endpoint (no AI tokens). Flow:
 *  1. open chat → greeting request must have NO history (first visit),
 *  2. tap a suggested question (one exchange), close the popup,
 *  3. reload the page and reopen the chat → greeting request must INCLUDE
 *     the saved history (welcome-back path; screenshot),
 *  4. age the stored record past 24h → reopen → greeting has no history again.
 * Run: node scripts/verify-crew-chat-memory.mjs
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4176';
const OUT = 'test-results';

const GREETING = "Hello little friend! I'm Adam, the very first man God made!";
const FOLLOWUP = 'Ha! I named one wiggly fellow "Hippopotamus" and giggled all day!';
const WELCOME_BACK =
  "You're back, little friend! Last time we giggled about naming the animals - want to hear more?";
const SUGGESTIONS = [
  'Did you name the animals silly names?',
  'Was the garden really pretty?',
  'Were you scared of the animals?',
];

const PORTRAIT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 400">
  <rect width="200" height="400" fill="#7fb069"/>
  <circle cx="100" cy="85" r="52" fill="#e8b88a"/>
  <circle cx="82" cy="80" r="7" fill="#2a1a0c"/><circle cx="118" cy="80" r="7" fill="#2a1a0c"/>
  <path d="M78 108 Q100 126 122 108" stroke="#2a1a0c" stroke-width="5" fill="none"/>
</svg>`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

/** Captured character-chat request bodies, in order. */
const calls = [];
await page.route('**/api/**', (route) => route.abort());
await page.route('**/ai/character-chat', (route) => {
  const body = route.request().postDataJSON();
  calls.push(body);
  const hasHistory = Array.isArray(body.history) && body.history.length > 0;
  const reply =
    body.question === '__greeting__'
      ? hasHistory
        ? WELCOME_BACK
        : GREETING
      : FOLLOWUP;
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ reply, suggestedQuestions: SUGGESTIONS }),
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

const openChat = async () => {
  await page.waitForSelector('button[aria-label="Chat with Adam"]', { timeout: 15000 });
  await page.click('button[aria-label="Chat with Adam"]');
  await page.waitForSelector(`button:has-text("${SUGGESTIONS[0]}")`, { timeout: 20000 });
};
const closeChat = async () => {
  await page.click('button[aria-label="Close"]');
  await page.waitForTimeout(300);
};

// 1) First visit: greeting, one exchange, close
await page.goto(`${BASE}/#/crew`, { waitUntil: 'load' });
await openChat();
await page.click(`button:has-text("${SUGGESTIONS[0]}")`);
await page.waitForSelector(`button:has-text("${SUGGESTIONS[1]}")`, { timeout: 20000 });
await closeChat();

const stored = await page.evaluate(() =>
  localStorage.getItem('crewChatHistory:debug-char-1'),
);
const record = stored ? JSON.parse(stored) : null;
console.log('stored turns after first session:', record?.turns?.length ?? 'NONE');
console.log(
  'stored record has savedAt timestamp?',
  typeof record?.savedAt === 'number',
);

// 2) Reload (survives app restart) and reopen → welcome-back with history
await page.reload({ waitUntil: 'load' });
await openChat();
const bubbleText = await page.evaluate(
  () => document.querySelector('[role="dialog"] [aria-live="polite"]')?.textContent ?? '',
);
console.log('reopen bubble is welcome-back?', bubbleText.includes("You're back"));
await page.screenshot({ path: `${OUT}/crew-chat-welcome-back.png` });
await closeChat();

// 3) Age the record past 24h → reopen → cold greeting again
await page.evaluate(() => {
  const key = 'crewChatHistory:debug-char-1';
  const rec = JSON.parse(localStorage.getItem(key));
  rec.savedAt = Date.now() - 25 * 60 * 60 * 1000;
  localStorage.setItem(key, JSON.stringify(rec));
});
await openChat();
const expiredBubble = await page.evaluate(
  () => document.querySelector('[role="dialog"] [aria-live="polite"]')?.textContent ?? '',
);
console.log('expired-memory bubble is cold greeting?', expiredBubble === GREETING);

// Request-body assertions
const summarize = (c) => ({
  question: c.question,
  historyLen: Array.isArray(c.history) ? c.history.length : 0,
});
console.log('character-chat calls:', JSON.stringify(calls.map(summarize)));
const [first, second, third, fourth] = calls;
console.log(
  'call 1 = cold greeting (no history)?',
  first?.question === '__greeting__' && !first?.history,
);
console.log(
  'call 3 = greeting WITH saved history?',
  third?.question === '__greeting__' &&
    Array.isArray(third?.history) &&
    third.history.length >= 3 &&
    third.history.some((t) => t.text.includes('Hippopotamus')),
);
console.log(
  'no cold greeting between sessions?',
  calls.filter((c, i) => i > 0 && i < 3 && c.question === '__greeting__' && !c.history)
    .length === 0,
);
console.log(
  'call 4 = cold greeting after expiry?',
  fourth?.question === '__greeting__' && !fourth?.history,
);

await browser.close();
console.log('DONE');
