import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAssetWarmupQueue} from '../utils/assetWarmupQueue.mjs';
import {PREVIEW_ART, previewWarmupAssets} from '../utils/previewAssets.mjs';
import {stat} from 'node:fs/promises';

const tick = () => new Promise(resolve => setImmediate(resolve));
test('splash warms language first and includes the playable island within a small budget', async () => {
  const assets = previewWarmupAssets('onboarding');
  assert.deepEqual(assets.slice(0, 2), [PREVIEW_ART.languageOcean, PREVIEW_ART.languageGlobe]);
  assert.equal(assets.filter(url => url.includes('/homeworld/assets/mobile/')).length, 6);
  assert.ok(!assets.some(url => /adam|eve|noah|\.mp4/.test(url)));
  const bytes = await Promise.all(assets.map(url => stat(new URL(`../public${url.split('?')[0]}`, import.meta.url)).then(s => s.size)));
  assert.ok(bytes.reduce((sum, n) => sum+n, 0) < 8*1024*1024);
  assert.ok(bytes[0]+bytes[1] < 170000);
  for (const connection of [{saveData:true}, {effectiveType:'2g'}, {effectiveType:'3g'}]) {
    assert.deepEqual(previewWarmupAssets('onboarding', connection), assets.slice(0, 2));
    assert.deepEqual(previewWarmupAssets('island', connection), []);
  }
});

test('navigation keeps the active transfer and reprioritizes without duplicate downloads', async () => {
  const calls = [], finish = [];
  const queue = createAssetWarmupQueue(url => new Promise(resolve => {calls.push(url); finish.push(resolve);}));
  let status;
  queue.subscribe(value => {status=value;});
  queue.start(['language', 'parrot', 'ship', 'island']);
  assert.deepEqual(calls, ['language']);
  assert.equal(status.finished, false);
  queue.start(['language', 'ship', 'island', 'island']);
  finish.shift()(); await tick();
  assert.deepEqual(calls, ['language', 'ship']);
  finish.shift()(); await tick();
  assert.deepEqual(calls, ['language', 'ship', 'island']);
  finish.shift()(); await tick();
  assert.equal(status.finished, true);
  queue.start(['language', 'ship', 'island']);
  assert.equal(calls.length, 3);
});

test('failures and timeouts release the queue; entering the world aborts background work', async () => {
  const calls = [];
  const queue = createAssetWarmupQueue((url, signal) => {
    calls.push(url);
    if (url === 'missing') throw Error('404');
    if (url === 'slow') return new Promise((_, reject) => signal.addEventListener('abort', () => reject(Error('aborted')), {once:true}));
    return Promise.resolve();
  }, 10);
  let status;
  queue.subscribe(value => {status=value;});
  queue.start(['missing', 'slow', 'next']);
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.deepEqual(calls, ['missing', 'slow', 'next']);
  assert.equal(status.finished, true);

  let signal;
  const stopped = createAssetWarmupQueue((url, s) => {
    signal=s;
    return new Promise((_, reject) => s.addEventListener('abort', () => reject(Error('aborted')), {once:true}));
  });
  stopped.subscribe(value => {status=value;});
  stopped.start(['island', 'later']);
  stopped.stop();
  assert.equal(signal.aborted, true);
  await tick();
  assert.equal(status.finished, true);
});
