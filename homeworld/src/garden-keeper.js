/**
 * The garden keeper: Abel's head for the garden (garden-rules.mjs holds the pure rules, this file acts on them).
 *
 * Abel never builds houses. Fences and scarecrows are the exception: his brain decides the ring, the attacked
 * side, and when wood may become brick, and he places those pieces himself (builderChores → place_building).
 * Noah and Adam are not given that work. The list in `state.village.garden.requests` is his own plan, shown
 * on the garden card. Eve plants to the same plan (seedFor / allowsPlant).
 *
 *   state.village.garden = { shape, shapeBy, block, gate, attacks[], requests[] }
 */
import { gameTime, cellFromKey, canPlow, dist, activeTrees, activeStumps, activeRocks, stumpRadius } from './core.mjs';
import { footprint, buildingById, activeBuildings, workPoint } from './building.mjs';
import { toolTier, rockProfile } from './mining.mjs';
import { energyFor } from './nutrition.mjs';
import { skillFor } from './character-skills.mjs';
import { noteEvent } from './island-feed.mjs';
import { gardenFocus, edgeSpawn } from './fencing.mjs';
import { gardenStatus, deriveRequests, planNextPlots, seedForCell, outsideFence, keeperLine, currentPlan, shapeById, SHAPE_IDS, RULES, FENCE_BEFORE_PLOTS, SHAPE_MIN_PLOTS } from './garden-rules.mjs';
import { checkIn, speakRefusal } from './foreman-check.mjs';

const SCAN_MS = 2500;

export class GardenKeeper {
  constructor(game) {
    this.game = game;
    this.status = null;       // last gardenStatus()
    this.requests = [];       // derived requests, highest priority first
    this.lastScan = 0;
    this.lastRevision = -1;
    this.attackDay = null;    // the farm day whose attack we already noticed
    this.nightTarget = null;  // where Abel stands at night
    this.foremanTold = {};
  }

  get world() { return this.game.world; }
  get state() { return this.game.store?.state; }

  /** Abel (or whoever carries the gardener skill) among the island's friends. */
  keeperHome() {
    for (const actor of this.game.residents?.models?.values() || []) {
      const h = actor.userData;
      if (skillFor(h.name)?.id === 'gardener') return h;
    }
    return null;
  }
  keeperName() { return this.keeperHome()?.name || 'Abel'; }

  /** Only the gardener places garden fences and scarecrows. Everyone else, including Noah and Adam, is refused. */
  isKeeper(home) { return skillFor(home?.name)?.id === 'gardener'; }

  /* ---------------------------------------------------------------- persistence */
  garden() { return this.state?.village?.garden || {}; }
  patch(changes) {
    const game = this.game, s = game.store?.state;
    if (!s) return;
    const garden = { ...(s.village?.garden || {}), ...changes };
    try { game.store.save({ ...s, village: { ...(s.village || {}), garden } }, Date.now()); } catch (e) { game.toast?.(e.message); }
  }

  /* ---------------------------------------------------------------- scan */
  /** Called every frame from the world's tick (day and night). Cheap: rescans every few seconds or when the save changed. */
  update() {
    const game = this.game, s = this.state;
    if (!s || !game.loaded || !game.helpersLive) return;
    const now = performance.now();
    if (now - this.lastScan < SCAN_MS && s.revision === this.lastRevision) return;
    this.lastScan = now; this.lastRevision = s.revision;
    this.scan();
  }

  scan() {
    const game = this.game, s = this.state, world = this.world;
    if (!s || !world) return;
    let status;
    try { status = gardenStatus(s, world); } catch (e) { console.warn('garden keeper', e); return; }
    this.status = status;
    if (this.noticeAttack(status)) {
      try { status = gardenStatus(this.state, world); this.status = status; } catch { /* the first reading still stands */ }
    }
    const requests = deriveRequests(status, s, world);
    this.rememberBlock(status);
    this.syncRequests(requests);
    this.requests = requests;
    if (this.game.gardenPlan?.wantsAsk()) this.game.buildAsk?.requestGarden(this.keeperHome());
  }

