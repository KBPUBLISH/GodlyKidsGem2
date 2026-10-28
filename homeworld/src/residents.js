import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { heightAt, dist, gameTime, growth, cellFromKey, activeTrees, activeRocks, pruneBuiltIns } from './core.mjs';
import { woodRoom } from './wood-storage.mjs';
import { toolTier, rockProfile } from './mining.mjs';
import { woodTotal, buildingById } from './building.mjs';
import { energyFor, FOODS, hungerFor, isStarving, mealGain, workRate } from './nutrition.mjs';
import { workPoint, completedFires, firesNeedingLog, fireCanTakeLog, bedCount } from './building.mjs';
import { communityClaim } from './community.mjs';
import { advancePath, turnToward, resetAnimatedPose } from './character-motion.js';
import { projectAssignments } from './construction-projects.mjs';
import { normalizeCharacterModel } from './character-model.js';
import { emitWorkSweat } from './work-sweat.js';

/** Collected Bible characters living on the Players World island. Same key as the app. */
export const RESIDENTS_KEY = 'godlykids_players_world_residents_v1';

function readResidents() {
  try {
    const raw = JSON.parse(localStorage.getItem(RESIDENTS_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((r) => r && typeof r.id === 'string' && Number.isFinite(r.x) && Number.isFinite(r.y));
  } catch {
    return [];
  }
}

function writeResidents(list) {
  localStorage.setItem(RESIDENTS_KEY, JSON.stringify(list));
}

function tellParent(type, residents) {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type, residents }, location.origin);
  }
}

/** The island looks up walk and idle clips by these names. */
function aliasClip(clips, key, pattern) {
  if (clips[key]) return;
  const name = Object.keys(clips).find((clipName) => pattern.test(clipName));
  if (name) clips[key] = clips[name];
}

/**
 * Story friends the player has collected. Drop-off taps place them on clear grass.
 * Models come from the character's own GLB; everyone else stands as a portrait.
 */
export class Residents {
  constructor(game) {
    this.game = game;
    this.draco = new DRACOLoader();
    this.draco.setDecoderPath('/draco/');
    this.loader = new GLTFLoader();
    this.loader.setDRACOLoader(this.draco);
    this.models = new Map();
    this.claims = new Map(); // chore key -> resident id, so two helpers never chase the same job
    this.lastChoreScan = 0;
    this.placing = null;
    this.token = 0;
    // The default Adam body the island boots with; it goes away once a story friend takes over.
    this.builtInActor = game.playersOnly && game.actor && !game.actor.userData?.residentId ? game.actor : null;
    if (game.playersOnly && game.store && !game.store.locked) {
      const pruned = pruneBuiltIns(game.store.state);
      if (pruned !== game.store.state) { try { game.store.save(pruned); } catch { /* reported by the store */ } }
    }
    this.onMessage = (event) => {
      if (event.origin !== location.origin || !event.data) return;
      const { type } = event.data;
      if (type === 'gk-residents-sync') this.show(readResidents());
      if (type === 'gk-resident-drop') this.beginDrop(event.data.character);
      if (type === 'gk-resident-remove') this.remove(event.data.id);
      if (type === 'gk-resident-select') this.select(event.data.id);
      if (type === 'gk-task') {
        const task = event.data.task;
        const control = ['stop', 'pause', 'resume'].includes(task?.type);
        // Controls act on whoever is working; real jobs go to the friend who was asked.
        const helper = control && event.data.characterId ? this.models.get(event.data.characterId) : null;
        if (helper && helper !== this.game.actor && helper.userData.job) { if (task.type !== 'resume') this.stopJob(helper); }
        else if (control || !event.data.characterId || !this.game.assign) this.game.autoWork?.start(task);
        else this.game.assign(task, event.data.characterId);
      }
      if (type === 'gk-prayer-voice') this.game.nutrition?.onPrayerVoice?.(event.data);
      if (type === 'gk-friends-waiting') { this.waiting = { count: event.data.count | 0, name: event.data.name || '' }; this.game.notify?.(); }
    };
    window.addEventListener('message', this.onMessage);
    this.show(readResidents());
    tellParent('gk-players-ready', readResidents());
  }

