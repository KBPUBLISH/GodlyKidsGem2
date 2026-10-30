// One "show me where" card for Abel, Noah, and Adam.
// Harvesting, planting, weeds, firewood, fishing, feeding, and ordinary chopping never come through here.
// Eve's meal card stays in dining.js.
import * as THREE from 'three';
import { cellAt, cellFromKey, gameTime, heightAt, terrainType, activeTrees, activeStumps } from './core.mjs';
import { skillFor } from './character-skills.mjs';
import { buildingById } from './building.mjs';
import { fenceGaps } from './farm-rules.mjs';
import {
  GARDEN_CAP, FENCE_CAP, canOffer, isSnoozed, snoozeUntil, gardenAskLine, buildAskLine, fenceAskLine,
  footprintKeys, fenceFromTaps, extendFence, toggleKey, isStructure,
} from './build-ask.mjs';

const TILE = 0.9;

export class BuildAsk {
  constructor(game) {
    this.g = game;
    this.open = null;
    this.picking = null;
    this.group = null;
    this.geo = null;
    this.mat = null;
  }

  state() { return this.g.store?.state || null; }

  bySkill(id) {
    for (const [, actor] of this.g.residents?.models || []) {
      if (skillFor(actor.userData?.name)?.id === id && actor !== this.g.actor) return actor;
    }
    return null;
  }

  until(id, s = this.state()) {
    const bag = s?.village?.askSnooze || {};
    if (id === 'garden') return bag.garden;
    if (id === 'fence') return bag.fence;
    if (String(id).startsWith('build:')) return bag.build?.[id.slice(6)];
    return null;
  }

  rememberSnooze(id) {
    const s = this.state();
    if (!s || !id || !this.g.store) return;
    const until = snoozeUntil(gameTime(s));
    const bag = { ...(s.village?.askSnooze || {}) };
    if (id === 'garden') bag.garden = until;
    else if (id === 'fence') bag.fence = until;
    else if (String(id).startsWith('build:')) bag.build = { ...(bag.build || {}), [id.slice(6)]: until };
    try { this.g.store.save({ ...s, village: { ...(s.village || {}), askSnooze: bag } }); }
    catch (e) { this.g.toast?.(e.message); }
  }

  snoozed(id) {
    const s = this.state();
    return !!s && isSnoozed(this.until(id, s), gameTime(s));
  }

  busy() { return !!(this.open || this.picking); }

  request(spec) {
    const s = this.state();
    if (!s || s.night || !spec?.id) return false;
    if (!canOffer({
      open: !!this.open,
      picking: !!this.picking,
      mealOpen: !!this.g.dining?.askCard?.(),
      snoozed: this.snoozed(spec.id),
    })) return false;
    this.open = spec;
    this.g.notify?.();
    return true;
  }

  requestGarden(home) {
    return this.request({ id: 'garden', mode: 'garden', name: home?.name || 'Abel', text: gardenAskLine(), cap: GARDEN_CAP });
  }

  requestBuilding(home, kind, buildingName) {
    if (!isStructure(kind)) return false;
    const def = buildingById(kind);
    const name = buildingName || def?.name || 'building';
    return this.request({
      id: `build:${kind}`,
      mode: 'build',
      kind,
      size: def?.size || [1, 1],
      name: home?.name || 'Noah',
      buildingName: name,
      text: buildAskLine(name),
    });
  }

  requestFence(home) {
    return this.request({ id: 'fence', mode: 'fence', name: home?.name || 'Adam', text: fenceAskLine(), cap: FENCE_CAP });
  }

  /** The card ResidentLine draws. Null while Eve's meal ask is up, so the two never stack. */
  card() {
    if (this.g.dining?.askCard?.()) return null;
    if (this.picking) return this.pickCard();
    if (!this.open) return null;
    return { name: this.open.name, text: this.open.text, goLabel: "I'll show you", waitLabel: 'Not now', goEnabled: true };
  }

