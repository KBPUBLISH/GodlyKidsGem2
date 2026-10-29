/**
 * The village foreman: the friends keep building the island up on their own while the kid plays.
 *
 * Every few seconds, in daylight, it reads the settlement plan (settlement.mjs), and when the next
 * goal has its materials, a free friend places it near the camp (or upgrades the old home) through
 * the ordinary reducer actions, as if they had pressed the buttons themselves. Project builds then
 * run on the crew simulation; smaller builds become a 'build' chore any free friend walks over to.
 * The kid sways what comes next by setting a build goal (g.setGoal) from the catalogue.
 */
import { gameTime, buildSiteStatus, timeLabel } from './core.mjs';
import { buildingById, activeBuildings, footprint, workPoint, BUILD_ENERGY } from './building.mjs';
import { projectPlan, assignedProject } from './project-rules.mjs';
import { energyFor } from './nutrition.mjs';
import { villagePlan, villageNeeds, skillXp } from './settlement.mjs';

const SCAN_MS = 4500, ATTEMPTS_PER_TICK = 2, RING_CELLS = 16;

export class Village {
  constructor(game) {
    this.g = game;
    this.lastScan = 0;
    this.lastPlan = null;
    this.lastNeeds = { wood: 0, stone: 0, fish: 0, goal: null };
    this.candidates = null;      // site search cursor for the current goal
    this.candidateKey = null;
    this.toldBlocked = null;
    this.announcedStage = null;
  }

  /** The kid's build goal, if any, is the focus the planner honours first. */
  focus() { return this.g.goal?.kind || null; }

  /** Snapshot for the plan card. */
  plan() { const s = this.g.store?.state; return s ? villagePlan(s, this.focus()) : null; }
  /** Cached needs for chores (refreshed every scan). */
  needs() { return this.lastNeeds; }

  active() {
    const g = this.g, s = g.store?.state;
    return !!(s && g.loaded && g.playersOnly && !g.ambient && !s.night && !g.store.locked);
  }

  update() {
    const g = this.g;
    if (!this.active()) return;
    const now = performance.now();
    if (now - this.lastScan < SCAN_MS) return;
    this.lastScan = now;
    const s = g.store.state, min = gameTime(s), { hour } = timeLabel(min);
    this.lastNeeds = villageNeeds(s, this.focus());
    const goal = this.lastNeeds.goal;
    this.announce(s);
    if (!goal || hour < 6.5 || hour >= 20) return;
    if (goal.blocked) { this.tellOnce(`blocked:${goal.kind}`, `${goal.name}: ${goal.blocked}`); return; }
    if (goal.underway) return;
    if (!goal.ready) { this.candidates = null; return; }
    if (activeBuildings(s).some((b) => b.status !== 'complete' && !b.project)) return; // one small build at a time, like the player
    if (goal.upgradeId) { this.tryUpgrade(s, goal); return; }
    this.tryPlace(s, goal);
  }

  announce(s) {
    const plan = villagePlan(s, this.focus());
    this.lastPlan = plan;
    const id = plan.stage.id;
    if (this.announcedStage === null) { this.announcedStage = id; return; }
    if (this.announcedStage !== id) {
      this.announcedStage = id;
      this.g.toast(`The island is a ${plan.stage.name} now! ${plan.stage.motto}`, 5000);
      this.g.notify?.();
    }
  }

  tellOnce(key, text) {
    if (this.toldBlocked === key) return;
    this.toldBlocked = key;
    this.g.toast(text, 4200);
  }

  /** Friends not being played, awake, not on a project, with energy to build. Best builders first. */
  freeHelpers(s) {
    const g = this.g, out = [];
    for (const [, actor] of g.residents?.models || []) {
      const home = actor.userData, id = home.id;
      if (!id || actor === g.actor || id === s.activeCharacter || !s.characters?.[id] || s.characters[id].sleep || assignedProject(s, id)) continue;
      if (home.job?.explicit || home.onDuty || (home.chore && home.chore.kind === 'build')) continue;
      if (energyFor(s, id) < BUILD_ENERGY) continue;
      if (g.dining?.grilling?.(actor) || (g.dining?.cooking?.() && g.dining.cookActor?.() === actor)) continue;
      out.push(actor);
    }
    return out.sort((a, b) => skillXp(s, b.userData.id, 'building') - skillXp(s, a.userData.id, 'building'));
  }

  crewFor(s, kind, helpers) {
    const plan = projectPlan(kind);
    if (!plan) return undefined;
    const ids = helpers.map((a) => a.userData.id);
    const others = Object.keys(s.characters || {}).filter((id) => !ids.includes(id) && !s.characters[id].sleep && !assignedProject(s, id) && id !== s.activeCharacter);
    const crew = [...ids, ...others];
    if (crew.length < plan.crew && s.activeCharacter && !crew.includes(s.activeCharacter)) crew.push(s.activeCharacter);
    return crew.length >= plan.crew ? crew.slice(0, plan.crew) : null;
  }

  /** Where the village is: the middle of what is built, else where the kid stands. */
  centre(s) {
    const g = this.g, done = activeBuildings(s).filter((b) => b.status === 'complete' && buildingById(b.kind)?.solid);
    if (!done.length) return { x: s.player.x, y: s.player.y };
    let x = 0, y = 0, n = 0;
    for (const b of done) { const fp = footprint(g.world, b); if (!fp) continue; x += fp.center.x; y += fp.center.y; n++; }
    return n ? { x: x / n, y: y / n } : { x: s.player.x, y: s.player.y };
  }

