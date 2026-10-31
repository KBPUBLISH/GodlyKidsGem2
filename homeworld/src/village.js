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
import { villagePlan, villageNeeds, skillXp, focusSatisfied } from './settlement.mjs';
import { checkIn, speakRefusal, campSite } from './foreman-check.mjs';
import { isStructure } from './build-ask.mjs';

const SCAN_MS = 4500;

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
    this.foremanTold = {};
  }

  /** The kid's build goal, if any, is the focus the planner honours first. */
  focus() { return this.g.goal?.kind || null; }

  /** Snapshot for the plan card. */
  plan() { const s = this.g.store?.state; return s ? villagePlan(s, this.focus()) : null; }
  /** Cached needs for chores (refreshed every scan). */
  needs() { return this.lastNeeds; }

  active() {
    const g = this.g, s = g.store?.state;
    return !!(s && g.loaded && g.helpersLive && !g.ambient && !s.night && !g.store.locked);
  }

  update() {
    const g = this.g;
    if (!this.active()) return;
    const now = performance.now();
    if (now - this.lastScan < SCAN_MS) return;
    this.lastScan = now;
    const s = g.store.state, min = gameTime(s), { hour } = timeLabel(min);
    // A finished pin (one Prayer Tent is the whole camp goal) must not keep placing copies.
    if (focusSatisfied(s, this.focus())) g.clearGoal?.();
    this.lastNeeds = villageNeeds(s, this.focus());
    const goal = this.lastNeeds.goal;
    this.announce(s);
    if (!goal || hour < 6.5 || hour >= 20) return;
    if (goal.blocked) { this.tellOnce(`blocked:${goal.kind}`, `${goal.name}: ${goal.blocked}`); return; }
    if (goal.underway) return;
    if ((goal.have || 0) >= (goal.count || 1)) return;
    // One Prayer Tent (placed, walking, or finished) completes that goal. Do not queue another.
    if (buildingById(goal.kind)?.once && activeBuildings(s).some((b) => b.kind === goal.kind)) {
      if (this.focus() === goal.kind) g.clearGoal?.();
      return;
    }
    if (!goal.ready) { this.candidates = null; return; }
    // The one small-build slot stays with Adam until the stable has a fence. A new hut can wait.
    if (this.paddockWaiting(s)) return;
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

  /** The one row slot the foreman already approved. Not a search for the nearest grass. */
  buildCandidates(s, kind) {
    const spot = campSite(s, this.g.world, kind);
    if (!spot?.ok || !spot.key) return [];
    return [{ kind, key: spot.key, rotation: spot.rotation ?? 0, d: 0 }];
  }

  tryPlace(s, goal) {
    const g = this.g, helpers = this.freeHelpers(s);
    if (!helpers.length) { this.tellOnce(`nohelp:${goal.kind}`, `Everyone is busy, so nobody can start the ${goal.name} yet.`); return; }
    const crew = this.crewFor(s, goal.kind, helpers);
    if (crew === null) { this.tellOnce(`crew:${goal.kind}`, `The ${goal.name} needs ${projectPlan(goal.kind).crew} builders free at once.`); return; }
    const noah = g.buildAsk?.bySkill?.('woodcutter');
    const builder = (noah && helpers.includes(noah)) ? noah : helpers[0], home = builder.userData;
    const head = checkIn(s, { who: home.id, brain: 'builder', intent: { action: 'build', kind: goal.kind }, world: g.world });
    if (!head.ok) { speakRefusal(g, this.foremanTold, home.id, home.name, head); return; }
    const saved = isStructure(goal.kind) ? g.buildAsk?.buildingSite?.(goal.kind, s) : null;
    if (saved?.placedId && activeBuildings(s).some((b) => b.id === saved.placedId)) return;
    if (saved && g.buildAsk?.siteClearChore?.(noah?.userData || home, s)) return;
    const plan = saved ? { kind: goal.kind, key: saved.key, rotation: saved.rotation || 0 } : head.site;
    const waited = { ok: false, reason: 'No room in the row yet', instead: 'No room in the row yet' };
    if (!plan?.key) { speakRefusal(g, this.foremanTold, home.id, home.name, waited); return; }
    const min = gameTime(s);
    const ground = saved ? { ...s, player: { x: home.x, y: home.y } } : s;
    if (!buildSiteStatus(g.world, ground, { kind: plan.kind, key: plan.key, rotation: plan.rotation }, min).ok) {
      if (!saved) speakRefusal(g, this.foremanTold, home.id, home.name, waited);
      return;
    }
    const id = `village:${goal.kind}:${Date.now().toString(36)}`;
    const before = g.store.state;
    try {
      g.store.commitAs(home.id, home.name, { x: home.x, y: home.y }, { type: 'place_building', id, kind: plan.kind, key: plan.key, rotation: plan.rotation, crew, actionId: `helper:${home.id}:place:${Date.now()}` });
    } catch (e) { g.toast(e.message); return; }
    if (g.store.state === before) { speakRefusal(g, this.foremanTold, home.id, home.name, waited); return; }
    this.candidates = null;
    if (saved) {
      const next = g.store.state, sites = { ...(next.village?.buildSites || {}), [goal.kind]: { ...saved, placedId: id } };
      try { g.store.save({ ...next, village: { ...(next.village || {}), buildSites: sites } }); } catch { /* the building still stands */ }
    }
    const placed = g.store.state.buildings.find((b) => b.id === id);
    if (!placed?.project && home.chore) { g.residents.claims.delete(home.chore.key); home.chore = null; home.strollState = { wait: 0 }; g.residents.lastChoreScan = 0; }
    g.refreshDynamic?.();
    g.residents?.reelEvent?.(builder);
    g.toast(placed?.project ? `${home.name} marked out a ${goal.name} and the crew is getting to work.` : `${home.name} is going to build a ${goal.name} for the village.`, 4500);
    g.notify?.();
  }

  tryUpgrade(s, goal) {
    const g = this.g, helpers = this.freeHelpers(s);
    if (!helpers.length) return;
    const crew = this.crewFor(s, goal.kind, helpers);
    if (crew === null) { this.tellOnce(`crew:${goal.kind}`, `The ${goal.name} needs ${projectPlan(goal.kind).crew} builders free at once.`); return; }
    const home = helpers[0].userData;
    const head = checkIn(s, { who: home.id, brain: 'builder', intent: { action: 'upgrade', kind: goal.kind } });
    if (!head.ok) { speakRefusal(g, this.foremanTold, home.id, home.name, head); return; }
    const before = g.store.state;
    try {
      g.store.commitAs(home.id, home.name, { x: home.x, y: home.y }, { type: 'upgrade_building', id: goal.upgradeId, kind: goal.kind, crew, actionId: `helper:${home.id}:upgrade:${Date.now()}` });
    } catch (e) { g.toast(e.message); return; }
    if (g.store.state === before) { this.tellOnce(`upg:${goal.upgradeId}`, `${home.name} wants to upgrade the ${buildingById(goal.upgradeFrom)?.name || 'home'} but cannot start yet.`); return; }
    g.refreshDynamic?.();
    g.residents?.reelEvent?.(helpers[0]);
    g.toast(`${home.name} is upgrading the ${buildingById(goal.upgradeFrom)?.name || 'home'} into a ${goal.name}.`, 4500);
    g.notify?.();
  }

  /** A stable is up and the paddock ring is still open, so Adam should be fencing, not starting a house. */
  paddockWaiting(s) {
    const farmer = this.g.farmer;
    if (!farmer?.stables?.(s)?.length) return false;
    const st = farmer.status?.(s);
    return !!(st && !st.fenced);
  }

  /** A queued or half-built small building that no one (and not the kid) is on. */
  openBuild(s) {
    const g = this.g;
    return activeBuildings(s).find((b) => b.status !== 'complete' && !b.project && g.action?.id !== b.id && g.order?.id !== b.id && !(buildingById(b.kind)?.once && activeBuildings(s).some((o) => o.id !== b.id && o.kind === b.kind && (o.status === 'complete' || o.status === 'building')))) || null;
  }

  /** Work for the plan card: what each friend is doing right now. */
  snapshot() {
    const g = this.g, needs = this.lastNeeds;
    return { goal: needs.goal ? { kind: needs.goal.kind, name: needs.goal.name, ready: needs.goal.ready, blocked: needs.goal.blocked, missing: needs.goal.missing, underway: needs.goal.underway } : null, needs: { wood: needs.wood, stone: needs.stone, fish: needs.fish }, stage: this.lastPlan?.stage || null, farm: g.farmer?.foremanContext?.() || null, garden: g.gardenKeeper?.foremanContext?.() || null, tasks: g.buildAsk?.savedTasks?.() || [] };
  }
}