  /** Keep the block Abel chose so the garden does not wander as trees come down. */
  rememberBlock(status) {
    const g = this.garden(), block = status.plan?.block || null, saved = g.block || null, changes = {};
    const same = JSON.stringify(block) === JSON.stringify(saved);
    if (!same && (block || status.plots < FENCE_BEFORE_PLOTS || status.fencedPct < 100)) changes.block = block;
    if (status.gate && g.gate?.key !== status.gate.key) changes.gate = { key: status.gate.key, side: status.gate.side };
    if (Object.keys(changes).length) this.patch(changes);
  }

  /** Persist the request list (ids, kinds, reasons) and tell the feed when one is new or fulfilled. */
  syncRequests(requests) {
    const old = this.garden().requests || [], oldIds = new Set(old.map((r) => r.id)), newIds = new Set(requests.map((r) => r.id));
    const changed = old.length !== requests.length || requests.some((r) => !oldIds.has(r.id)) || old.some((r) => !newIds.has(r.id));
    if (!changed) return;
    const day = this.status?.day ?? 0, name = this.keeperName();
    for (const r of requests) if (!oldIds.has(r.id) && r.priority >= 60 && !['wood'].includes(r.kind)) this.feed(name, 'garden', `${name} wants ${describe(r)} — ${r.reason}`);
    for (const r of old) {
      if (newIds.has(r.id) || !r.fulfilled) continue;
      const by = this.keeperName();
      this.feed(by, 'build', `${by} finished ${describe(r, true)}!`);
      this.game.toast?.(`${by} finished ${describe(r, true)}!`);
    }
    const kept = requests.map((r) => ({ id: r.id, kind: r.kind, side: r.side || null, tiles: r.tiles, need: r.need, reason: r.reason, rule: r.rule, priority: r.priority, raisedDay: old.find((o) => o.id === r.id)?.raisedDay ?? day }));
    this.patch({ requests: kept });
  }

  /** Abel finished the last tile of a request: mark it so the next sync can say he did. */
  markFulfilled(requestId, by) {
    const list = (this.garden().requests || []).map((r) => (r.id === requestId ? { ...r, fulfilled: { by, at: Date.now() } } : r));
    this.patch({ requests: list });
  }

  /* ---------------------------------------------------------------- night attacks */
  /** Dawn: the night rules wrote farm.lastAttack — log it, say what Abel wants, and let the request priorities follow. */
  noticeAttack(status) {
    const s = this.state, atk = s.farm?.lastAttack, crow = s.farm?.lastCrowAttack;
    const last = atk && (!crow || crow.day <= atk.day) ? atk : crow;
    if (!last || this.attackDay === last.day) return;
    const logged = (this.garden().attacks || []);
    if (logged.some((a) => a.day === last.day && a.kind === last.kind)) { this.attackDay = last.day; return; }
    this.attackDay = last.day;
    const entry = { day: last.day, kind: last.kind, sides: last.sides || [], ate: last.ate || 0, fenceHit: !!last.fenceHit, broke: !!last.broke };
    this.patch({ attacks: [...logged.slice(-9), entry] });
    const name = this.keeperName();
    let line;
    if (last.kind === 'crow') line = `Crows pecked the garden at dawn — ${name} wants a scarecrow.`;
    else if (last.ate) line = `A coyote got into the garden last night — ${name} wants a fence.`;
    else if (last.broke) line = `A coyote broke through the garden fence last night — ${name} wants it fixed, stronger this time.`;
    else if (last.fenceHit) line = `A coyote rattled the garden fence last night. The fence held — ${name} is glad of it.`;
    if (line) { this.feed(name, 'guard', line); this.game.toast?.(line, 2600); }
    return true;
  }

