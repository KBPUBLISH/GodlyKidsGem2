/**
 * Verification that the crew chat popup sends the active kid profile's first
 * name as `userName` in POST /api/ai/character-chat (temporary, dev-only).
 * Uses tmp-crewchat-harness.html (UserProvider + CrewChatPopup mounted
 * directly) with a stubbed chat endpoint — no backend, no AI tokens.
 * Profile is seeded into localStorage exactly the way UserContext stores it
 * (godly_kids_data_v6 with kids[] + currentProfileId), via addInitScript so
 * it is in place before any app code runs.
 * Run: vite dev on :4199, then node scripts/verify-crew-chat-username.mjs
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4199';
const SUGGESTIONS = [
  'Did you name the animals silly names?',
  'Was the garden really pretty?',
  'Were you scared of the animals?',
];

let failures = 0;
const check = (label, ok, extra) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures += 1;
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });

/** Fresh isolated page (own localStorage), seeded profile, stubbed endpoint. */
const openHarness = async (seed) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const calls = [];
  await page.route('**/api/**', (route) => route.abort());
  await page.route('**/ai/character-chat', (route) => {
    calls.push(route.request().postDataJSON());
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        reply: 'God told me about you — only good stuff, promise!',
        suggestedQuestions: SUGGESTIONS,
      }),
    });
  });
  await page.addInitScript((data) => {
    localStorage.setItem('godly_kids_data_v6', JSON.stringify(data));
  }, seed);
  await page.goto(`${BASE}/tmp-crewchat-harness.html`, { waitUntil: 'load' });
  // Greeting fires on mount; suggestions appear once the reply finishes typing.
  await page.waitForSelector(`button:has-text("${SUGGESTIONS[0]}")`, { timeout: 20000 });
  return { page, calls };
};

// 1) Active kid profile → userName = kid's FIRST name, on greeting AND follow-up
const kidRun = await openHarness({
  parentName: 'Parent',
  coins: 500,
  kids: [{ id: 'kid-1', name: 'Emma Rose', age: 6 }],
  currentProfileId: 'kid-1',
});
await kidRun.page.click(`button:has-text("${SUGGESTIONS[0]}")`);
await kidRun.page.waitForSelector(`button:has-text("${SUGGESTIONS[1]}")`, { timeout: 20000 });
check(
  'greeting request sends userName',
  kidRun.calls[0]?.question === '__greeting__' && kidRun.calls[0]?.userName === 'Emma',
  JSON.stringify(kidRun.calls[0]),
);
check('userName is FIRST name only ("Emma Rose" → "Emma")', kidRun.calls[0]?.userName === 'Emma');
check(
  'follow-up request sends userName too',
  kidRun.calls[1]?.userName === 'Emma' && kidRun.calls[1]?.question === SUGGESTIONS[0],
  JSON.stringify(kidRun.calls[1]),
);
await kidRun.page.close();

// 2) Parent profile active (currentProfileId null) → userName omitted
const parentRun = await openHarness({
  parentName: 'Parent',
  coins: 500,
  kids: [{ id: 'kid-1', name: 'Emma Rose', age: 6 }],
  currentProfileId: null,
});
check(
  'parent profile: userName omitted from body',
  parentRun.calls.length > 0 && !('userName' in parentRun.calls[0]),
  JSON.stringify(parentRun.calls[0]),
);
await parentRun.page.close();

await browser.close();
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