  pickCard() {
    const p = this.picking;
    if (p.mode === 'build') {
      const name = p.buildingName || 'building';
      return {
        name: p.name,
        text: p.spot ? `The ${name} sits on the green squares. Build it here?` : `Tap the grass to place the ${name}.`,
        goLabel: 'Build it here',
        waitLabel: 'Not now',
        goEnabled: !!p.spot,
      };
    }
    const n = p.keys.length, cap = p.cap || GARDEN_CAP;
    return {
      name: p.name,
      text: `Tap the grass. ${n}/${cap}`,
      goLabel: p.mode === 'fence' ? "That's the fence" : "That's the garden",
      waitLabel: 'Not now',
      goEnabled: n > 0,
    };
  }

  show() {
    if (this.picking) { this.picking = { ...this.picking }; this.open = null; this.g.notify?.(); return; }
    if (!this.open) return;
    const spec = this.open;
    this.open = null;
    this.picking = { ...spec, keys: [], spot: null };
    this.paint([]);
    this.g.notify?.();
  }

  accept() {
    if (this.picking) { this.confirm(); return; }
    this.show();
  }

  decline() {
    const id = this.picking?.id || this.open?.id;
    this.rememberSnooze(id);
    this.open = null;
    this.picking = null;
    this.paint([]);
    this.g.notify?.();
  }

  confirm() {
    const p = this.picking;
    if (!p) return;
    if (p.mode === 'garden') {
      if (!p.keys.length) return;
      const saved = this.g.gardenPlan?.commit(p.keys);
      if (!saved) { this.g.toast?.('Those squares are not open grass.'); return; }
      this.g.toast?.(`${p.name} will fence that garden and plant it.`, 4200);
    } else if (p.mode === 'fence') {
      if (!p.keys.length) return;
      if (!this.saveFence(p.keys)) return;
      this.g.toast?.(`${p.name} will put the stable on the first square and fence the rest.`, 4600);
    } else if (p.mode === 'build') {
      if (!p.spot) return;
      this.saveSite(p);
      this.g.toast?.(`${p.name} will cut the trees on those squares, then build the ${p.buildingName}.`, 4600);
    }
    this.picking = null;
    this.paint([]);
    this.g.notify?.();
  }

  grass(key) {
    const world = this.g.world;
    if (!world) return false;
    const p = cellFromKey(world, key);
    return terrainType(world, p.x, p.y) === 2;
  }

  saveSite(p) {
    const s = this.state();
    if (!s) return;
    const sites = { ...(s.village?.buildSites || {}), [p.kind]: { key: p.spot.key, rotation: p.spot.rotation || 0, keys: p.spot.keys } };
    try { this.g.store.save({ ...s, village: { ...(s.village || {}), buildSites: sites } }); }
    catch (e) { this.g.toast?.(e.message); }
  }

  buildingSite(kind, s = this.state()) { return s?.village?.buildSites?.[kind] || null; }

  saveFence(keys) {
    const s = this.state();
    if (!s) return false;
    const grass = keys.filter(k => this.grass(k));
    if (!grass.length) { this.g.toast?.('Tap open grass for the fence.'); return false; }
    const prev = s.farm?.ranch?.kidFence || null;
    const plan = prev && this.fenceDone(prev, s) ? extendFence(prev, grass) : fenceFromTaps(grass);
    if (!plan?.stable) { this.g.toast?.('Tap the edge where the stable should sit.'); return false; }
    plan.ring = (plan.ring || []).filter(k => this.grass(k));
    if (plan.gate && !plan.ring.includes(plan.gate)) plan.gate = plan.ring[plan.ring.length - 1] || null;
    const write = (n) => { n.farm.ranch.kidFence = plan; };
    if (this.g.farmer?.mutate) this.g.farmer.mutate(write, false);
    else try { this.g.store.save({ ...s, farm: { ...(s.farm || {}), ranch: { ...(s.farm?.ranch || {}), kidFence: plan } } }); } catch (e) { this.g.toast?.(e.message); return false; }
    return true;
  }

  fencePlan(s = this.state()) { return s?.farm?.ranch?.kidFence || null; }

  fenceDone(plan, s = this.state()) {
    if (!plan?.ring?.length || !s) return false;
    if (!this.g.farmer?.stables?.(s)?.length) return false;
    return fenceGaps(plan, s.buildings).length === 0;
  }