  /**
   * Night: the gardener runs to the garden, then chases a coyote back to the edge. Returns true while he is on it
   * (the caller skips its idle).
   */
  nightWatch(actor, dt, residents) {
    const game = this.game, s = this.state, home = actor?.userData;
    if (!s?.night || !home || skillFor(home.name)?.id !== 'gardener') return false;
    const coyotes = (s.animals || []).filter((a) => a.wild && a.kind === 'coyote');
    if (!coyotes.length) { home.nightPath = null; return false; }
    const focus = gardenFocus(this.world, s), here = { x: home.x, y: home.y };
    const coyote = coyotes.slice().sort((a, b) => dist(here, a) - dist(here, b))[0];
    const atGarden = dist(here, focus) <= 2.6, onThem = dist(here, coyote) <= 2.8;
    // Run to the rows first, then at the animal, and shoo it back to the edge once he is close.
    if (atGarden || onThem) this.shooCoyote(coyote, focus);
    const dest = !atGarden && dist(here, coyote) > 3.2 ? focus : coyote;
    if (dist(here, dest) > .7) {
      const stale = !home.nightPath?.length || dist(home.nightPath[home.nightPath.length - 1], dest) > 1.4;
      if (stale) home.nightPath = game.nav?.path(here, dest) || game.nav?.approach(here, dest, .5) || [];
      if (home.nightPath.length) { residents.walkAlong(actor, home.nightPath, 2.6, dt); return true; }
      return false;
    }
    home.nightPath = null;
    actor.rotation.y = Math.atan2(coyote.x - here.x, -(coyote.y - here.y));
    return true;
  }

  /** Push one coyote off the crops and out to the edge it came from. A second look, once it is far, sends it away. */
  shooCoyote(coyote, focus) {
    const s = this.state; if (!s || !coyote) return;
    const far = dist(coyote, focus) > 16;
    const side = coyote.x >= focus.x ? 1 : -1;
    const edge = edgeSpawn(this.world, focus, side);
    const animals = (s.animals || []).flatMap((a) => {
      if (a.id !== coyote.id) return [a];
      if (far) return [];
      if (a.flee) return [a];
      return [{ ...a, flee: true, x: edge.x, y: edge.y }];
    });
    const same = animals.length === (s.animals || []).length && animals.every((a, i) => a === s.animals[i]);
    if (same) return;
    try { this.game.store.save({ ...s, animals }, Date.now()); } catch (e) { this.game.toast?.(e.message); }
    if (!animals.some((a) => a.id === coyote.id)) this.game.toast?.(`${this.keeperName()} chased a coyote away from the garden.`, 2200);
  }

  /* ---------------------------------------------------------------- the gardener's own work */
  /** Tiles the gardener tills next, or null to let the old "beside the garden" rule run (no plan yet). */
  plowTargets(s) {
    const outline = this.game.gardenPlan?.active(s);
    if (this.game.gardenPlan) {
      if (!outline?.keys?.length) return [];
      const home = this.keeperHome();
      const gate = checkIn(s, { who: home?.id || 'abel', brain: 'gardener', intent: { action: 'tend', maintenance: true } });
      if (!gate.ok) return [];
      return outline.keys.filter((k) => canPlow(this.world, s, k) && !s.cells?.[k]?.soil);
    }
    if (!this.status) return null;
    try {
      const plan = planNextPlots(s, this.world, this.status);
      const tiles = plan.tiles.map((t) => t.key).filter((k) => canPlow(this.world, s, k));
      if (!tiles.length) return tiles;
      const home = this.keeperHome();
      const gate = checkIn(s, { who: home?.id || 'abel', brain: 'gardener', intent: { action: 'expand' } });
      if (!gate.ok) { speakRefusal(this.game, this.foremanTold, home?.id || 'abel', home?.name || 'Abel', gate); return []; }
      return tiles;
    } catch { return null; }
  }
  /** Why the garden is not growing right now (card + Abel's line), or null. */
  growthBlocked(s = this.state) {
    if (!this.status || !s) return null;
    try { return planNextPlots(s, this.world, this.status).blocked; } catch { return null; }
  }
  /** The seed Eve puts in a cell so the heart/smiley reads from above, or null for her usual pick. */
  seedFor(key, available) { try { return seedForCell(this.state, key, available); } catch { return null; } }
  /** Eve never plants outside the ring once there is one. */
  outsideFence(key) { return outsideFence(this.status, key); }
  /** residents.js: may Eve plant this tilled cell? Inside the fence once a ring exists; anywhere tilled before that. */
  allowsPlant(key) { return !this.outsideFence(key); }
  /**
   * Between meals Eve plants only inside the plan: plots the garden already has, or the next row Abel
   * marked out. Once a fence ring is closed she also stays inside it.
   */
  allowsPlant(key) {
    const outline = this.game.gardenPlan?.active();
    if (outline) return outline.keys.includes(key);
    if (this.state?.cells?.[key]?.soil) return !this.outsideFence(key);
    return false;
  }

