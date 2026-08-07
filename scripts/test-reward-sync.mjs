/**
 * Node regression test for the CMS → app reward-sync logic in
 * services/rewardsService.ts (no browser needed).
 *
 * Scenario: a character (Noah) was unlocked and snapshotted into
 * localStorage with an OLD modelUrl. The CMS story pack now carries a NEW
 * modelUrl / voiceId / persona. The startup sync must overwrite the stored
 * snapshot EVEN when the hourly auto-grant throttle is active (regression:
 * the throttle used to skip the field refresh entirely, so a replaced GLB
 * kept walking the deck with the old model).
 *
 * Run: node scripts/test-reward-sync.mjs
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outfile = path.join(os.tmpdir(), `gk-rewards-test-${Date.now()}.mjs`);

// Bundle rewardsService with apiService stubbed out (it drags in auth /
// OneSignal / Despia modules that need a browser).
await build({
  entryPoints: [path.join(root, 'services/rewardsService.ts')],
  bundle: true,
  format: 'esm',
  outfile,
  plugins: [
    {
      name: 'stub-apiService',
      setup(b) {
        b.onResolve({ filter: /\.\/apiService$/ }, () => ({
          path: 'apiService-stub',
          namespace: 'stub',
        }));
        b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
          contents: `export const getApiBaseUrl = () => 'http://cms.test/api/';`,
          loader: 'js',
        }));
      },
    },
  ],
});

/* ---------------------------- browser stubs ----------------------------- */

const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

const STORY_ID = 'story-noah-ark-000000000001';
const OLD_MODEL = 'https://storage.googleapis.com/bucket/bible-map/ararat/character-model/111_noah.glb';
const NEW_MODEL = 'https://storage.googleapis.com/bucket/bible-map/ararat/character-model/222_noah-fixed-anim.glb';

const fetchCalls = [];
globalThis.fetch = async (url, init) => {
  fetchCalls.push({ url: String(url), init });
  if (!String(url).includes(`/bible-map/stories/${STORY_ID}`)) {
    return { ok: false, status: 404, json: async () => ({}) };
  }
  // Current CMS state: same reward id, replaced GLB + updated voice/persona.
  return {
    ok: true,
    status: 200,
    json: async () => ({
      story: {
        _id: STORY_ID,
        heroImageUrl: 'https://storage.googleapis.com/bucket/hero.png',
        rewards: {
          enabled: true,
          pool: [
            {
              id: 'reward-noah',
              type: 'character',
              title: 'Noah',
              characterName: 'Noah',
              imageUrl: 'https://storage.googleapis.com/bucket/noah-v2.png',
              modelUrl: NEW_MODEL,
              voiceId: 'voice-new',
              persona: 'Warm grandfatherly ark builder (v2)',
            },
          ],
        },
      },
      coloringPages: [],
    }),
  };
};

/* --------------------------- seed stored state --------------------------- */

// Held character snapshot with the OLD model (as written at unlock time).
storage.set(
  'godlykids_rewards_v1',
  JSON.stringify({
    characters: [
      {
        id: 'reward-noah',
        name: 'Noah',
        imageUrl: 'https://storage.googleapis.com/bucket/noah-v1.png',
        modelUrl: OLD_MODEL,
        voiceId: 'voice-old',
        persona: 'Old persona',
        sourceStoryId: STORY_ID,
        unlockedAt: 1700000000000,
      },
    ],
    games: [],
    bookTemplates: [],
    claimedKeys: [`${STORY_ID}:reward-noah`],
    selectedCrewIds: [],
  }),
);

// Throttle is ACTIVE: last successful sync 1 minute ago, same claimed set.
storage.set('godlykids_rewards_cms_sync_at', String(Date.now() - 60_000));
storage.set('godlykids_rewards_cms_sync_stories', STORY_ID);

/* -------------------------------- tests --------------------------------- */

const { rewardsService } = await import(outfile);

// 1. Startup sync with the throttle window active must STILL refresh fields.
await rewardsService.syncClaimedRewardsAtStartup();

let held = rewardsService.getUnlockedCharacters();
assert.equal(held.length, 1, 'still exactly one held character');
assert.equal(held[0].modelUrl, NEW_MODEL, 'modelUrl updated despite throttle');
assert.equal(held[0].voiceId, 'voice-new', 'voiceId updated despite throttle');
assert.equal(held[0].persona, 'Warm grandfatherly ark builder (v2)', 'persona updated');
assert.equal(held[0].imageUrl, 'https://storage.googleapis.com/bucket/noah-v2.png', 'imageUrl updated');
assert.equal(held[0].name, 'Noah', 'name preserved');
assert.equal(held[0].unlockedAt, 1700000000000, 'unlock timestamp untouched');
console.log('✔ startup sync updates modelUrl/voiceId/persona/imageUrl while throttled');

// 2. Story fetches must bypass HTTP caches.
assert.ok(fetchCalls.length > 0, 'story fetch happened');
for (const c of fetchCalls) {
  assert.equal(c.init?.cache, 'no-store', `fetch used cache:no-store (${c.url})`);
}
console.log('✔ story fetches use cache: no-store');

// 3. Direct refresh: no change on second run (idempotent, returns false)…
assert.equal(
  await rewardsService.refreshUnlockedCharactersFromCms(),
  false,
  'no-op refresh reports unchanged',
);
console.log('✔ refresh is idempotent when CMS matches the stored snapshot');

// 4. …and a field REMOVED in the CMS clears the stored value (CMS is truth).
const before = fetchCalls.length;
const origFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const res = await origFetch(url, init);
  if (!res.ok) return res;
  const json = await res.json();
  delete json.story.rewards.pool[0].voiceId;
  return { ok: true, status: 200, json: async () => json };
};
assert.equal(
  await rewardsService.refreshUnlockedCharactersFromCms(),
  true,
  'refresh reports a change after CMS removed voiceId',
);
held = rewardsService.getUnlockedCharacters();
assert.equal(held[0].voiceId, undefined, 'removed CMS voiceId clears stored value');
assert.equal(held[0].modelUrl, NEW_MODEL, 'modelUrl still current');
assert.ok(fetchCalls.length > before, 'refresh re-fetched the story');
console.log('✔ CMS-removed fields are cleared from the stored snapshot');

console.log('\nAll reward-sync tests passed.');