  /** Trees (then the stumps they leave) on a confirmed building site. Not ordinary chopping. */
  siteClearChore(home, s) {
    if (!home || !s) return null;
    const goal = this.g.village?.needs?.()?.goal;
    const site = goal && this.buildingSite(goal.kind, s);
    if (!site?.keys?.length) return null;
    const noah = this.bySkill('woodcutter');
    if (noah && home.id !== noah.userData.id) return null;
    const tree = this.blocker(activeTrees(this.g.world, s, gameTime(s)), site.keys, t => (t.radius || .4) + .45);
    if (tree && !this.g.residents?.claims?.has(`tree:${tree.id}`)) {
      return { kind: 'chop', key: `tree:${tree.id}`, treeId: tree.id, target: { x: tree.position[0], y: tree.position[1] }, reach: 1.18 + (tree.radius || 0) * .2, dwell: 1, label: 'Clearing trees for the build', rank: 0.2 };
    }
    const stump = this.blocker(activeStumps(this.g.world, s), site.keys, t => (t.radius || .4) + .5);
    if (stump && !this.g.residents?.claims?.has(`stump:${stump.id}`)) {
      return { kind: 'stump', key: `stump:${stump.id}`, treeId: stump.id, target: { x: stump.position[0], y: stump.position[1] }, reach: 1.1, label: 'Clearing the build site', rank: 0.2 };
    }
    return null;
  }

  blocker(list, keys, pad) {
    for (const item of list || []) {
      if (this.hits(keys, item.position, pad(item))) return item;
    }
    return null;
  }

  hits(keys, pos, rad) {
    const world = this.g.world;
    for (const key of keys) {
      const p = cellFromKey(world, key);
      if (Math.hypot(pos[0] - p.x, pos[1] - p.y) < rad + 0.55) return true;
    }
    return false;
  }

  /** While the kid is choosing squares, a tap never walks them off. */
  takeTap(event) {
    if (!this.picking) return false;
    const g = this.g;
    const point = new THREE.Vector3();
    if (!g.ray?.ray?.intersectPlane(g.groundPlane, point)) return true;
    const cell = cellAt(g.world, point.x, -point.z);
    this.onCell(cell.key);
    return true;
  }

  onCell(key) {
    const p = this.picking;
    if (!p || !this.grass(key)) { this.g.toast?.('That needs to be grass.'); return; }
    if (p.mode === 'build') {
      const spot = footprintKeys(key, p.size || [1, 1], 0);
      if (!spot || spot.keys.some(k => !this.grass(k) || this.state()?.cells?.[k]?.soil)) {
        this.g.toast?.('The whole building needs open grass. Tap another square.');
        return;
      }
      p.spot = spot;
      p.keys = spot.keys;
      this.paint(spot.keys);
    } else {
      const cap = p.cap || GARDEN_CAP;
      const next = toggleKey(p.keys, key, cap);
      if (next.length === p.keys.length && !p.keys.includes(key)) this.g.toast?.(p.mode === 'fence' ? `${cap} fence squares is the most.` : `${cap} squares is the most.`);
      p.keys = next;
      this.paint(p.mode === 'build' ? (p.spot?.keys || []) : next);
    }
    this.g.notify?.();
  }

  paint(keys) {
    const g = this.g;
    if (!g?.scene) return;
    if (!this.group) {
      this.group = new THREE.Group();
      this.group.name = 'SiteAsk';
      g.scene.add(this.group);
      this.geo = new THREE.PlaneGeometry(TILE, TILE);
      this.mat = new THREE.MeshBasicMaterial({ color: 0xb7e7a2, transparent: true, opacity: 0.72, depthWrite: false });
    }
    while (this.group.children.length) this.group.remove(this.group.children[0]);
    for (const key of keys || []) {
      const p = cellFromKey(g.world, key);
      const mesh = new THREE.Mesh(this.geo, this.mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(p.x, heightAt(g.world, p.x, p.y) + 0.07, -p.y);
      this.group.add(mesh);
    }
  }

  update() {
    if (this.state()?.night && (this.open || this.picking)) { this.open = null; this.picking = null; this.paint([]); this.g.notify?.(); }
    if (!this.picking && this.group?.children.length) this.paint([]);
  }

  dispose() {
    if (this.group) this.g.scene?.remove(this.group);
    this.geo?.dispose();
    this.mat?.dispose();
    this.group = null;
  }
}