  /* ---------------------------------------------------------------- Abel's own building */
  /**
   * Abel's idle work, highest-priority request first. Noah, Adam, and every other friend get nothing here.
   *   fence/gate/scarecrow/path → { kind:'gardenWork', ... place:{kind,key,stroke} } via place_building
   *   unfence                   → { kind:'gardenWork', remove:buildingId }
   *   clear / wood              → he chops or digs a little himself, or the request stays until wood is in the store
   */
  builderChores(home, s, here, claims) {
    if (!this.isKeeper(home) || s.night) return [];
    if (energyFor(s, home.id) < 12) return [];
    const game = this.game, world = this.world, out = [], free = (key) => !claims?.has(key);
    const busyId = game.order?.id || game.action?.id || null;
    // A gate stone Abel started (timed piece) is finished by him first — it would otherwise block every other placement.
    const ours = activeBuildings(s).find((b) => b.status !== 'complete' && !b.project && /^garden-/.test(b.id));
    if (ours && free(`build:${ours.id}`)) return [{ kind: 'build', key: `build:${ours.id}`, buildingId: ours.id, target: workPoint(world, ours), reach: .6, label: 'Making the garden gate', rank: 1 }];
    // One stroke piece at a time: the reducer refuses a new placement while another unfinished non-project building exists.
    const queuedElsewhere = activeBuildings(s).some((b) => b.status !== 'complete' && !b.project);
    for (const r of this.requests) {
      if (r.rule === 'room_to_grow' && this.game.gardenPlan) continue;
      // Attacked sides (and the chopping they are waiting on) beat watering. Comfort asks wait their turn.
    const rank = r.priority >= 100 ? 0.45 : 1 + Math.max(0, (120 - r.priority) / 40);
      const project = gardenProject(this.status, r);
      if (project) {
        const gate = checkIn(s, { who: home.id, brain: 'gardener', intent: project });
        if (!gate.ok) { speakRefusal(game, this.foremanTold, home.id, home.name, gate); continue; }
      }
      if (r.kind === 'fence' || r.kind === 'brick_fence' || r.kind === 'gate' || r.kind === 'scarecrow' || r.kind === 'path') {
        const kind = r.kind === 'gate' ? 'path' : r.kind, def = buildingById(kind);
        // Instant fence strokes do not take the build slot, so Abel keeps fencing while Noah raises a house.
        if (queuedElsewhere && !(def?.stroke && def?.instant)) continue;
        if (!def || !this.canPay(s, kind)) continue;
        for (const key of r.tiles) {
          const ck = `garden:${key}`;
          if (!free(ck) || key === busyId) continue;
          const target = cellFromKey(world, key);
          out.push({ kind: 'gardenWork', key: ck, requestId: r.id, request: { id: r.id, kind: r.kind, side: r.side, tiles: r.tiles }, tileKey: key, place: { kind, key, stroke: !!def.stroke }, target, reach: 1.1, label: labelFor(r), rank });
          break; // one piece this visit; the next visit takes the next tile
        }
      } else if (r.kind === 'unfence') {
        for (const key of r.tiles) {
          const b = activeBuildings(s).find((x) => x.status === 'complete' && footprint(world, x)?.keys.includes(key) && (buildingById(x.kind)?.stroke || x.kind === 'path'));
          if (!b) continue;
          const ck = `garden:unfence:${b.id}`;
          if (!free(ck)) continue;
          out.push({ kind: 'gardenWork', key: ck, requestId: r.id, request: { id: r.id, kind: r.kind, tiles: r.tiles }, tileKey: key, remove: b.id, target: cellFromKey(world, key), reach: 1.1, label: 'Moving the garden fence', rank });
          break;
        }
      } else if (r.kind === 'clear') {
        const ob = r.obstacle, p = cellFromKey(world, r.tiles[0]);
        if (!ob) continue;
        if (ob.what === 'tree') {
          const t = (ob.id && activeTrees(world, s, gameTime(s)).find((x) => x.id === ob.id)) || nearest(activeTrees(world, s, gameTime(s)), p);
          if (t && !t.cell && t.id !== busyId && free(`tree:${t.id}`)) out.push({ kind: 'chop', key: `tree:${t.id}`, treeId: t.id, target: { x: t.position[0], y: t.position[1] }, reach: 1.18 + (t.radius || 0) * .2, dwell: 1, label: 'Clearing a tree for the garden fence', rank, auto: 'village' });
        } else if (ob.what === 'stump') {
          const t = (ob.id && activeStumps(world, s).find((x) => x.id === ob.id)) || nearest(activeStumps(world, s), p);
          if (t && t.id !== busyId && free(`stump:${t.id}`)) out.push({ kind: 'stump', key: `stump:${t.id}`, treeId: t.id, target: { x: t.position[0], y: t.position[1] }, reach: 1.1 + stumpRadius(t) * .3, label: 'Digging a stump out for the garden', rank });
        } else if (ob.what === 'rock') {
          const r2 = (ob.id && activeRocks(world, s).find((x) => x.id === ob.id)) || nearest(activeRocks(world, s), p);
          if (r2 && r2.id !== busyId && free(`rock:${r2.id}`) && rockProfile(r2).minTier <= toolTier(s).tier) out.push({ kind: 'mine', key: `rock:${r2.id}`, rockId: r2.id, target: { x: r2.position[0], y: r2.position[1] }, reach: (r2.radius || .6) + .85, dwell: 1, label: 'Breaking a rock for the garden fence', rank, auto: 'village' });
        }
      } else if (r.kind === 'wood') {
        const focus = gardenFocus(world, s);
        const trees = activeTrees(world, s, gameTime(s)).filter((t) => !t.cell && t.id !== busyId && free(`tree:${t.id}`)).sort((a, b) => dist({ x: a.position[0], y: a.position[1] }, focus) - dist({ x: b.position[0], y: b.position[1] }, focus));
        for (const t of trees.slice(0, 3)) out.push({ kind: 'chop', key: `tree:${t.id}`, treeId: t.id, target: { x: t.position[0], y: t.position[1] }, reach: 1.18 + (t.radius || 0) * .2, dwell: 1, label: 'Cutting wood for the garden fence', rank, auto: 'village' });
      }
    }
    const outline = game.gardenPlan?.fenceChore(home);
    if (outline && free(outline.key)) {
      const head = checkIn(s, { who: home.id, brain: 'gardener', intent: { action: 'tend', maintenance: true } });
      if (head.ok) out.push(outline);
    }
    return out.filter((o) => dist(o.target, here) <= 90);
  }

