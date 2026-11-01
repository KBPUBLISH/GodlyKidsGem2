// Abel's saved garden outline. Pure shape rules live in garden-plan.mjs.
// He fences this ring and plants these tiles. A new outline is a new ask.
import { cellFromKey, gameTime, timeLabel, terrainType } from './core.mjs';
import { activeBuildings, footprint, woodTotal } from './building.mjs';
import { isOutlineDone, wantsGardenAsk } from './garden-plan.mjs';
import { gardenPlanFromTaps } from './build-ask.mjs';
import { FOODS, energyFor } from './nutrition.mjs';

const LOW_CREW_TASK = 'Crew is Low Energy and Low Food';

export class GardenPlan {
  constructor(game) { this.g = game; }

  state() { return this.g.store?.state || null; }

  outline(s = this.state()) { return s?.village?.garden?.playerOutline || null; }

  /** The outline Abel is still fencing and planting, or null. */
  active(s = this.state()) {
    const outline = this.outline(s);
    return outline?.keys?.length && !outline.done ? outline : null;
  }

  grass(key) {
    const world = this.g.world;
    if (!world || !key) return false;
    const p = cellFromKey(world, key);
    return terrainType(world, p.x, p.y) === 2;
  }

  patch(outline, clearDraft = false) {
    const s = this.state();
    if (!s || !this.g.store) return;
    const village = { ...(s.village || {}), garden: { ...(s.village?.garden || {}), playerOutline: outline } };
    if (clearDraft) delete village.siteDraft;
    try { this.g.store.save({ ...s, village }); }
    catch (e) { this.g.toast?.(e.message); }
  }

  /** Drop water, beach, and tiles a building already owns. Keep the kid's order. */
  commit(keys) {
    const s = this.state(), world = this.g.world;
    if (!s || !world) return null;
    const taken = this.occupied(s);
    const plots = [];
    for (const key of keys || []) {
      if (!this.grass(key) || taken.has(key) || s.cells?.[key]?.soil) continue;
      if (!plots.includes(key)) plots.push(key);
    }
    if (!plots.length) return null;
    const origin = world.grid.origin;
    const centre = s.player || { x: origin[0], y: origin[1] };
    const toward = { col: centre.x - origin[0], row: centre.y - origin[1] };
    const plan = gardenPlanFromTaps(plots, toward);
    plan.ring = (plan.ring || []).filter(k => this.grass(k) && !taken.has(k) && !s.cells?.[k]?.soil);
    if (plan.gate && !plan.ring.includes(plan.gate)) plan.gate = plan.ring[0] || null;
    this.patch(plan, true);
    return plan;
  }

  commitPreset(plan, crew) {
    const s = this.state();
    if (!s || !plan?.keys?.length) return null;
    const ids = [...new Set((crew || []).filter(Boolean))];
    if (ids.length < plan.requiredFriends) {
      this.g.toast?.(`${plan.name} needs ${plan.requiredFriends} friends ashore.`);
      return null;
    }
    if (plan.fenced && woodTotal(s) < plan.wood) {
      this.g.toast?.(`${plan.name} needs ${plan.wood} wood for its fence posts. You have ${woodTotal(s)}.`, 4800);
      return null;
    }
    const taken = this.occupied(s), all = [...plan.keys, ...(plan.ring || [])];
    if (all.some(key => !this.grass(key) || taken.has(key) || s.cells?.[key]?.soil)) {
      this.g.toast?.('The whole preset needs open grass.');
      return null;
    }
    const outline = {
      ...plan,
      foreman: { kind: 'gardenPreset', presetId: plan.presetId, crew: ids.slice(0, plan.requiredFriends), requiredFriends: plan.requiredFriends },
      done: false,
    };
    this.patch(outline, true);
    return outline;
  }

  workerIds(outline = this.active()) { return outline?.foreman?.crew || []; }

  allowsWorker(home, outline = this.active()) {
    if (!outline?.foreman) return this.g.gardenKeeper?.isKeeper?.(home) || false;
    return this.workerIds(outline).includes(home?.residentId || home?.id);
  }

  crewBlocked(s = this.state(), outline = this.active(s)) {
    if (!s || !outline?.foreman) return false;
    const noFood = !Object.keys(FOODS).some(id => (s.inventory?.[id] || 0) > 0);
    const lowEnergy = this.workerIds(outline).some(id => energyFor(s, id) <= 20);
    return noFood || lowEnergy;
  }

