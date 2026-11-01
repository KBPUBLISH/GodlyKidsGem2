// One "show me where" card for Abel, Noah, and Adam.
// Harvesting, planting, weeds, firewood, fishing, feeding, and ordinary chopping never come through here.
// Eve's meal card stays in dining.js.
import * as THREE from 'three';
import { cellAt, cellFromKey, gameTime, heightAt, terrainType, activeTrees, activeStumps } from './core.mjs';
import { skillFor } from './character-skills.mjs';
import { buildingById, woodTotal } from './building.mjs';
import { fenceGaps } from './farm-rules.mjs';
import { gardenPreset, placeGardenPreset } from './garden-presets.mjs';
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
    if (!s || s.night || !spec?.id || s.village?.siteDraft) return false;
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

  startGardenPreset(id) {
    const preset = gardenPreset(id), s = this.state();
    if (!preset || !s) return false;
    if (this.g.gardenPlan?.active?.(s)) { this.g.toast?.('Finish the active garden preset before placing another.'); return false; }
    const crew = [...(this.g.residents?.models?.values() || [])].map(actor => actor.userData?.residentId).filter(Boolean);
    if (crew.length < preset.friends) {
      this.g.toast?.(`${preset.name} needs ${preset.friends} friends ashore. You have ${crew.length}.`, 4600);
      return false;
    }
    const sample = placeGardenPreset(id, '0:0');
    if (preset.fenced && woodTotal(s) < sample.wood) {
      this.g.toast?.(`${preset.name} needs ${sample.wood} wood for its fence posts. You have ${woodTotal(s)}.`, 4800);
      return false;
    }
    this.open = null;
    this.picking = { id: `preset:${id}`, mode: 'gardenPreset', presetId: id, name: preset.name, crew: crew.slice(0, preset.friends), keys: [], plan: null };
    this.paint([]);
    this.g.enterSiteView?.();
    this.g.notify?.();
    return true;
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
    if (p.mode === 'gardenPreset') {
      return {
        name: p.name,
        text: p.plan ? `The garden covers these squares. Place ${p.name}?` : 'Drag over open grass to position this garden.',
        picking: true,
        goLabel: 'Place this garden',
        waitLabel: 'Not now',
        goEnabled: !!p.plan,
      };
    }
    if (p.mode === 'build') {
      const name = p.buildingName || 'building';
      return {
        name: p.name,
        text: p.spot ? `The ${name} sits on the green squares. Build it here?` : `Tap the grass to place the ${name}. The arrows slide the view.`,
        picking: true,
        goLabel: 'Build it here',
        waitLabel: 'Not now',
        goEnabled: !!p.spot,
      };
    }
    const n = p.keys.length, cap = p.cap || GARDEN_CAP;
    return {
      name: p.name,
      text: `Tap the grass. The arrows slide the view. ${n}/${cap}`,
      picking: true,
      goLabel: p.mode === 'fence' ? "That's the fence" : "That's the garden",
      waitLabel: 'Not now',
      goEnabled: n > 0,
    };
  }

  show() {
    if (this.picking) { this.picking = { ...this.picking }; this.open = null; this.g.enterSiteView?.(); this.g.notify?.(); return; }
    if (!this.open) return;
    const spec = this.open;
    this.open = null;
    this.picking = { ...spec, keys: [], spot: null };
    this.paint([]);
    this.g.enterSiteView?.();
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
    this.clearDraft();
    this.g.leaveSiteView?.();
    this.g.notify?.();
  }

  confirm() {
    const p = this.picking;
    if (!p) return;
    if (p.mode === 'gardenPreset') {
      if (!p.plan) return;
      const saved = this.g.gardenPlan?.commitPreset(p.plan, p.crew);
      if (!saved) return;
      this.g.toast?.(`${p.crew.length} friends will plow, plant${p.plan.fenced?', and fence':''} this garden.`, 4400);
    } else if (p.mode === 'garden') {
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
    this.g.leaveSiteView?.();
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
    const village = { ...(s.village || {}), buildSites: sites };
    delete village.siteDraft;
    try { this.g.store.save({ ...s, village }); }
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
    const write = (n) => { n.farm.ranch.kidFence = plan; if (n.village?.siteDraft) delete n.village.siteDraft; };
    if (this.g.farmer?.mutate) this.g.farmer.mutate(write, false);
    else try {
      const village = { ...(s.village || {}) };
      delete village.siteDraft;
      this.g.store.save({ ...s, farm: { ...(s.farm || {}), ranch: { ...(s.farm?.ranch || {}), kidFence: plan } }, village });
    } catch (e) { this.g.toast?.(e.message); return false; }
    return true;
  }

  fencePlan(s = this.state()) { return s?.farm?.ranch?.kidFence || null; }

  fenceDone(plan, s = this.state()) {
    if (!plan?.ring?.length || !s) return false;
    if (!this.g.farmer?.stables?.(s)?.length) return false;
    return fenceGaps(plan, s.buildings).length === 0;
  }

  /** The squares the kid marked, still waiting to be finished. The foreman reads this list. */
  savedTasks(s = this.state()) {
    if (!s) return [];
    const tasks = [];
    const outline = this.g.gardenPlan?.active?.(s);
    if (outline?.keys?.length) tasks.push({ id: 'garden', who: 'Abel', label: 'Fence and plant the garden you marked', keys: outline.keys, ring: outline.ring || [], gate: outline.gate || null });
    for (const [kind, site] of Object.entries(s.village?.buildSites || {})) {
      if (!site?.keys?.length) continue;
      const standing = site.placedId && (s.buildings || []).find((b) => b.id === site.placedId);
      if (standing?.status === 'complete') continue;
      tasks.push({ id: `build:${kind}`, who: 'Noah', label: standing ? 'Finish the building on the squares you marked' : 'Clear and build on the squares you marked', kind, keys: site.keys, key: site.key, placedId: site.placedId || null });
    }
    const fence = s.farm?.ranch?.kidFence;
    if (fence?.stable?.key && !this.fenceDone(fence, s)) tasks.push({ id: 'fence', who: 'Adam', label: 'Put the stable and fence where you marked', stable: fence.stable.key, ring: fence.ring || [], gate: fence.gate || null });
    const draft = s.village?.siteDraft;
    if (draft?.keys?.length && !this.picking) tasks.push({ id: 'draft', who: draft.name || 'Friend', label: 'Finish choosing those squares', mode: draft.mode, keys: draft.keys });
    return tasks;
  }

  /** Trees (then the stumps they leave) on a confirmed building site. Not ordinary chopping. */
  siteClearChore(home, s) {
    if (!home || !s) return null;
    const pinned = this.g.goal?.kind || this.g.village?.needs?.()?.goal?.kind;
    let site = pinned ? this.buildingSite(pinned, s) : null;
    if (!site?.keys?.length) {
      const waiting = Object.values(s.village?.buildSites || {}).filter((v) => v?.keys?.length);
      site = waiting.length === 1 ? waiting[0] : null;
    }
    if (!site?.keys?.length) return null;
    if (site.placedId && (s.buildings || []).some((b) => b.id === site.placedId && b.status === 'complete')) return null;
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
    const key = this.eventCell(event);
    if (key) this.onCell(key);
    return true;
  }

  takeDrag(event) {
    if (this.picking?.mode !== 'gardenPreset' || (event.type === 'pointermove' && !event.buttons)) return false;
    const key = this.eventCell(event);
    if (key && key !== this.picking.anchor) {
      this.picking.anchor = key;
      this.onCell(key);
    }
    return true;
  }

  eventCell(event) {
    const g = this.g, rect = g.renderer?.domElement?.getBoundingClientRect?.();
    if (!rect?.width || !rect.height) return null;
    g.mouse.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    g.ray.setFromCamera(g.mouse, g.camera);
    const point = new THREE.Vector3();
    if (!g.ray.ray.intersectPlane(g.groundPlane, point)) return null;
    return cellAt(g.world, point.x, -point.z).key;
  }

  onCell(key) {
    const p = this.picking;
    if (!p || !this.grass(key)) { this.g.toast?.('That needs to be grass.'); return; }
    if (p.mode === 'gardenPreset') {
      const origin = this.g.world?.grid?.origin || [0, 0];
      const player = this.state()?.player || { x: origin[0], y: origin[1] };
      const plan = placeGardenPreset(p.presetId, key, { col: player.x - origin[0], row: player.y - origin[1] });
      const occupied = this.g.gardenPlan?.occupied?.(this.state()) || new Set();
      const all = [...(plan?.keys || []), ...(plan?.ring || [])];
      if (!plan || all.some(k => !this.grass(k) || occupied.has(k) || this.state()?.cells?.[k]?.soil)) {
        this.g.toast?.('The whole preset needs open grass. Drag it to another spot.');
        return;
      }
      p.plan = plan;
      p.keys = plan.keys;
      this.paint(all);
    } else if (p.mode === 'build') {
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
    this.persistDraft();
    this.g.notify?.();
  }

  /** Write the squares the kid just tapped. They stay until the work is finished or the kid says not now. */
  persistDraft() {
    const s = this.state(), p = this.picking;
    if (!s || !p || !this.g.store) return;
    const draft = { id: p.id, mode: p.mode, kind: p.kind || null, name: p.name, buildingName: p.buildingName || null, size: p.size || null, cap: p.cap || null, text: p.text || '', keys: [...(p.keys || [])], spot: p.spot ? { key: p.spot.key, rotation: p.spot.rotation || 0, keys: [...(p.spot.keys || [])] } : null, presetId: p.presetId || null, crew: p.crew || null, plan: p.plan || null };
    try { this.g.store.save({ ...s, village: { ...(s.village || {}), siteDraft: draft } }); }
    catch (e) { this.g.toast?.(e.message); }
  }

  clearDraft() {
    const s = this.state();
    if (!s?.village?.siteDraft || !this.g.store) return;
    const village = { ...s.village };
    delete village.siteDraft;
    try { this.g.store.save({ ...s, village }); }
    catch (e) { this.g.toast?.(e.message); }
  }

  restoreDraft() {
    const draft = this.state()?.village?.siteDraft;
    if (!draft?.mode || !draft.id) return;
    if (this.picking?.id === draft.id && (this.picking.keys || []).join() === (draft.keys || []).join()) return;
    this.open = null;
    this.picking = { ...draft, keys: [...(draft.keys || [])], spot: draft.spot ? { ...draft.spot, keys: [...(draft.spot.keys || [])] } : null };
    this.paint(this.picking.mode === 'build' ? (this.picking.spot?.keys || this.picking.keys) : this.picking.mode === 'gardenPreset' ? [...(this.picking.plan?.keys || []), ...(this.picking.plan?.ring || [])] : this.picking.keys);
    this.g.enterSiteView?.();
    this.g.notify?.();
  }

  /** Drop a build spot only once that building is finished. A cancelled building keeps the squares. */
  releaseFinishedSites() {
    const s = this.state(), sites = s?.village?.buildSites;
    if (!s || !sites || !this.g.store) return;
    let changed = false;
    const next = { ...sites };
    for (const [kind, site] of Object.entries(sites)) {
      if (!site?.placedId) continue;
      const standing = (s.buildings || []).find((b) => b.id === site.placedId);
      if (standing?.status === 'complete') { delete next[kind]; changed = true; }
      else if (!standing) { next[kind] = { ...site, placedId: null }; changed = true; }
    }
    if (!changed) return;
    try { this.g.store.save({ ...s, village: { ...s.village, buildSites: next } }); }
    catch { /* the squares stay until the next visit */ }
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
    const night = !!this.state()?.night;
    if (night) {
      if (this.open) { this.open = null; this.g.notify?.(); }
      if (this.picking) {
        this.persistDraft();
        this.picking = null;
        this.paint([]);
        this.g.leaveSiteView?.();
        this.shelved = true;
        this.g.notify?.();
      }
      return;
    }
    this.releaseFinishedSites();
    this.g.gardenPlan?.refreshDone?.();
    if (!this.restored || this.shelved) {
      this.restored = true;
      this.shelved = false;
      this.restoreDraft();
    }
    if (!this.picking && this.group?.children.length) this.paint([]);
  }

  dispose() {
    if (this.group) this.g.scene?.remove(this.group);
    this.geo?.dispose();
    this.mat?.dispose();
    this.group = null;
  }
}
