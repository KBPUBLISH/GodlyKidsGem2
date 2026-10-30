// Abel's saved garden outline. Pure shape rules live in garden-plan.mjs.
// He fences this ring and plants these tiles. A new outline is a new ask.
import { cellFromKey, gameTime, timeLabel, terrainType } from './core.mjs';
import { activeBuildings, footprint } from './building.mjs';
import { isOutlineDone, wantsGardenAsk } from './garden-plan.mjs';
import { gardenPlanFromTaps } from './build-ask.mjs';

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

  patch(outline) {
    const s = this.state();
    if (!s || !this.g.store) return;
    const garden = { ...(s.village?.garden || {}), playerOutline: outline };
    try { this.g.store.save({ ...s, village: { ...(s.village || {}), garden } }); }
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
    this.patch(plan);
    return plan;
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
    if (!s || !outline || !this.g.gardenKeeper?.isKeeper?.(home)) return null;
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
    if (!outline || !this.g.gardenKeeper?.isKeeper?.(home)) return [];
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
}