  /** Grid spots in rings around the centre, nearest first, keeping a cell clear of the garden. */
  buildCandidates(s, kind) {
    const g = this.g, world = g.world, c = this.centre(s);
    const col0 = Math.floor(c.x - world.grid.origin[0]), row0 = Math.floor(c.y - world.grid.origin[1]);
    const soil = Object.keys(s.cells || {}).filter((k) => s.cells[k]?.soil).map((k) => k.split(':').map(Number));
    const nearGarden = (fp) => soil.some(([sc, sr]) => sc >= fp.col - 1 && sc <= fp.col + fp.w && sr >= fp.row - 1 && sr <= fp.row + fp.h);
    const out = [];
    for (let dr = -RING_CELLS; dr <= RING_CELLS; dr++) for (let dc = -RING_CELLS; dc <= RING_CELLS; dc++) {
      const d = Math.hypot(dc, dr);
      if (d < 1.5 || d > RING_CELLS) continue;
      out.push({ key: `${col0 + dc}:${row0 + dr}`, d });
    }
    out.sort((a, b) => a.d - b.d);
    const plans = [];
    const rotations = [0, 1, 2, 3];
    for (const o of out) {
      if (!/^\d{1,3}:\d{1,3}$/.test(o.key)) continue;
      for (const rotation of rotations) plans.push({ kind, key: o.key, rotation, d: o.d });
    }
    return plans.filter((p) => { const fp = footprint(world, p); return fp && !nearGarden(fp); });
  }

  tryPlace(s, goal) {
    const g = this.g, helpers = this.freeHelpers(s);
    if (!helpers.length) { this.tellOnce(`nohelp:${goal.kind}`, `Everyone is busy, so nobody can start the ${goal.name} yet.`); return; }
    const crew = this.crewFor(s, goal.kind, helpers);
    if (crew === null) { this.tellOnce(`crew:${goal.kind}`, `The ${goal.name} needs ${projectPlan(goal.kind).crew} builders free at once.`); return; }
    const key = `${goal.kind}:${s.buildings?.length || 0}:${Object.keys(s.cells || {}).length}`;
    if (this.candidateKey !== key || !this.candidates) { this.candidateKey = key; this.candidates = this.buildCandidates(s, goal.kind); }
    const min = gameTime(s), builder = helpers[0], home = builder.userData;
    let attempts = 0;
    while (this.candidates.length && attempts < ATTEMPTS_PER_TICK) {
      const plan = this.candidates.shift();
      const site = buildSiteStatus(g.world, s, plan, min);
      if (!site.ok) continue;
      attempts++;
      const id = `village:${goal.kind}:${Date.now().toString(36)}`;
      const before = g.store.state;
      try {
        g.store.commitAs(home.id, home.name, { x: home.x, y: home.y }, { type: 'place_building', id, kind: plan.kind, key: plan.key, rotation: plan.rotation, crew, actionId: `helper:${home.id}:place:${Date.now()}` });
      } catch (e) { g.toast(e.message); return; }
      if (g.store.state === before) continue;
      this.candidates = null;
      this.toldBlocked = null;
      const placed = g.store.state.buildings.find((b) => b.id === id);
      if (!placed?.project && home.chore) { g.residents.claims.delete(home.chore.key); home.chore = null; home.strollState = { wait: 0 }; g.residents.lastChoreScan = 0; }
      g.refreshDynamic?.();
      g.residents?.reelEvent?.(builder);
      g.toast(placed?.project ? `${home.name} marked out a ${goal.name} and the crew is getting to work.` : `${home.name} is going to build a ${goal.name} for the village.`, 4500);
      g.notify?.();
      return;
    }
    if (!this.candidates.length) { this.candidates = null; this.tellOnce(`site:${goal.kind}`, `Nobody can find a flat spot for the ${goal.name} near camp. Clearing trees or stumps would help.`); }
  }

  tryUpgrade(s, goal) {
    const g = this.g, helpers = this.freeHelpers(s);
    if (!helpers.length) return;
    const crew = this.crewFor(s, goal.kind, helpers);
    if (crew === null) { this.tellOnce(`crew:${goal.kind}`, `The ${goal.name} needs ${projectPlan(goal.kind).crew} builders free at once.`); return; }
    const home = helpers[0].userData, before = g.store.state;
    try {
      g.store.commitAs(home.id, home.name, { x: home.x, y: home.y }, { type: 'upgrade_building', id: goal.upgradeId, kind: goal.kind, crew, actionId: `helper:${home.id}:upgrade:${Date.now()}` });
    } catch (e) { g.toast(e.message); return; }
    if (g.store.state === before) { this.tellOnce(`upg:${goal.upgradeId}`, `${home.name} wants to upgrade the ${buildingById(goal.upgradeFrom)?.name || 'home'} but cannot start yet.`); return; }
    g.refreshDynamic?.();
    g.residents?.reelEvent?.(helpers[0]);
    g.toast(`${home.name} is upgrading the ${buildingById(goal.upgradeFrom)?.name || 'home'} into a ${goal.name}.`, 4500);
    g.notify?.();
  }

  /** A queued or half-built small building that no one (and not the kid) is on. */
  openBuild(s) {
    const g = this.g;
    return activeBuildings(s).find((b) => b.status !== 'complete' && !b.project && g.action?.id !== b.id && g.order?.id !== b.id) || null;
  }

  /** Work for the plan card: what each friend is doing right now. */
  snapshot() {
    const g = this.g, needs = this.lastNeeds;
    return { goal: needs.goal ? { kind: needs.goal.kind, name: needs.goal.name, ready: needs.goal.ready, blocked: needs.goal.blocked, missing: needs.goal.missing, underway: needs.goal.underway } : null, needs: { wood: needs.wood, stone: needs.stone, fish: needs.fish }, stage: this.lastPlan?.stage || null };
  }
}