  canPay(s, kind) {
    const def = buildingById(kind); if (!def) return false;
    const inv = s.inventory || {};
    const wood = Object.entries(inv).filter(([id]) => id.endsWith('_wood')).reduce((n, [, v]) => n + v, 0);
    if ((def.wood || 0) > wood || (def.stone || 0) > (inv.stone || 0)) return false;
    for (const [id, n] of Object.entries(def.bundle || def.materials || {})) if (id !== 'wood' && id !== 'stone' && (inv[id] || 0) < n) return false;
    if (kind === 'scarecrow' && (inv.wheat || 0) < 2) return false;
    return true;
  }

  /** Abel is beside the tile: he places (or takes down) the piece himself, then tells everyone. */
  finishWork(actor, c, residents) {
    const game = this.game, home = actor.userData, s = game.store.state;
    const centre = cellFromKey(this.world, c.tileKey), here = { x: home.x, y: home.y };
    // Stand one tile out along the nearest side (not a diagonal) so the "leave space to stand" rule is happy.
    const dx = here.x - centre.x, dy = here.y - centre.y;
    const stand = Math.abs(dx) >= Math.abs(dy) ? { x: centre.x + Math.sign(dx || 1) * 1.4, y: centre.y } : { x: centre.x, y: centre.y + Math.sign(dy || 1) * 1.4 };
    const before = s;
    try {
      if (c.remove) {
        game.store.commitAs(home.id, home.name, stand, { type: 'remove_fence', id: c.remove, actionId: `helper:${home.id}:unfence:${Date.now()}` });
      } else {
        const id = `garden-${c.place.kind}-${c.tileKey.replace(':', '-')}-${Date.now().toString(36)}`;
        game.store.commitAs(home.id, home.name, stand, { type: 'place_building', id, kind: c.place.kind, key: c.place.key, rotation: 0, stroke: c.place.stroke, actionId: `helper:${home.id}:garden:${Date.now()}` });
        const placed = game.store.state.buildings?.find((b) => b.id === id);
        if (placed && placed.status !== 'complete') {
          // Timed pieces (the gate stone) run through the normal begin/finish flow, and Abel stays on the site.
          residents.claims?.set(`build:${id}`, home.id);
          home.chore = { kind: 'build', key: `build:${id}`, buildingId: id, target: workPoint(this.world, placed), reach: .6, label: c.label, rank: 1, path: [] };
        }
      }
    } catch (e) { game.toast?.(e.message); }
    const after = game.store.state;
    if (after === before) {
      c.fails = (c.fails || 0) + 1;
      if (c.fails < 3) { home.chore = { ...c, path: [], dwell: 1 }; residents.claims?.set(c.key, home.id); }
      return;
    }
    game.refreshDynamic?.();
    game.music?.sfx?.play('chop');
    game.burst?.(centre, 'wood', .6);
    residents.reelEvent?.(actor);
    // Last tile of the ask? Rescan now so the request disappears and the feed says Abel finished it.
    this.lastScan = 0;
    const r = c.request, left = r.tiles.filter((k) => k !== c.tileKey && !this.tileDone(after, r, k));
    const keeper = this.keeperName();
    if (!left.length) { this.markFulfilled(r.id, keeper); this.lastRevision = -1; this.update(); }
    else game.toast?.(`${keeper} put up ${c.remove ? 'the old fence piece' : pieceName(c.place.kind)} for the garden.`);
  }
  tileDone(s, r, key) {
    if (r.kind === 'unfence') return !activeBuildings(s).some((b) => b.status === 'complete' && footprint(this.world, b)?.keys.includes(key));
    return activeBuildings(s).some((b) => b.status === 'complete' && footprint(this.world, b)?.keys.includes(key));
  }

