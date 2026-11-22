import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
// Tests sit under homeworld/tests, so public is at the repository root.
const assets = new URL('../../public/homeworld/assets/', import.meta.url);
function metadata(url) {
  const bytes = readFileSync(url);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
}
const critical = ['environment','library','construction','house-upgrades','wood-storage','church'];
test('playable island downloads stay below 6 MiB of models', () => {
  const total = critical.reduce((sum, name) => sum + statSync(new URL(`mobile/${name}.glb`, assets)).size, 0);
  assert.ok(total < 6 * 1024 * 1024, `Initial models grew to ${total} bytes`);
});
test('optimized models preserve named gameplay assets, bones and animation clips', () => {
  const ids = data => (data.nodes || []).filter(n => n.extras?.game_asset_id).map(n => n.extras.game_asset_id).sort();
  const clips = data => (data.animations || []).map(a => a.name).sort();
  for (const name of [...critical, 'adam']) {
    const original = metadata(new URL(`${name}.glb`, assets));
    const mobile = metadata(new URL(`mobile/${name}.glb`, assets));
    assert.deepEqual(ids(mobile), ids(original), `${name}: gameplay asset IDs`);
    assert.deepEqual(clips(mobile), clips(original), `${name}: animations`);
    const joints = data => [...new Set((data.skins || []).flatMap(s => s.joints.map(i => data.nodes[i].name)))].sort();
    assert.deepEqual(joints(mobile), joints(original), `${name}: skeleton`);
  }
});