  /** Beds on the island versus friends living here. The first friend may always come ashore; after that everyone needs a bed. */
  bedStatus() {
    const s = this.game.store?.state, beds = s ? bedCount(s) : 0, residents = readResidents().length;
    return { beds, residents, canDrop: residents === 0 || residents < beds, need: Math.max(0, residents + 1 - beds) };
  }
  shareBeds() {
    const b = this.bedStatus(), key = `${b.beds}:${b.residents}`;
    if (key === this.lastBedKey) return;
    this.lastBedKey = key;
    if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'gk-beds', ...b }, location.origin);
  }

  beginDrop(character) {
    if (!character?.id || !character.name) {
      this.placing = null;
      return;
    }
    const beds = this.bedStatus();
    if (!beds.canDrop) {
      this.placing = null;
      this.game.toast(`${character.name} needs a bed first. ${beds.residents} friend${beds.residents === 1 ? '' : 's'} live here and there ${beds.beds === 1 ? 'is' : 'are'} ${beds.beds} bed${beds.beds === 1 ? '' : 's'}. Build or upgrade a home.`);
      if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'gk-beds', ...beds, denied: character.name }, location.origin);
      this.game.notify?.();
      return;
    }
    this.placing = character;
    this.game.toast(`Tap the grass to drop off ${character.name}.`);
    this.game.notify?.();
  }

  /** Returns true when this tap was used for a drop-off instead of ordinary play. */
  consumeTap(event) {
    if (!this.placing) return false;
    const point = this.groundPoint(event);
    const spot = point && this.game.nav.nearest(point, 4);
    if (!spot) {
      this.game.toast('Drop them on clear grass.');
      return true;
    }
    const resident = {
      id: this.placing.id,
      name: this.placing.name,
      modelUrl: this.placing.modelUrl || '',
      imageUrl: this.placing.imageUrl || '',
      sourceStoryId: this.placing.sourceStoryId || '',
      x: spot.x,
      y: spot.y,
    };
    const next = readResidents().filter((r) => r.id !== resident.id);
    next.push(resident);
    writeResidents(next);
    this.placing = null;
    this.show(next);
    this.game.toast(`${resident.name} is home on your island.`);
    tellParent('gk-resident-placed', next);
    this.shareBeds();
    return true;
  }

  remove(id) {
    if (!id) return;
    const next = readResidents().filter((r) => r.id !== id);
    writeResidents(next);
    const gone = this.models.get(id);
    if (gone) {
      this.game.scene.remove(gone);
      this.models.delete(id);
    }
    this.show(next);
    tellParent('gk-resident-placed', next);
  }

  groundPoint(event) {
    const rect = this.game.renderer.domElement.getBoundingClientRect();
    this.game.mouse.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.game.ray.setFromCamera(this.game.mouse, this.game.camera);
    const point = new THREE.Vector3();
    if (!this.game.ray.ray.intersectPlane(this.game.groundPlane, point)) return null;
    return { x: point.x, y: -point.z };
  }

  async show(list) {
    const token = ++this.token;
    const keep = new Set(list.map((r) => r.id));
    for (const [id, actor] of this.models) {
      if (keep.has(id)) continue;
      this.game.scene.remove(actor);
      this.models.delete(id);
    }
    for (const resident of list) {
      let actor = this.models.get(resident.id);
      const nextUrl = resident.modelUrl || '';
      // A reward model uploaded after this friend was collected must replace
      // the body already standing here, not only the next drop-off.
      const stale = actor && (actor.userData.modelUrl || '') !== nextUrl;
      if (!actor || stale) {
        const fresh = await this.makeActor(resident);
        if (token !== this.token || !fresh) continue;
        const wasPlaying = !!actor && actor === this.game.actor;
        const x = actor ? actor.userData.x : resident.x;
        const y = actor ? actor.userData.y : resident.y;
        if (actor) {
          this.game.scene.remove(actor);
          this.models.delete(resident.id);
        }
        this.models.set(resident.id, fresh);
        this.game.scene.add(fresh);
        this.place(fresh, x, y);
        if (wasPlaying) this.possess(fresh);
        continue;
      }
      if (actor !== this.game.actor) {
        this.place(actor, actor.userData.x, actor.userData.y);
      }
    }
    if (token !== this.token) return; // a newer sync is loading; it will pick who you play as
    if (this.game.playersOnly && !this.models.has(this.activeId)) {
      // Come back as the friend you last played as; otherwise the first one living here.
      const last = this.models.get(this.game.store?.state?.activeCharacter);
      const first = last || this.models.values().next().value;
      if (first) this.possess(first);
    }
  }

  place(actor, x, y) {
    actor.userData.x = x;
    actor.userData.y = y;
    actor.position.set(x, heightAt(this.game.world, x, y) + 0.015, -y);
  }

  /**
   * The tapped story friend becomes the body the island already knows how to
   * walk, chop, mine, plant, and build. Those poses use the Mixamo skeleton.
   */
  possess(actor) {
    const game = this.game;
    const home = actor.userData;
    if (!home.bones || !home.mixer) return;
    const previous = this.models.get(this.activeId);
    // Whatever the old body was doing (praying, resting, digging) ends with the hand-over, so the new body never inherits it.
    if (game.action) game.dropAction?.();
    // Stop the old body's island animations first; playIdle below restarts its own idle.
    game.mixer?.stopAllAction();
    if (previous && previous !== actor) {
      // Straighten the old body out of any IK pose (kneeling, reaching) before its own idle takes over.
      resetAnimatedPose(previous.userData);
      previous.userData.waving = false;
      previous.userData.waveAction = null;
      this.place(previous, game.player.x, game.player.y);
      previous.userData.idling = false;
      previous.userData.stillFor = 0;
      previous.userData.anchor = { x: game.player.x, y: game.player.y };
      previous.userData.strollState = { wait: 4 + Math.random() * 6 };
      this.playIdle(previous);
    }
    // The new body may still be running its parked idle: the island drives it from here.
    home.mixer.stopAllAction();
    // Taken off a building crew mid-swing: put the hammer and bench away and straighten out of the IK pose,
    // otherwise the tool hangs in the air at the site after you walk them away.
    if (home.onDuty || home.hammer?.visible) { resetAnimatedPose(home); home.onDuty = false; }
    if (home.hammer) { home.hammer.visible = false; home.bench.visible = false; }
    home.stillFor = 0;
    home.strollState = null;
    if (home.chore) { this.claims.delete(home.chore.key); home.chore = null; }
    home.job = null;
    game.currentClip = null;
    game.locomotion = null;
    game.walkSpeed = 0;
    game.path = [];
    game.order = null;
    if (game.marker) game.marker.visible = false;
    game.actor = actor;
    game.model = home.model;
    game.bones = home.bones;
    game.restPose = home.restPose;
    game.mixer = home.mixer;
    game.clips = home.clips;
    game.player.x = home.x;
    game.player.y = home.y;
    this.place(actor, home.x, home.y);
    actor.userData.idling = false;
    this.activeId = home.id;
    // The default Adam body (no story friend behind it) leaves the island for good.
    if (!previous && game.playersOnly && this.builtInActor && this.builtInActor !== actor) {
      game.scene.remove(this.builtInActor); this.builtInActor = null;
      // The island was look-only until now; the first friend opens it up.
      game.status = 'Tap land to walk. Open Actions to choose a tool.';
    }
    // Energy and sleep belong to the character, not the controller: the save follows whoever you play as.
    const s = game.store?.state;
    if (s && s.activeCharacter !== home.id && !s.characters?.[s.activeCharacter]?.sleep) {
      const characters = { ...s.characters, [home.id]: s.characters?.[home.id] || { name: home.name || home.id, energy: 100 } };
      try { game.store.save(pruneBuiltIns({ ...s, characters, activeCharacter: home.id, player: { x: home.x, y: home.y } }), Date.now()); } catch (e) { game.toast?.(e.message); }
    }
    game.focus?.copy(actor.position);
  }

  /** Everyone living here, with energy, for the Friends drop-down. */
  roster() {
    const game = this.game, s = game.store?.state;
    if (!s) return [];
    const out = [];
    for (const [id, actor] of this.models) {
      const h = actor.userData, selected = actor === game.actor;
      const work = selected ? game.autoWork?.snapshot?.() : null;
      out.push({
        id, name: h.name || id, imageUrl: h.imageUrl || '', selected,
        energy: Math.round(selected ? energyFor(s) : energyFor(s, id)),
        hunger: Math.round(hungerFor(s, gameTime(s), selected ? undefined : id)),
        status: selected ? (work ? work.label : 'Playing with you') : h.job ? `${h.job.label}${h.job.target < 50 ? ` · ${h.job.done}/${h.job.target}` : ''}` : h.chore ? h.chore.label : h.strollState?.path?.length ? 'Taking a walk' : 'Relaxing',
      });
    }
    return out.sort((a, b) => (a.selected ? -1 : b.selected ? 1 : 0) || a.name.localeCompare(b.name));
  }

  /**
   * Jobs a friend can run on their own, in the background, while you keep playing as
   * someone else. Anything else (building, crafting, planting, sleeping) still needs the body.
   */
  static HELPER_JOBS = { water: 'Watering the garden', harvest: 'Picking ripe crops', stoke: 'Feeding the campfire', fish: 'Fishing', chop: 'Chopping wood', mine: 'Breaking rocks' };

  canHelp(task) { return !!task && !!Residents.HELPER_JOBS[task.type]; }

  assignJob(actor, task) {
    const game = this.game, home = actor?.userData;
    if (!home || !this.canHelp(task)) return false;
    const type = task.type, count = task.count > 0 ? Math.min(20, Math.round(task.count)) : null;
    let target = 1;
    if (type === 'water') target = task.goal === 'one' ? 1 : 60;
    else if (type === 'harvest') target = count || 60;
    else if (type === 'chop') target = count || { store: 6, clear: 3, few: 2 }[task.goal] || 2;
    else if (type === 'mine' || type === 'fish') target = count || 1;
    let until = task.until && typeof task.until === 'object' ? task.until : null;
    if (type === 'mine' && !until && count > 1 && (!task.goal || task.goal === 'any' || task.goal === 'stone')) until = { stone: (game.store.state.inventory.stone || 0) + count };
    if (until) target = 99;
    if (home.chore) { this.claims.delete(home.chore.key); home.chore = null; }
    home.job = { type, goal: task.goal || null, until, target, done: 0, fails: 0, label: Residents.HELPER_JOBS[type] };
    home.strollState = { wait: 0 };
    this.lastChoreScan = 0;
    const s = game.store?.state;
    const slow = s && !['fish', 'harvest'].includes(type) && isStarving(s, gameTime(s), home.id) && !this.snack(actor);
    game.toast(`${home.name || 'Your friend'} is off: ${home.job.label.toLowerCase()}.${slow ? ` An empty tummy makes it slow going · feed ${home.name || 'them'} when you can.` : ''}`);
    game.notify?.();
    return true;
  }

  /** A snack for a friend you are not playing as. */
  feed(actor, item) {
    const game = this.game, home = actor?.userData;
    if (!home) return false;
    const before = game.store.state;
    try { game.store.commitAs(home.residentId, home.name, { x: home.x, y: home.y }, { type: 'eat', item, actionId: `helper:${home.residentId}:eat:${Date.now()}` }); } catch (e) { game.toast(e.message); return false; }
    if (game.store.state === before) { game.toast(`${home.name} is full. Save the snacks for later.`); return false; }
    game.toast(`${home.name} had a ${item.replace(/_/g, ' ')}.`);
    game.notify?.();
    return true;
  }

  /** A tired helper grabs the best snack from the shared bag so the job can go on (a few per job). */
  snack(actor) {
    const game = this.game, home = actor?.userData, s = game.store?.state, j = home?.job;
    if (!s || !j || (j.snacks || 0) >= 6) return false;
    const inv = s.inventory || {};
    const best = Object.entries(FOODS).filter(([id]) => inv[id] > 0).sort((a, b) => b[1].energy - a[1].energy)[0];
    if (!best) return false;
    const before = s;
    try { game.store.commitAs(home.id, home.name, { x: home.x, y: home.y }, { type: 'eat', item: best[0], actionId: `helper:${home.id}:snack:${Date.now()}` }); } catch { return false; }
    if (game.store.state === before) return false;
    j.snacks = (j.snacks || 0) + 1;
    game.toast(`${home.name} took a snack break (${best[1].name.toLowerCase()}) and kept going.`);
    game.notify?.();
    return true;
  }

  stopJob(actor, note = true) {
    const home = actor?.userData;
    if (!home?.job) return;
    const job = home.job;
    home.job = null;
    if (home.chore) { this.claims.delete(home.chore.key); home.chore = null; }
    if (note) this.game.toast(job.done ? `${home.name} stopped after ${this.jobProgress(job)}.` : `${home.name} stopped working.`);
    this.game.notify?.();
  }

  jobProgress(job) {
    const unit = { water: 'plant', harvest: 'harvest', stoke: 'log', fish: 'fish', chop: 'tree', mine: 'rock' }[job.type] || 'job';
    return `${job.done} ${unit}${job.done === 1 || unit === 'fish' ? '' : 's'}`;
  }

  jobSnapshot(home) {
    const j = home?.job;
    if (!j) return null;
    return { type: j.type, goal: j.goal, label: j.label, done: j.done, target: j.target < 50 ? j.target : null, progress: this.jobProgress(j), paused: false, helper: true };
  }

  /** One unit of a job got done: count it, and finish the job when the goal is met. */
  creditJob(actor) {
    const game = this.game, home = actor.userData, j = home.job;
    if (!j) return;
    j.done++; j.fails = 0;
    const s = game.store.state;
    if (j.until) {
      const have = j.until.wood ? woodTotal(s) : (s.inventory.stone || 0), want = j.until.wood || j.until.stone;
      if (have >= want) { home.job = null; game.toast(`${home.name} got there: ${have} ${j.until.wood ? 'wood' : 'stone'} in the bag!`); game.notify?.(); return; }
    }
    if (j.done >= j.target) {
      home.job = null;
      if (j.then) { this.assignJob(actor, j.then); return; }
      game.toast(`${home.name} finished: ${this.jobProgress(j)}.`); game.notify?.();
    }
  }

  failJob(actor, why) {
    const game = this.game, home = actor.userData, j = home.job;
    if (!j) return;
    j.fails++;
    if (j.fails < 3) return;
    home.job = null;
    game.toast(`${home.name} stopped: ${why}`);
    game.notify?.();
  }

  /** The next piece of an assigned job for this helper, or null when there is nothing (left) to do. */
  pickJobChore(home) {
    const game = this.game, s = game.store?.state, j = home.job;
    if (!s || !j) return null;
    const min = gameTime(s), here = { x: home.x, y: home.y }, busyKey = game.order?.key || game.action?.key || null, busyId = game.order?.id || game.action?.id || null;
    const tryPaths = (options) => {
      for (const o of options) { const path = o.exact ? game.nav?.path(here, o.target) : game.nav?.approach(here, o.target, o.reach); if (path?.length || (path && dist(here, o.target) <= (o.reach || 1.05))) return { ...o, path: path || [] }; }
      return null;
    };
    if (j.type === 'water' || j.type === 'harvest') {
      const want = j.type === 'water' ? (g) => g.thirsty : (g) => g.stage === 'ready';
      const options = [];
      for (const [cellKey, cell] of Object.entries(s.cells || {})) {
        const g = growth(cell, min);
        if (!g || g.seed.kind !== 'crop' || !want(g)) continue;
        const key = `cell:${cellKey}`;
        if (this.claims.has(key) || cellKey === busyKey || communityClaim(s, cellKey)) continue;
        options.push({ kind: j.type, key, cellKey, target: cellFromKey(game.world, cellKey), reach: .9, label: j.label });
      }
      options.sort((a, b) => dist(a.target, here) - dist(b.target, here));
      return tryPaths(options);
    }
    if (j.type === 'stoke') {
      const hasWood = Object.entries(s.inventory || {}).some(([id, n]) => id.endsWith('_wood') && n > 0);
      if (!hasWood) {
        // No log in the bag: chop one tree first, then come back to the fire.
        if (!woodRoom(s) || j.then) return null;
        home.job = { type: 'chop', goal: 'few', until: null, target: 1, done: 0, fails: 0, label: Residents.HELPER_JOBS.chop, then: { type: 'stoke' } };
        game.toast(`${home.name} needs a log first. Off to chop a tree.`);
        return this.pickJobChore(home);
      }
      const options = firesNeedingLog(s, min).filter((f) => !this.claims.has(`fire:${f.id}`)).map((f) => ({ kind: 'stoke', key: `fire:${f.id}`, fireId: f.id, target: workPoint(game.world, f), reach: 1.2, label: j.label }));
      return tryPaths(options);
    }
    if (j.type === 'fish') {
      const spot = game.world.fishingSpots?.[0];
      if (!spot) return null;
      const key = `spot:${spot.id}`;
      if (this.claims.has(key)) return null;
      return tryPaths([{ kind: 'fish', key, spotId: spot.id, target: { x: spot.position[0], y: spot.position[1] }, exact: true, reach: 1.05, dwell: 6, label: j.label }]);
    }
    if (j.type === 'chop') {
      if (!woodRoom(s)) return null;
      const options = activeTrees(game.world, s, min).filter((t) => t.id !== busyId && !this.claims.has(`tree:${t.id}`) && !t.cell)
        .map((t) => ({ kind: 'chop', key: `tree:${t.id}`, treeId: t.id, target: { x: t.position[0], y: t.position[1] }, reach: 1.18 + (t.radius || 0) * .2, dwell: 1, label: j.label }))
        .sort((a, b) => dist(a.target, here) - dist(b.target, here)).slice(0, 14);
      return tryPaths(options);
    }
    if (j.type === 'mine') {
      const tier = toolTier(s), deposit = j.goal && j.goal !== 'any' ? j.goal : null;
      const options = activeRocks(game.world, s).filter((r) => { const p = rockProfile(r); return r.id !== busyId && !this.claims.has(`rock:${r.id}`) && p.minTier <= tier.tier && (!deposit || p.deposit === deposit); })
        .filter((r) => { const node = game.mining?.nodes?.get(r.id); return !node || node.bounds.min.y <= heightAt(game.world, r.position[0], r.position[1]) + .75; })
        .map((r) => ({ kind: 'mine', key: `rock:${r.id}`, rockId: r.id, target: { x: r.position[0], y: r.position[1] }, reach: (r.radius || .6) + .85, dwell: 1, label: j.label }))
        .sort((a, b) => dist(a.target, here) - dist(b.target, here)).slice(0, 14);
      return tryPaths(options);
    }
    return null;
  }

  /**
   * Alerts on the island (a thirsty crop, a campfire burning low) are picked up by
   * whichever friend is free. Returns the nearest unclaimed chore for this helper.
   */
  pickChore(home, actor = null) {
    if (home.job) {
      const chore = this.pickJobChore(home);
      if (!chore && actor) {
        const s = this.game.store?.state, j = home.job;
        if (j.done > 0) { home.job = null; this.game.toast(`${home.name} finished: ${this.jobProgress(j)}. Nothing more to do there.`); this.game.notify?.(); return null; }
        const why = j.type === 'chop' && s && !woodRoom(s) ? 'the wood store is full.' : j.type === 'stoke' ? 'there is no wood for the fire.' : 'nothing left to do here.';
        this.failJob(actor, why);
      }
      return chore;
    }
    const game = this.game, s = game.store?.state;
    if (!s || s.night || !game.loaded || energyFor(s, home.id) <= 10) return null;
    const min = gameTime(s), here = { x: home.x, y: home.y }, busyKey = game.order?.key || game.action?.key || null, busyFire = game.order?.fireId || null;
    const options = [];
    const hasWood = Object.entries(s.inventory || {}).some(([id, n]) => id.endsWith('_wood') && n > 0);
    if (hasWood) for (const fire of firesNeedingLog(s, min)) {
      const key = `fire:${fire.id}`;
      if (this.claims.has(key) || fire.id === busyFire) continue;
      options.push({ kind: 'stoke', key, fireId: fire.id, target: workPoint(game.world, fire), reach: 1.2, label: 'Adding a log to the fire', rank: 0 });
    }
    for (const [cellKey, cell] of Object.entries(s.cells || {})) {
      const g = growth(cell, min);
      if (!g?.thirsty || g.seed.kind !== 'crop') continue;
      const key = `cell:${cellKey}`;
      if (this.claims.has(key) || cellKey === busyKey || communityClaim(s, cellKey)) continue;
      options.push({ kind: 'water', key, cellKey, target: cellFromKey(game.world, cellKey), reach: .9, label: 'Watering the garden', rank: 1 });
    }
    if (!options.length) return null;
    options.sort((a, b) => a.rank - b.rank || dist(a.target, here) - dist(b.target, here));
    for (const o of options) {
      const path = game.nav?.approach(here, o.target, o.reach);
      if (path?.length) return { ...o, path };
    }
    return null;
  }

  finishChore(actor) {
    const game = this.game, home = actor.userData, c = home.chore;
    home.chore = null;
    if (!c) return;
    this.claims.delete(c.key);
    const s = game.store?.state;
    if (!s) return;
    const min = gameTime(s), who = home.name || 'Your friend';
    try {
      if (c.kind === 'water') {
        const cell = s.cells[c.cellKey], g = growth(cell, min);
        if (!g?.thirsty) return;
        const before = game.store.state;
        game.store.commitAs(home.id, home.name, { x: home.x, y: home.y }, { type: 'water', key: c.cellKey, actionId: `helper:${home.id}:${Date.now()}` });
        if (game.store.state !== before) { game.burst?.(c.target, 'water', .3); game.toast(`${who} watered the ${g.seed.name.toLowerCase()}.`); }
        else if (energyFor(game.store.state, home.id) < 5) { if (home.job && this.snack(actor)) { home.chore = { ...c, path: [], dwell: 1 }; this.claims.set(c.key, home.id); return; } home.job = null; game.toast(`${who} is too tired to keep working.`); game.notify?.(); }
      } else if (c.kind === 'stoke') {
        const fire = completedFires(s).find((b) => b.id === c.fireId);
        if (!fire || !fireCanTakeLog(fire, min)) return;
        const before = game.store.state;
        game.store.commitAs(home.id, home.name, { x: home.x, y: home.y }, { type: 'stoke', fireId: c.fireId, actionId: `helper:${home.id}:${Date.now()}` });
        if (game.store.state !== before) { game.burst?.(c.target, 'wood', .2); game.toast(`${who} put a log on the campfire.`); if (home.job) this.creditJob(actor); }
      } else if (c.kind === 'harvest') {
        const cell = s.cells[c.cellKey], g = growth(cell, min);
        if (!g || g.stage !== 'ready') return;
        const before = game.store.state;
        game.store.commitAs(home.id, home.name, { x: home.x, y: home.y }, { type: 'harvest', key: c.cellKey, actionId: `helper:${home.id}:${Date.now()}` });
        if (game.store.state !== before) { game.burst?.(c.target, 'seed', .3); if (home.job) this.creditJob(actor); else game.toast(`${who} picked the ${g.seed.name.toLowerCase()}.`); }
      } else if (c.kind === 'fish') {
        const before = game.store.state;
        game.store.commitAs(home.id, home.name, { x: home.x, y: home.y }, { type: 'fish', spotId: c.spotId, actionId: `helper:${home.id}:${Date.now()}` });
        if (game.store.state !== before) { game.burst?.(c.target, 'water', .4); if (home.job) this.creditJob(actor); }
        else this.failJob(actor, 'could not fish from there.');
      } else if (c.kind === 'chop' || c.kind === 'mine') {
        const before = game.store.state;
        const hit = c.kind === 'chop' ? { type: 'chop_hit', id: c.treeId } : { type: 'mine_hit', id: c.rockId };
        game.store.commitAs(home.id, home.name, { x: home.x, y: home.y }, { ...hit, actionId: `helper:${home.id}:${Date.now()}` });
        const after = game.store.state;
        if (after === before) {
          const tired = energyFor(after, home.id) < 5;
          if (tired) {
            if (home.job && this.snack(actor)) { home.chore = { ...c, path: [], dwell: 1.2 }; this.claims.set(c.key, home.id); return; }
            home.job = null; game.toast(`${who} is too tired to keep working.`); game.notify?.();
          } else this.failJob(actor, c.kind === 'chop' ? 'the wood store is full.' : 'that rock needs stronger tools.');
          return;
        }
        game.burst?.(c.target, c.kind === 'chop' ? 'wood' : 'dirt', .9);
        const gone = c.kind === 'chop' ? after.removedTrees.includes(c.treeId) : (after.removedRocks || []).includes(c.rockId);
        if (gone) { if (home.job) this.creditJob(actor); }
        else if (home.job) { home.chore = { ...c, path: [], dwell: c.baseDwell ?? 1 }; this.claims.set(c.key, home.id); }
      }
    } catch (e) {
      game.toast?.(e.message);
    }
    game.refreshDynamic?.();
    game.notify?.();
  }

  /** Walk a helper along a path for one frame; true while still moving. */
  walkAlong(actor, path, speed, dt) {
    const home = actor.userData, pos = { x: home.x, y: home.y };
    advancePath(pos, path, speed * dt);
    const mx = pos.x - home.x, my = pos.y - home.y;
    if (Math.hypot(mx, my) > 1e-5) turnToward(actor, Math.atan2(mx, -my), dt);
    this.place(actor, pos.x, pos.y);
    const walk = home.clips?.Walking;
    if (walk) {
      if (!walk.isRunning() || home.idling || home.flourish) { home.mixer.stopAllAction(); walk.reset().setLoop(THREE.LoopRepeat, Infinity).play(); walk.setEffectiveTimeScale(speed / 1.5); home.idling = false; home.flourish = null; }
      home.mixer.update(dt);
    }
    return path.length > 0;
  }

  /** Story friends sheet: become this friend and bring the camera to them. */
  select(id) {
    const game = this.game, actor = this.models.get(id);
    if (!actor || !actor.userData.bones) return false;
    this.closeMenu();
    if (actor !== game.actor) {
      game.autoWork?.stop?.(true);
      if (game.action) game.unequipTool?.();
      this.possess(actor);
      game.refreshDynamic?.();
    }
    game.overview = false;
    game.zoom = Math.max(game.zoom || 0, 19);
    game.focus?.copy(actor.position);
    game.revealCharacterVitals?.();
    actor.userData.waving = true;
    game.toast?.(`You're playing as ${actor.userData.name || 'your friend'} now.`);
    game.notify?.();
    return true;
  }

  /** Tap a friend who is already on the island to play as them. */
  pick(ray) {
    const meshes = [];
    for (const actor of this.models.values()) {
      actor.traverse((obj) => { if (obj.isMesh) meshes.push(obj); });
    }
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit) return null;
    let node = hit.object;
    while (node && !node.userData.residentId) node = node.parent;
    return node ? this.models.get(node.userData.residentId) : null;
  }

  waveClip(clips) {
    if (!clips) return null;
    if (clips.Wave) return clips.Wave;
    const name = Object.keys(clips).find((key) => /wave/i.test(key));
    return name ? clips[name] : null;
  }

  menuActor() {
    return this.menuId ? this.models.get(this.menuId) || null : null;
  }

  closeMenu() {
    if (!this.menuId) return;
    this.menuId = null;
    this.line = null;
    this.game.notify?.();
  }

  dismissLine() {
    this.line = null;
    this.game.notify?.();
  }

  /** Read real island context once per tap; the animation loop only displays the selected line. */
  sayHello(actor) {
    this.line = null;
    const game = this.game, home = actor?.userData, state = game.store?.state;
    if (!home?.residentId || !state || !game.playersOnly) return;
    const minutes = gameTime(state);
    const context = {
      residents:[...this.models.values()].map(a => ({id:a.userData.residentId,name:a.userData.name || 'Friend'})),
      plants:Object.entries(state.cells || {}).filter(([,c]) => c.seed).map(([key,c]) => ({key,seed:c.seed,plantedAt:c.plantedAt,ready:growth(c,minutes)?.stage === 'ready'})),
      buildings:(state.buildings || []).map(b => ({id:b.id,kind:b.kind,status:b.status,name:buildingById(b.kind)?.name || 'building'})),
    };
    try {
      this.line = game.store.residentLine({id:home.residentId,name:home.name},context);
    } catch (error) {
      game.toast?.(error.message);
    }
  }

  /** Tap: keep this friend selected, and play the wave once. */
  greet(actor) {
    const game = this.game;
    const home = actor?.userData;
    if (!home?.residentId) return;
    this.menuId = home.residentId;
    this.sayHello(actor);
    // Working or mid-action: open the menu without interrupting the job.
    if (game.action || game.autoWork?.active) {
      game.notify?.();
      return;
    }
    const wave = this.waveClip(home.clips);
    if (!wave) {
      game.notify?.();
      return;
    }
    if (actor === game.actor) {
      game.path = [];
      game.order = null;
      if (game.marker) game.marker.visible = false;
      game.walkSpeed = 0;
      game.currentClip = null;
      game.locomotion = null;
    }
    home.mixer.stopAllAction();
    wave.reset();
    wave.setLoop(THREE.LoopOnce, 1);
    wave.clampWhenFinished = true;
    wave.enabled = true;
    wave.play();
    home.waving = true;
    home.waveAction = wave;
    home.idling = false;
    home.flourish = null;
    home.strollState = { wait: 6 + Math.random() * 4 };
    game.notify?.();
  }

  cancelWave(actor = this.game.actor) {
    const home = actor?.userData;
    if (!home?.waving) return;
    home.waveAction?.stop();
    home.waving = false;
    home.waveAction = null;
    home.idling = false;
    if (actor === this.game.actor) {
      this.game.currentClip = null;
      this.game.locomotion = null;
    }
  }

  waveActive(actor = this.game.actor) {
    return !!actor?.userData?.waving;
  }

  stepWave(dt, actor = this.game.actor) {
    const home = actor?.userData;
    if (!home?.waving || !home.waveAction) return;
    home.mixer.update(dt);
    const clip = home.waveAction.getClip();
    if (home.waveAction.time >= clip.duration - 0.04) this.cancelWave(actor);
  }

  talk(actor = this.game.actor) {
    const home = actor?.userData;
    if (!home?.residentId || !window.parent || window.parent === window) return;
    window.parent.postMessage({
      type: 'gk-resident-talk',
      character: {
        id: home.residentId,
        name: home.name,
        imageUrl: home.imageUrl || '',
        sourceStoryId: home.sourceStoryId || '',
      },
      world: this.game.autoWork?.brief?.() || null,
    }, location.origin);
  }

  /** A tap on the character's body, even when the ray misses a thin limb. */
  bodyHit(clientX, clientY) {
    const actor = this.game.actor;
    if (!actor?.userData?.residentId) return false;
    const rect = this.game.renderer.domElement.getBoundingClientRect();
    const widthPx = rect.width;
    const heightPx = rect.height;
    if (!widthPx || !heightPx) return false;
    actor.updateWorldMatrix(true, false);
    const base = actor.getWorldPosition(new THREE.Vector3());
    const project = (height) => {
      const point = base.clone().add(new THREE.Vector3(0, height, 0)).project(this.game.camera);
      return { x: (point.x + 1) * widthPx / 2, y: (1 - point.y) * heightPx / 2, z: point.z };
    };
    const feet = project(0.05);
    const head = project(1.85);
    if (head.z < -1 || head.z > 1) return false;
    const boxW = Math.max(52, Math.abs(feet.y - head.y) * 0.62);
    const left = (head.x + feet.x) / 2 - boxW / 2;
    const top = Math.min(head.y, feet.y) - 10;
    const boxH = Math.abs(feet.y - head.y) + 18;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return x >= left && x <= left + boxW && y >= top && y <= top + boxH;
  }

  /** A calm looping idle, if the model ships one. Idle_03 on these rigs is a stretch, not a stand. */
  calmIdle(home) {
    const clips = home.clips || {};
    return clips.Idle_9 || clips.Idle || clips.Idle_01 || clips.Idle_02 || Object.entries(clips).find(([n]) => /^idle/i.test(n) && n !== 'Idle_03')?.[1] || null;
  }

  /**
   * Keep a standing friend alive for one frame: a calm clip when the model has
   * one, otherwise the island's relaxed breathing on top of the rest pose. Every
   * so often the stretch (Idle_03) plays once as a flourish, then it's back to calm.
   */
  idleActor(actor, dt) {
    const home = actor.userData;
    const now = performance.now();
    if (home.flourish) {
      home.mixer.update(dt);
      if (home.flourish.time >= home.flourish.getClip().duration - 0.05) { home.flourish.stop(); home.flourish = null; home.idling = false; }
      return;
    }
    if (!home.nextFlourish) home.nextFlourish = now + 15000 + Math.random() * 25000;
    const stretch = home.clips?.Idle_03;
    if (stretch && now > home.nextFlourish && !this.game.store?.state?.night) {
      home.nextFlourish = now + 20000 + Math.random() * 30000;
      home.mixer.stopAllAction();
      stretch.reset().setLoop(THREE.LoopOnce, 1); stretch.clampWhenFinished = false; stretch.play();
      home.flourish = stretch; home.idling = true;
      home.mixer.update(dt);
      return;
    }
    const calm = this.calmIdle(home);
    if (calm) {
      if (!home.idling || !calm.isRunning()) { home.mixer.stopAllAction(); calm.reset().setLoop(THREE.LoopRepeat, Infinity).play(); home.idling = true; }
      home.mixer.update(dt);
      return;
    }
    // No calm clip: rest pose + the shared relaxed upper-body idle (what the island uses for the hero).
    if (home.mixer._actions.some((a) => a.isRunning())) home.mixer.stopAllAction();
    home.idling = true;
    for (const p of home.restPose || []) { p.bone.position.copy(p.position); p.bone.quaternion.copy(p.quaternion); }
    this.game.idlePose?.apply(home.bones, now / 1000 + (home.idlePhase ??= Math.random() * 7));
  }

  /** Back-compat: callers that only want the idle started. */
  playIdle(actor) { this.idleActor(actor, 0); }

  /** A nearby free spot to stroll to, within a few metres of where the friend was dropped off. */
  pickStroll(home) {
    const nav = this.game.nav; if (!nav) return null;
    const anchor = home.anchor || (home.anchor = { x: home.x, y: home.y });
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, r = 1.2 + 3.3 * Math.sqrt(Math.random());
      const spot = nav.nearest({ x: anchor.x + Math.cos(a) * r, y: anchor.y + Math.sin(a) * r }, 1);
      if (spot && dist(spot, home) > 0.9 && dist(spot, this.game.player) > 1.2) return spot;
    }
    return null;
  }

  /**
   * A friend on a building crew is shown where the project simulation says they are:
   * walking to the site, hammering at their station, or away sleeping at home.
   * Returns true while the project owns this friend for the frame.
   */
  buildDuty(actor, dt) {
    const home = actor.userData, game = this.game, s = game.store?.state;
    if (!s || !game.loaded || home.id === s.activeCharacter || actor === game.actor) return false; // the one you play is yours, never the project's
    const now = Date.now();
    const a = projectAssignments(s, now).find((m) => m.id === home.id);
    if (!a) { if (home.hammer) { home.hammer.visible = false; home.bench.visible = false; } if (home.onDuty) { home.onDuty = false; home.strollState = { wait: 2 + Math.random() * 3 }; home.anchor = null; } return false; }
    home.onDuty = true;
    if (home.chore) { this.claims.delete(home.chore.key); home.chore = null; }
    home.strollState = null;
    actor.visible = !a.resting;
    this.place(actor, a.position.x, a.position.y);
    if (a.resting) { if (home.hammer) { home.hammer.visible = false; home.bench.visible = false; } return true; }
    if (a.walking) {
      if (home.hammer) { home.hammer.visible = false; home.bench.visible = false; }
      const ahead = projectAssignments(s, now + 250).find((m) => m.id === home.id)?.position || a.position;
      const dx = ahead.x - a.position.x, dy = ahead.y - a.position.y;
      if (Math.hypot(dx, dy) > 1e-4) turnToward(actor, Math.atan2(dx, -dy), dt);
      const walk = home.clips?.Walking;
      if (walk) {
        if (!walk.isRunning() || home.idling || home.flourish) { home.mixer.stopAllAction(); walk.reset().setLoop(THREE.LoopRepeat, Infinity).play(); walk.setEffectiveTimeScale(1); home.idling = false; home.flourish = null; }
        home.mixer.update(dt);
      }
      return true;
    }
    if (a.working && home.bones?.mixamorigRightHand) {
      const t = a.job?.target || a.position;
      actor.rotation.y = Math.atan2(t.x - a.position.x, -(t.y - a.position.y));
      this.animateBuilder(home, actor, now);
      return true;
    }
    // Waiting (for a free home, a clear path, or because you are playing them): stand at the spot.
    if (home.hammer) { home.hammer.visible = false; home.bench.visible = false; }
    this.idleActor(actor, dt);
    return true;
  }

  /** Hammer swing at the workbench, same timing as the hero's build pose. */
  animateBuilder(home, actor, now) {
    const game = this.game;
    if (!home.rig) {
      const rig = { actor, bones: home.bones, scene: game.scene, world: game.world, particleGeometry: game.particleGeometry, particleMaterials: game.particleMaterials, particles: game.particles };
      for (const name of ['ik', 'solveChain', 'localPoint']) rig[name] = game[name].bind(rig);
      home.rig = rig; home.hammer = game.asset('tool_hammer'); home.bench = game.asset('construction_workbench'); home.hammer.visible = false; home.bench.visible = false; game.scene.add(home.hammer, home.bench);
    }
    resetAnimatedPose(home); home.idling = false; home.flourish = null;
    const rig = home.rig, phase = (now % 820) / 820, { wrist, head } = game.building.targets(phase);
    home.bones.mixamorigSpine?.rotateX(.12); actor.updateMatrixWorld(true); rig.ik('Right', rig.localPoint(wrist)); rig.ik('Left', rig.localPoint([.3, .98, .66])); actor.updateMatrixWorld(true);
    const grip = home.bones.mixamorigRightHand.localToWorld(new THREE.Vector3(0, .065, 0)), contact = home.hammer.userData.contact_local || [.3, .7, 0], local = new THREE.Vector3(contact[0], contact[2], -contact[1]), target = rig.localPoint(head);
    home.toolScale ??= THREE.MathUtils.clamp(grip.distanceTo(target) / Math.max(.01, local.length()), .45, 1.5);
    home.hammer.visible = true; home.hammer.scale.setScalar(home.toolScale); home.hammer.position.copy(grip); home.hammer.quaternion.setFromUnitVectors(local.normalize(), target.sub(grip).normalize());
    home.bench.visible = true; home.bench.position.copy(rig.localPoint([0, 0, .8])); home.bench.quaternion.copy(actor.quaternion);
    // Same working effects the hero gets: sweat beads off the brow, and a puff of wood chips when the hammer lands.
    if (actor.visible && !game.overview) {
      emitWorkSweat(game, home, home.bones, performance.now());
      const swing = Math.floor(now / 820);
      if (phase >= .64 && home.hammerSwing !== swing) { home.hammerSwing = swing; game.burst({ x: home.bench.position.x, y: -home.bench.position.z }, 'wood', .88); }
    }
  }

  /** Friends who aren't being played wander a little between idles, so the island feels lived in. */
  stroll(actor, dt) {
    const home = actor.userData, game = this.game;
    if (this.buildDuty(actor, dt)) return;
    if (game.store?.state?.night) { home.strollState = null; this.idleActor(actor, dt); return; }
    if (home.chore) {
      const c = home.chore;
      if (c.path.length) { this.walkAlong(actor, c.path, 1.7, dt); return; }
      if (c.dwell == null) { c.dwell = c.kind === 'fish' ? 6 : c.kind === 'chop' || c.kind === 'mine' ? 1 : 1.1; c.baseDwell = c.dwell; }
      c.dwell -= dt * (['fish', 'harvest'].includes(c.kind) ? 1 : workRate(game.store.state, gameTime(game.store.state), home.id));
      if (c.target) turnToward(actor, Math.atan2(c.target.x - home.x, -(c.target.y - home.y)), dt);
      this.idleActor(actor, dt);
      if (c.dwell <= 0) { this.finishChore(actor); home.strollState = { wait: 4 + Math.random() * 4 }; }
      return;
    }
    const st = home.strollState || (home.strollState = { wait: 2 + Math.random() * 6 });
    if (!st.path?.length && performance.now() - this.lastChoreScan > 1200) {
      this.lastChoreScan = performance.now();
      const chore = this.pickChore(home, actor);
      if (chore) { home.chore = chore; this.claims.set(chore.key, home.id); game.notify?.(); return; }
    }
    if (st.path?.length) {
      const speed = 1.05, pos = { x: home.x, y: home.y };
      advancePath(pos, st.path, speed * dt);
      const mx = pos.x - home.x, my = pos.y - home.y;
      if (Math.hypot(mx, my) > 1e-5) turnToward(actor, Math.atan2(mx, -my), dt);
      this.place(actor, pos.x, pos.y);
      const walk = home.clips?.Walking;
      if (walk) {
        if (!walk.isRunning() || home.idling || home.flourish) { home.mixer.stopAllAction(); walk.reset().setLoop(THREE.LoopRepeat, Infinity).play(); walk.setEffectiveTimeScale(speed / 1.5); home.idling = false; home.flourish = null; }
        home.mixer.update(dt);
      }
      if (!st.path.length) home.strollState = { wait: 5 + Math.random() * 9 };
      return;
    }
    st.wait -= dt;
    if (st.wait <= 0) {
      const target = this.pickStroll(home);
      const path = target && game.nav.path({ x: home.x, y: home.y }, target);
      if (path?.length) { home.strollState = { path }; return; }
      st.wait = 3 + Math.random() * 5;
    }
    this.idleActor(actor, dt);
  }

  /** Friends waiting their turn keep breathing. The one you control is animated by the island. */
  update(dt) {
    const game = this.game;
    const night = !!game.store?.state?.night;
    for (const actor of this.models.values()) {
      const driving = actor === game.actor && actor.userData.id === this.activeId && !night && !game.action;
      if (driving) {
        const home = actor.userData;
        home.x = game.player.x;
        home.y = game.player.y;
        if (home.waving) continue;
        const still = !game.path.length && !game.order && !game.keys.size && (game.walkSpeed || 0) < 0.05 && !game.building?.preview;
        if (still) {
          // Standing around after a job: play the same full idle the parked friends use,
          // so the character you control never looks frozen.
          home.stillFor = (home.stillFor || 0) + dt;
          if (home.stillFor > 1.1) this.idleActor(actor, dt);
          // Left alone long enough, the character you play wanders too. Any tap takes over again.
          home.nextStroll ??= 6 + Math.random() * 8;
          if (home.stillFor > home.nextStroll && !night && !game.autoWork?.active && !game.building?.preview && !game.fishing?.active && !this.menuId && !game.nutrition?.sleep) {
            if (!home.anchor || dist(home.anchor, home) > 6) home.anchor = { x: home.x, y: home.y };
            const target = this.pickStroll(home);
            if (target) { game.walk(target); home.nextStroll = 6 + Math.random() * 10; }
            else home.nextStroll = home.stillFor + 4;
          }
          continue;
        }
        home.stillFor = 0;
        home.nextStroll = null;
        // Moving: nothing but the walk cycle may run on this mixer, or stray idle
        // clips (stretches, waves) blend into the walk.
        const stray = home.mixer._actions.some((a) => a.isRunning() && a.getClip().name !== 'Walking');
        if (home.idling || stray || home.flourish) {
          home.mixer.stopAllAction();
          home.idling = false;
          home.flourish = null;
          game.currentClip = null;
          game.locomotion = null;
        }
        continue;
      }
      if (actor.userData.waving) {
        actor.userData.mixer?.update(dt);
        const action = actor.userData.waveAction;
        if (action && action.time >= action.getClip().duration - 0.04) this.cancelWave(actor);
        continue;
      }
      if (actor === game.actor && game.action) continue;
      if (actor === game.actor) { this.idleActor(actor, dt); continue; }
      this.stroll(actor, dt);
    }
    if (this.activeId && performance.now() - (this.lastSave || 0) > 2000) {
      this.lastSave = performance.now();
      this.remember();
      if (game.loaded) this.shareBeds();
    }
  }

  remember() {
    const list = readResidents();
    let changed = false;
    for (const resident of list) {
      const actor = this.models.get(resident.id);
      if (!actor) continue;
      const { x, y } = actor.userData;
      if (Math.hypot((resident.x || 0) - x, (resident.y || 0) - y) < 0.05) continue;
      resident.x = x;
      resident.y = y;
      changed = true;
    }
    if (changed) writeResidents(list);
  }

  async makeActor(resident) {
    if (!resident.modelUrl) return null;
    try {
      const gltf = await this.loader.loadAsync(resident.modelUrl);
      const group = new THREE.Group();
      const model = gltf.scene;
      group.add(model);
      const bones = {};
      const restPose = [];
      model.traverse((obj) => {
        if (obj.isBone) {
          bones[obj.name.replace(/[^a-zA-Z0-9]/g, '')] = obj;
          restPose.push({ bone: obj, position: obj.position.clone(), quaternion: obj.quaternion.clone() });
        }
        if (obj.isMesh) {
          obj.castShadow = true;
          if (obj.isSkinnedMesh) obj.frustumCulled = false;
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const material of mats) {
            if (!material) continue;
            material.metalness = 0;
            material.metalnessMap = null;
            material.roughness = Math.max(0.85, material.roughness || 0);
            material.emissive?.set('#000000');
            material.emissiveIntensity = 0;
            material.needsUpdate = true;
          }
        }
      });
      normalizeCharacterModel(model);
      const mixer = new THREE.AnimationMixer(model);
      const clips = {};
      for (const original of gltf.animations || []) {
        const clip = original.clone();
        for (const track of clip.tracks) {
          if (track.name.endsWith('.position') && /Hips|Pelvis/i.test(track.name)) {
            for (let i = 0; i < track.values.length; i += 3) {
              track.values[i] = track.values[0];
              track.values[i + 2] = track.values[2];
            }
          }
        }
        clips[original.name] = mixer.clipAction(clip);
      }
      aliasClip(clips, 'Walking', /walk/i);
      aliasClip(clips, 'Idle_03', /idle|stand|breath/i);
      aliasClip(clips, 'Running', /run/i);
      aliasClip(clips, 'Wave', /wave/i);
      group.userData.mixer = mixer;
      group.userData.model = model;
      group.userData.bones = bones;
      group.userData.restPose = restPose;
      group.userData.clips = clips;
      group.userData.name = resident.name;
      group.userData.modelUrl = resident.modelUrl || '';
      group.userData.residentId = resident.id;
      group.userData.id = resident.id;
      group.userData.imageUrl = resident.imageUrl || '';
      group.userData.sourceStoryId = resident.sourceStoryId || '';
      return group;
    } catch (error) {
      console.warn('Players World could not load', resident.name, error);
      this.game.toast(`${resident.name} could not appear on the island.`);
      return null;
    }
  }

  dispose() {
    window.removeEventListener('message', this.onMessage);
    this.draco?.dispose();
  }
}