  /* ---------------------------------------------------------------- voice, card, foreman */
  /** Abel's greeting when he has something to ask (null → the usual resident line). */
  greeting(home) {
    if (!home || skillFor(home.name)?.id !== 'gardener') return null;
    const r = this.requests[0];
    if (r) {
      const line = keeperLine(r);
      if (line) return { id: `garden:${r.id}`, text: line.charAt(0).toUpperCase() + line.slice(1), residentId: home.residentId || home.id };
    }
    const blocked = this.growthBlocked();
    if (blocked) return { id: 'garden:blocked', text: blocked, residentId: home.residentId || home.id };
    const plan = currentPlan(this.state, this.status?.primary);
    if (plan.shapesUnlocked && plan.shape !== 'rectangle') return { id: `garden:shape:${plan.shape}`, text: `The ${shapeById(plan.shape).name.toLowerCase()} garden is coming along. You will see it from the hill.`, residentId: home.residentId || home.id };
    return null;
  }

  /** What the garden card shows (world.snapshot → main.jsx GardenPanel). */
  card() {
    const st = this.status, s = this.state;
    if (!st || !s) return null;
    if (this.cardCache && this.cardCache.revision === s.revision && this.cardCache.status === st) return this.cardCache.card;
    const plan = currentPlan(s, st.primary);
    const card = this.cardCache = { revision: s.revision, status: st, card: this.buildCard(st, s, plan) };
    return card.card;
  }
  buildCard(st, s, plan) {
    const queued = activeBuildings(s).find((b) => b.status !== 'complete' && !b.project);
    return {
      waitingOn: queued ? buildingById(queued.kind)?.name || 'a building' : null,
      keeper: this.keeperName(), plots: st.plots, planted: st.planted, fencedPct: st.fencedPct, gaps: st.gaps.length, gapsBySide: st.gapsBySide,
      gate: st.gate ? { built: !!st.gate.built, side: st.gate.side } : null, scarecrows: st.scarecrows, threatLevel: st.threatLevel, exposure: st.exposure,
      lastAttack: st.lastAttack, upgrades: st.upgradesAvailable, requests: this.requests.map((r) => ({ id: r.id, kind: r.kind, side: r.side || null, reason: r.reason, need: r.need, priority: r.priority, tiles: r.tiles.length })),
      plan: { shape: plan.shape, name: plan.name, shapesUnlocked: plan.shapesUnlocked, chosenBy: plan.chosenBy, block: st.plan?.block || null, blocked: this.growthBlocked(s), options: SHAPE_IDS.map((id) => ({ id, name: shapeById(id).name, hint: shapeById(id).blurb || '' })) },
      rules: RULES, fenceBefore: FENCE_BEFORE_PLOTS, shapeMin: SHAPE_MIN_PLOTS, wood: st.wood, stone: st.stone, bricks: st.bricks, wheat: st.wheat,
    };
  }