  syncCrewSafety() {
    const s = this.state(), outline = this.active(s);
    if (!s || !outline?.foreman || !this.g.store) return false;
    const blocked = this.crewBlocked(s, outline), wasBlocked = !!outline.pausedForCrewCare;
    const hasTask = s.village?.garden?.lowEnergyTask?.title === LOW_CREW_TASK;
    if (blocked === wasBlocked && hasTask === blocked) return blocked;
    const nextOutline = { ...outline, pausedForCrewCare: blocked };
    const garden = { ...(s.village?.garden || {}), playerOutline: nextOutline };
    if (blocked) garden.lowEnergyTask = { id: 'garden-crew-care', title: LOW_CREW_TASK };
    else delete garden.lowEnergyTask;
    try { this.g.store.save({ ...s, village: { ...(s.village || {}), garden } }); }
    catch (e) { this.g.toast?.(e.message); return blocked; }
    if (blocked && !wasBlocked) {
      const ids = new Set(this.workerIds(outline));
      for (const actor of this.g.residents?.models?.values() || []) {
        const home = actor.userData, chore = home?.chore;
        if (ids.has(home?.residentId || home?.id) && ['plow', 'plant', 'gardenWork'].includes(chore?.kind)) {
          this.g.residents?.claims?.delete(chore.key);
          home.chore = null;
        }
      }
      this.g.toast?.(`${LOW_CREW_TASK}. Garden work is paused.`, 5200);
    }
    else if (!blocked && wasBlocked) this.g.toast?.('The garden crew is ready to work again.', 3600);
    return blocked;
  }

  occupied(s) {
    const set = new Set();
    for (const b of activeBuildings(s)) {
      const fp = footprint(this.g.world, b);
      if (!fp) continue;
      for (const key of fp.keys) set.add(key);
    }
    return set;
  }

  planted(s) {
    const set = new Set();
    for (const [key, cell] of Object.entries(s?.cells || {})) if (cell?.seed) set.add(key);
    return set;
  }

  fenced(s) {
    const set = new Set();
    for (const b of activeBuildings(s)) {
      if (b.status !== 'complete' || (b.kind !== 'fence' && b.kind !== 'brick_fence')) continue;
      const fp = footprint(this.g.world, b);
      if (fp) for (const key of fp.keys) set.add(key);
    }
    return set;
  }

  /** Mark the outline finished once it is planted and the fence is up. */
  refreshDone() {
    const s = this.state(), outline = this.outline(s);
    if (!s || !outline?.keys?.length || outline.done) return false;
    if (!isOutlineDone(outline, this.planted(s), this.fenced(s))) return false;
    this.patch({ ...outline, done: true });
    const name = this.g.gardenKeeper?.keeperName?.() || 'Abel';
    this.g.toast?.(`${name} finished that patch of garden.`, 4200);
    return true;
  }

  wantsAsk() {
    this.refreshDone();
    const s = this.state();
    if (!s) return false;
    const { hour } = timeLabel(gameTime(s));
    const status = this.g.gardenKeeper?.status;
    return wantsGardenAsk({
      outline: this.outline(s),
      plots: status?.plots || 0,
      planted: status?.planted || 0,
      night: !!s.night,
      hour,
    });
  }

  /** The next fence post of this outline, as a gardenWork chore Abel already knows how to finish. */
  fenceChore(home) {
    const s = this.state(), outline = this.active(s);
    if (!s || !outline || !outline.fenced || !this.allowsWorker(home, outline) || this.crewBlocked(s, outline)) return null;
    const posts = this.fenced(s);
    const key = (outline.ring || []).find(k => k !== outline.gate && !posts.has(k));
    if (!key) return null;
    return {
      kind: 'gardenWork',
      key: `garden:${key}`,
      requestId: 'outline',
      request: { id: 'outline', kind: 'fence', side: null, tiles: outline.ring },
      tileKey: key,
      place: { kind: 'fence', key, stroke: true },
      target: cellFromKey(this.g.world, key),
      reach: 1.1,
      label: 'Fencing the garden',
      rank: 0.42,
    };
  }

  /** Abel plants the tiles the kid marked, once they are tilled. Weeding is a different chore. */
  plantChores(home, s, claims) {
    const outline = this.active(s);
    if (!outline || !this.allowsWorker(home, outline) || this.crewBlocked(s, outline)) return [];
    const crop = Object.entries(s.inventory || {}).find(([id, n]) => n > 0 && ['carrot_seed', 'wheat_seed', 'sunflower_seed', 'pumpkin_seed'].includes(id));
    if (!crop) return [];
    const out = [];
    for (const key of outline.keys) {
      const cell = s.cells?.[key];
      if (!cell?.soil || cell.seed || !['tilled', 'harvested'].includes(cell.soil)) continue;
      const claim = `cell:${key}`;
      if (claims?.has(claim)) continue;
      out.push({ kind: 'plant', key: claim, cellKey: key, seed: crop[0], target: cellFromKey(this.g.world, key), reach: .9, label: 'Planting the garden', rank: 1.1 });
    }
    return out.slice(0, 4);
  }

  plowChores(home, s, claims) {
    const outline = this.active(s);
    if (!outline?.foreman || !this.allowsWorker(home, outline) || this.crewBlocked(s, outline)) return [];
    const out = [];
    for (const key of outline.keys) {
      if (!this.grass(key) || s.cells?.[key]?.soil || claims?.has(`cell:${key}`)) continue;
      out.push({ kind: 'plow', key: `cell:${key}`, cellKey: key, target: cellFromKey(this.g.world, key), reach: .9, label: 'Plowing the garden preset', rank: .8, auto: 'plots' });
    }
    return out.slice(0, 4);
  }
}