  /** The kid (or the foreman) picks the garden's shape. Returns false when shapes are still locked. */
  setShape(id, by = 'kid') {
    if (!SHAPE_IDS.includes(id)) return false;
    const plan = currentPlan(this.state, this.status?.primary);
    if (id !== 'rectangle' && !plan.shapesUnlocked) { this.game.toast?.(`Fence the garden all the way round and grow it to ${SHAPE_MIN_PLOTS} plots first — then ${this.keeperName()} can shape it.`); return false; }
    this.patch({ shape: id, shapeBy: by, block: null });
    this.lastScan = 0; this.lastRevision = -1; this.update();
    const name = this.keeperName();
    this.game.toast?.(id === 'rectangle' ? `${name} will keep the rows in neat rectangles.` : `${name} will lay the next patch out as a ${shapeById(id).name.toLowerCase()}.`);
    this.feed(name, 'garden', `${by === 'foreman' ? 'The foreman' : 'You'} chose a ${shapeById(id).name.toLowerCase()} garden — ${name} is planning it.`);
    return true;
  }

  /** Compact garden state for the foreman (backend islandForeman): status + open requests + rules. */
  foremanContext() {
    const st = this.status; if (!st) return null;
    return {
      plots: st.plots, planted: st.planted, fencedPct: st.fencedPct, gapsBySide: st.gapsBySide, gate: st.gate ? { built: !!st.gate.built, side: st.gate.side } : null,
      scarecrows: { count: st.scarecrows.count, needed: st.scarecrows.needed, uncovered: st.scarecrows.uncovered }, threatLevel: st.threatLevel, exposure: st.exposure,
      lastAttack: st.lastAttack ? { day: st.lastAttack.day, kind: st.lastAttack.kind, sides: st.lastAttack.sides, ate: st.lastAttack.ate } : null,
      upgradesAvailable: st.upgradesAvailable.map((u) => u.id), shape: currentPlan(this.state, st.primary).shape, shapesUnlocked: currentPlan(this.state, st.primary).shapesUnlocked,
      playerSquares: this.game.gardenPlan?.active?.() ? { plots: this.game.gardenPlan.active().keys, fence: this.game.gardenPlan.active().ring, gate: this.game.gardenPlan.active().gate } : null,
      requests: this.requests.map((r) => ({ id: r.id, kind: r.kind, side: r.side || null, need: r.need, reason: r.reason, priority: r.priority })),
      rules: RULES.map((r) => r.text),
    };
  }

  /**
   * Map a foreman assignment onto the keeper. Accepts {task:'build:fence'|'build:gate'|'build:scarecrow'|'guard'|'shape:heart'|'garden:<requestId>', who}.
   * Fence and scarecrow tasks stay with Abel. Returns the request tagged with his name, never someone else's.
   */
  applyAssignment(assignment) {
    const task = String(assignment?.task || assignment?.kind || '').toLowerCase();
    const mine = (request) => request ? { ...request, who: this.keeperName() } : null;
    if (task.startsWith('shape:')) { const id = task.slice(6); return this.setShape(id, 'foreman') ? { shape: id, who: this.keeperName() } : null; }
    if (task.startsWith('garden:')) return mine(this.requests.find((r) => r.id === task.slice(7)));
    if (task === 'guard') return { kind: 'guard', who: this.keeperName() };
    const want = task.replace(/^build:/, '');
    const map = { fence: ['fence', 'brick_fence'], wall: ['fence', 'brick_fence'], gate: ['gate'], scarecrow: ['scarecrow'], path: ['path'], clear: ['clear'], wood: ['wood'] };
    const kinds = map[want]; if (!kinds) return null;
    return mine(this.requests.find((r) => kinds.includes(r.kind) && (!assignment.side || r.side === assignment.side)));
  }

  /** Local, rule-based priority when the foreman is offline: safety > food > building. */
  localPlan() {
    const st = this.status, out = [];
    if (!st) return out;
    const hot = this.requests.filter((r) => r.priority >= 90 || (st.recentAttack && ['fence', 'brick_fence', 'gate', 'scarecrow'].includes(r.kind)));
    const who = this.keeperName();
    for (const r of hot) out.push({ lane: 'safety', task: `garden:${r.id}`, who, reason: r.reason });
    if (st.plots && st.planted < st.plots) out.push({ lane: 'food', task: 'plant', who, reason: `${st.plots - st.planted} empty plot${st.plots - st.planted === 1 ? '' : 's'} to plant.` });
    for (const r of this.requests.filter((r) => !hot.includes(r))) out.push({ lane: 'building', task: `garden:${r.id}`, who, reason: r.reason });
    return out;
  }

  feed(who, kind, text) {
    const s = this.state;
    if (!text || !s) return;
    const actor = [...(this.game.residents?.models?.values() || [])].find((a) => a.userData?.name === who);
    if (actor && actor.userData.id === s.activeCharacter) return; // never log the character the kid plays
    try { noteEvent(kind, text, { who }); } catch { /* best-effort */ }
  }
}

function nearest(list, p) { return [...list].sort((a, b) => dist(p, { x: a.position[0], y: a.position[1] }) - dist(p, { x: b.position[0], y: b.position[1] }))[0] || null; }
/** A new fence ring, or the next block of plots. Pieces on a ring already started are maintenance. */
function gardenProject(status, request) {
  if (!request) return null;
  const fenced = status?.fencedPct || 0;
  const ring = request.rule === 'fence_ring' || request.kind === 'fence' || request.kind === 'brick_fence';
  if (ring && fenced <= 0) return { action: 'fence', newRing: true, kind: request.kind, key: request.tiles?.[0], rotation: 0 };
  if (request.rule === 'room_to_grow' || request.rule === 'move_fence') return { action: 'expand', kind: request.kind, key: request.tiles?.[0] };
  return null;
}
function pieceName(kind) { return { fence: 'a fence piece', brick_fence: 'a brick fence piece', path: 'the gate stone', scarecrow: 'the scarecrow' }[kind] || buildingById(kind)?.name?.toLowerCase() || 'a piece'; }
function labelFor(r) { return { fence: 'Fencing the garden', brick_fence: 'Walling the garden in brick', gate: 'Making the garden gate', scarecrow: 'Putting up a scarecrow', path: 'Laying stones to the garden' }[r.kind] || 'Helping in the garden'; }
/** "the garden fence on the east side", "the garden gate" … for feed lines. */
export function describe(r, done = false) {
  const side = r.side && r.side !== 'corner' ? ` on the ${r.side} side` : r.side === 'corner' ? "'s corner posts" : '';
  switch (r.kind) {
    case 'fence': return `the garden fence${side}`;
    case 'brick_fence': return `the brick garden wall${side}`;
    case 'gate': return 'the garden gate';
    case 'scarecrow': return 'a scarecrow for the garden';
    case 'path': return 'the stepping stones to the garden';
    case 'unfence': return done ? 'moving the old fence out' : 'the old inner fence taken down';
    case 'clear': return `the ${r.obstacle?.what || 'spot'} cleared for the garden`;
    case 'wood': return 'wood for the fence';
    default: return 'something for the garden';
  }
}
