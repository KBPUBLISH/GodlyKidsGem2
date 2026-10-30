import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { heightAt, terrainType, dist, animalPlacementStatus, gameTime } from './core.mjs';
import { activeBuildings, footprint, pointInBounds } from './building.mjs';
import { ANIMALS, animalById, animalShop, ANIMAL_PRICE, DOG_CAPACITY, LIVESTOCK } from './animals.mjs';
import { cellKey, enclosureMap, herdPlan, nearStable, regionAt, seedAmbient, threatTarget } from './fencing.mjs';
import { MORNING } from './island-clock.mjs';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);
const FADE = 0.25;
const GROUND_LIFT = 0.01;
const HIT_MATERIAL = new THREE.MeshBasicMaterial({ visible: false });
/** Shortest signed angle from a to b. */
const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
/** Stable day: the doors open at 7:00 island time and everyone is back inside by 18:00 (dusk herding starts 20:30). */
const GRAZE_OUT = MORNING, GRAZE_IN = 1080, GRAZE_STAGGER = 45;
/** How far from the stable the herd grazes when no fence closes a paddock around it. */
const PASTURE_RADIUS = 6;
const STABLE_MARGIN = 0.8;
const TMP_Q = new THREE.Quaternion(), TMP_Q2 = new THREE.Quaternion(), TMP_V = new THREE.Vector3(), TMP_V2 = new THREE.Vector3();
const hashId = (id) => { let h = 2166136261; const s = String(id || ''); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

/**
 * Placed farm and wild animals. Each GLB kind is loaded once and cloned per saved
 * animal (`state.animals`). Animals idle, then wander near where they were placed.
 * World coords are x,y on the ground; three.js position is (x, heightAt, -y).
 */
export class Animals {
  constructor(game) {
    this.game = game;
    this.loader = new GLTFLoader();
    this.kinds = new Map(); // kind -> Promise<{scene, clips}>
    this.instances = new Map(); // id -> instance
    this.group = new THREE.Group();
    this.group.name = 'animals';
    game.scene.add(this.group);
    this.placing = null;
    this.confirming = null;
    this.paidKind = null;
    this.disposed = false;
    this.lastSignature = null;
    this.signatureClock = 0;
    this.herd = [];
    this.herdClock = 0;
    this.roundups = new Map();
    this.onMessage = (event) => {
      if (event.origin !== location.origin || !event.data) return;
      const { type } = event.data;
      if (type === 'gk-coins' && Number.isFinite(event.data.balance)) { this.game.coins = event.data.balance; this.game.notify?.(); }
      if (type === 'gk-buy-result') this.onBuyResult(event.data);
    };
    window.addEventListener('message', this.onMessage);
    if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'gk-coins-please' }, location.origin);
    this.ensureAmbient();
    this.sync();
  }

  ensureAmbient() {
    const store = this.game.store;
    if (!store || store.locked) return;
    const next = seedAmbient(store.state, this.game.world);
    if (next !== store.state) { try { store.save(next); } catch { /* save reports its own error */ } }
  }

  penMap() {
    const rev = this.game.store?.state?.revision;
    if (this.mapRev !== rev) { this.mapRev = rev; this.map = enclosureMap(this.game.world, this.game.store.state.buildings || []); }
    return this.map;
  }

  /** Livestock with no closed pen wander. Sheep range the farthest. A stable home follows stableRoutine instead (pasture by day, stall by night). */
  roaming(inst) {
    if(this.game.livingTestMode&&inst.id.startsWith('living-farm-'))return false;
    if (!LIVESTOCK.has(inst.kind) || inst.record?.wild) return false;
    const home = inst.home || inst;
    if (nearStable(this.game.world, this.game.store.state, home.x, home.y)) return false;
    return !regionAt(this.penMap(), this.game.world, inst.x, inst.y);
  }

  /** Load (once) and prepare a kind: flat, non-metallic materials and shadows on the source. */
  load(kind) {
    const def = animalById(kind);
    if (!def) return Promise.reject(Error(`Unknown animal: ${kind}`));
    if (!this.kinds.has(kind)) {
      const promise = this.loader.loadAsync(def.url).then((gltf) => {
        // The export keeps each animal where it stood in the shared Blender scene (e.g. x≈30 m).
        // Bring the asset root back to the origin; the Root bone tracks themselves sit at 0.
        for (const child of gltf.scene.children) { child.position.x = 0; child.position.z = 0; }
        gltf.scene.traverse((obj) => {
          if (!obj.isMesh) return;
          obj.castShadow = true;
          obj.receiveShadow = false;
          // iPad keeps frustum culling so animals off to the side are not shadowed. Phones and desktop leave it off.
          if (obj.isSkinnedMesh) obj.frustumCulled = !!this.game.ipadQuality;
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const material of mats) {
            if (!material) continue;
            material.metalness = 0;
            material.metalnessMap = null;
            material.roughness = Math.max(0.85, material.roughness || 0);
            material.roughnessMap = null;
            material.emissive?.set('#000000');
            material.emissiveIntensity = 0;
            material.needsUpdate = true;
          }
        });
        const clips = {};
        for (const clip of gltf.animations || []) clips[clip.name] = clip;
        // Rest-pose bounds drive a cheap invisible tap target per instance.
        gltf.scene.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(gltf.scene);
        return { scene: gltf.scene, clips, def, bounds };
      });
      promise.catch((error) => {
        console.warn('Players World could not load animal', kind, error);
        this.kinds.delete(kind);
      });
      this.kinds.set(kind, promise);
    }
    return this.kinds.get(kind);
  }

  /** Reconcile scene instances with `state.animals`. Safe to call often. */
  sync() {
    const list = this.game.store?.state?.animals || [];
    this.lastSignature = list.map((a) => a.id).join('|');
    const keep = new Set(list.map((a) => a.id));
    for (const [id, inst] of this.instances) {
      if (keep.has(id)) continue;
      this.destroy(inst);
      this.instances.delete(id);
    }
    for (const record of list) {
      if (this.instances.has(record.id)) continue;
      const def = animalById(record.kind);
      if (!def) continue;
      // Reserve the slot immediately so a second sync() during loading does not double-spawn.
      const inst = { id: record.id, kind: record.kind, def, record, home: { x: record.x, y: record.y }, x: record.x, y: record.y, root: null, mixer: null, actions: {}, current: null, mode: 'loading', wait: rand(1, 4), path: null, yaw: Math.random() * Math.PI * 2, targetYaw: 0 };
      inst.targetYaw = inst.yaw;
      this.instances.set(record.id, inst);
      this.spawn(inst).catch(() => {});
    }
  }

  async spawn(inst) {
    let source;
    try { source = await this.load(inst.kind); } catch { if (this.instances.get(inst.id) === inst) { this.instances.delete(inst.id); this.game.toast?.(`The ${inst.def.name.toLowerCase()} could not come to the island.`); } return; }
    if (this.disposed || this.instances.get(inst.id) !== inst) return;
    const model = cloneSkinned(source.scene);
    model.scale.setScalar(inst.def.scale || 1);
    const root = new THREE.Group();
    root.name = `animal:${inst.id}`;
    root.userData.animalId = inst.id;
    root.add(model);
    model.traverse((obj) => { obj.userData.animalId = inst.id; });
    // Tap target: a padded, invisible box (raycasting the skinned meshes themselves is far too slow).
    const size = source.bounds.getSize(V()).multiplyScalar(inst.def.scale || 1), center = source.bounds.getCenter(V()).multiplyScalar(inst.def.scale || 1);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.5, size.x * 1.2), Math.max(0.5, size.y * 1.15), Math.max(0.5, size.z * 1.2)), HIT_MATERIAL);
    hit.position.copy(center);
    hit.visible = false;
    hit.userData.animalId = inst.id;
    hit.userData.hitBox = true;
    root.add(hit);
    inst.hit = hit;
    const mixer = new THREE.AnimationMixer(model);
    const actions = {};
    for (const key of ['idle', 'move', 'fly']) {
      const clip = inst.def[key] && source.clips[inst.def[key]];
      if (clip) actions[key] = mixer.clipAction(clip);
    }
    inst.root = root;
    inst.model = model;
    inst.mixer = mixer;
    inst.actions = actions;
    // Neck and Head bones take the procedural head-down graze; the GLBs ship only Idle and Walk clips.
    inst.bones = ['Neck', 'Head'].map((name) => model.getObjectByName(name)).filter((b) => b && b.isBone);
    inst.length = Math.max(0.4, size.z);
    inst.mode = 'idle';
    root.rotation.y = inst.yaw;
    this.place(inst, inst.x, inst.y);
    this.group.add(root);
    this.play(inst, 'idle');
    // Stagger idle phases so a herd does not breathe in unison.
    if (actions.idle) actions.idle.time = Math.random() * actions.idle.getClip().duration;
  }

  destroy(inst) {
    if (inst.root) {
      this.group.remove(inst.root);
      inst.mixer?.stopAllAction();
      inst.mixer?.uncacheRoot(inst.model);
      inst.hit?.geometry.dispose();
    }
    inst.mode = 'gone';
  }

  place(inst, x, y, lift = 0) {
    inst.x = x;
    inst.y = y;
    inst.lift = lift;
    inst.root?.position.set(x, heightAt(this.game.world, x, y) + GROUND_LIFT + lift, -y);
  }

  play(inst, key) {
    const next = inst.actions[key] || inst.actions.idle;
    if (!next || inst.current === next) return;
    next.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(FADE).play();
    inst.current?.fadeOut(FADE);
    inst.current = next;
  }

  /** Is this ground point somewhere an animal may stand? Dry land, clear of buildings (except `through`, its own stable). */
  walkable(x, y, through = null) {
    if (terrainType(this.game.world, x, y) === 0) return false;
    const state = this.game.store.state;
    for (const b of activeBuildings(state)) {
      if (through && b.id === through.id) continue;
      const fp = footprint(this.game.world, b);
      if (fp && pointInBounds({ x, y }, fp.bounds, 0.3)) return false;
    }
    return true;
  }

  /** Pasture grass: walkable, grass (not beach), and never a garden plot or a planted cell. */
  grazeable(x, y) {
    const world = this.game.world;
    if (terrainType(world, x, y) !== 2 || !this.walkable(x, y)) return false;
    const key = cellKey(world, x, y);
    if (world.gardenSlots?.some((s) => s.key === key)) return false;
    return !this.game.store.state.cells?.[key]?.seed;
  }

  /** The completed stable this animal lives in (its saved spot is within the stable margin), or null. */
  stableFor(inst) {
    if (!LIVESTOCK.has(inst.kind) || inst.record?.wild) return null;
    const state = this.game.store?.state;
    if (!state) return null;
    const home = inst.home || inst;
    if (inst._stableRev === state.revision && inst._stableHome === inst.home) return inst._stable;
    inst._stableRev = state.revision;
    inst._stableHome = inst.home;
    inst._stable = null;
    for (const b of state.buildings || []) {
      if (b.status !== 'complete' || b.kind !== 'stable') continue;
      const fp = footprint(this.game.world, b);
      if (fp && pointInBounds(home, fp.bounds, STABLE_MARGIN)) { inst._stable = { ...fp, id: b.id }; break; }
    }
    return inst._stable;
  }

  /** Minute of the island day, 0–1439. */
  dayMinute() {
    const state = this.game.store?.state;
    if (!state?.clock) return 720;
    return ((gameTime(state) % 1440) + 1440) % 1440;
  }

  /** Daytime pasture hours for a stabled animal. Each animal keeps its own offset so the herd files out and back in rather than stampeding. */
  grazingHours(inst) {
    const state = this.game.store?.state;
    if (!state || state.night) return false;
    const stagger = (hashId(inst.id) % GRAZE_STAGGER);
    const m = this.dayMinute();
    return m >= GRAZE_OUT + stagger && m < GRAZE_IN - stagger * 0.6;
  }

  /** Each animal's own stall inside the stable, so a herd does not stand on one spot. */
  stallFor(inst, fp) {
    const h = hashId(inst.id), u = (h % 1000) / 1000, v = (Math.floor(h / 1000) % 1000) / 1000;
    return { x: fp.x + 0.55 + u * Math.max(0, fp.w - 1.1), y: fp.y + 0.45 + v * Math.max(0, fp.h - 0.9) };
  }

  /** Open grass near the stable. Inside the fenced paddock when one closes around the stable; otherwise within the pasture radius, never into another pen. */
  pickPasture(inst, fp) {
    const world = this.game.world, map = this.penMap();
    const paddock = fp.keys.map((k) => map.region.get(k) || 0).find(Boolean) || 0;
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, r = 1.8 + Math.sqrt(Math.random()) * (PASTURE_RADIUS - 1.8);
      const candidate = { x: fp.center.x + Math.cos(a) * r, y: fp.center.y + Math.sin(a) * r };
      if (!this.grazeable(candidate.x, candidate.y) || regionAt(map, world, candidate.x, candidate.y) !== paddock) continue;
      const snapped = this.game.nav?.nearest ? this.game.nav.nearest(candidate, 1) : candidate;
      if (!snapped || dist(snapped, inst) < 0.8 || !this.grazeable(snapped.x, snapped.y)) continue;
      if (regionAt(map, world, snapped.x, snapped.y) !== paddock) continue;
      return snapped;
    }
    return null;
  }

  /** Random reachable spot near home, or null. */
  pickTarget(inst) {
    const map = this.penMap();
    const world = this.game.world, state = this.game.store.state;
    const home = inst.home || inst;
    const stabled = !inst.record?.wild && nearStable(world, state, home.x, home.y);
    const pen = regionAt(map, world, inst.x, inst.y);
    const roaming = this.roaming(inst);
    const radius = stabled ? 1.1 : pen ? Math.min(inst.def.wander || 3, 2.2) : roaming ? (inst.kind === 'sheep' ? 18 : (inst.def.wander || 4) * 2.5) : (inst.def.wander || 4);
    const origin = stabled ? home : (roaming || pen ? { x: inst.x, y: inst.y } : inst.home);
    const tries = roaming ? 14 : 8;
    for (let i = 0; i < tries; i++) {
      const a = Math.random() * Math.PI * 2, r = radius * Math.sqrt(Math.random());
      const candidate = { x: origin.x + Math.cos(a) * r, y: origin.y + Math.sin(a) * r };
      if (dist(candidate, inst) < 0.6 || !this.walkable(candidate.x, candidate.y)) continue;
      if (pen && regionAt(map, world, candidate.x, candidate.y) !== pen) continue;
      const snapped = this.game.nav?.nearest ? this.game.nav.nearest(candidate, 1) : candidate;
      if (!snapped || !this.walkable(snapped.x, snapped.y)) continue;
      if (pen && regionAt(map, world, snapped.x, snapped.y) !== pen) continue;
      if (stabled && !nearStable(world, state, snapped.x, snapped.y)) continue;
      return snapped;
    }
    return null;
  }

  /** A path to the target: the island navigator when available, else a straight line over dry land. */
  routeTo(inst, target, through = null) {
    const path = this.game.nav?.path?.(inst, target);
    if (path && path.length) {
      // The navigator stops at the stable wall; a stabled animal finishes the last step into its stall.
      if (through && dist(path[path.length - 1], target) > 0.3) path.push(target);
      return path;
    }
    const steps = Math.max(2, Math.ceil(dist(inst, target) / 0.5));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!this.walkable(inst.x + (target.x - inst.x) * t, inst.y + (target.y - inst.y) * t, through)) return null;
    }
    return [target];
  }

  /**
   * A stabled animal's day. Out on the pasture during grazing hours (walk, stop, head-down graze);
   * back to its stall by 18:00, and in for the night (and any time the kid sleeps).
   */
  stableRoutine(inst, fp, night) {
    const inside = pointInBounds(inst, fp.bounds, STABLE_MARGIN);
    if (!night && this.grazingHours(inst)) {
      if (!inside && Math.random() < 0.6) { this.startGraze(inst); return; }
      const target = this.pickPasture(inst, fp);
      const path = target && this.routeTo(inst, target, fp);
      if (!path) { inst.wait = rand(3, 7); return; }
      inst.rush = 0;
      inst.path = path;
      inst.mode = 'move';
      this.play(inst, 'move');
      return;
    }
    if (inside) { inst.wait = rand(8, 15); return; }
    const stall = this.stallFor(inst, fp);
    inst.rush = 0;
    inst.path = this.routeTo(inst, stall, fp) || [stall];
    inst.mode = 'move';
    this.play(inst, 'move');
  }

  /** Head down in the grass for a few seconds. Chickens peck; goats and sheep sometimes finish with a little hop. */
  startGraze(inst) {
    const peck = inst.kind === 'chicken';
    inst.graze = { t: 0, dur: peck ? rand(2, 3.5) : rand(3, 6), peck, hop: !peck && (inst.kind === 'goat' || inst.kind === 'sheep') && Math.random() < 0.3 };
    inst.mode = 'graze';
    inst.path = null;
    this.play(inst, 'idle');
  }

  stepGraze(inst, dt) {
    const g = inst.graze;
    if (!g) { inst.mode = 'idle'; inst.wait = 1; return; }
    g.t += dt;
    const u = Math.min(1, g.t / g.dur), env = Math.sin(Math.PI * u);
    inst.pitch = g.peck ? 0.9 * env * (0.55 + 0.45 * Math.max(0, Math.sin(g.t * 11))) : 1.05 * env;
    const lift = g.hop && u > 0.8 ? Math.sin(Math.PI * (u - 0.8) / 0.2) * 0.16 : 0;
    if (lift !== (inst.lift || 0)) this.place(inst, inst.x, inst.y, lift);
    if (u >= 1) {
      inst.pitch = 0;
      inst.graze = null;
      inst.mode = 'idle';
      inst.wait = rand(1.5, 4);
      if (inst.lift) this.place(inst, inst.x, inst.y, 0);
    }
  }

  /** Bend the neck and head toward the ground on top of whatever the clip did this frame. */
  poseHead(inst) {
    if (!inst.pitch || !inst.bones?.length) return;
    const share = inst.pitch / inst.bones.length;
    // Pitch about the body's sideways axis (model +x rotated by the yaw), expressed in each bone's parent frame.
    TMP_V.set(1, 0, 0).applyQuaternion(inst.root.quaternion);
    for (const bone of inst.bones) {
      bone.parent.getWorldQuaternion(TMP_Q2).invert();
      TMP_Q.setFromAxisAngle(TMP_V2.copy(TMP_V).applyQuaternion(TMP_Q2).normalize(), share);
      bone.quaternion.premultiply(TMP_Q);
    }
  }

  startWander(inst) {
    const target = this.pickTarget(inst);
    const path = target && this.routeTo(inst, target);
    if (!path) { inst.wait = rand(2, 5); return; }
    inst.path = path;
    inst.mode = 'move';
    this.play(inst, 'move');
  }

  /** Rabbits and squirrels: idle, then one short hop, then pause. Never a navmesh path. */
  startHop(inst) {
    const home = inst.home || { x: inst.x, y: inst.y };
    const away = Math.hypot(inst.x - home.x, inst.y - home.y);
    for (let i = 0; i < 6; i++) {
      const hopDist = 0.4 + Math.random() * 0.4;
      let ang = Math.random() * Math.PI * 2;
      if (away > 2.2) ang = Math.atan2(home.y - inst.y, home.x - inst.x) + (Math.random() - 0.5) * 0.7;
      const x = inst.x + Math.cos(ang) * hopDist;
      const y = inst.y + Math.sin(ang) * hopDist;
      if (!this.walkable(x, y)) continue;
      if (away > 2.2 && Math.hypot(x - home.x, y - home.y) > away - 0.12) continue;
      inst.hop = { x, y, fromX: inst.x, fromY: inst.y, dist: hopDist };
      inst.mode = 'hop';
      inst.path = null;
      inst.rush = 0;
      this.play(inst, 'move');
      return;
    }
    inst.wait = rand(1.2, 2.6);
  }

  stepHop(inst, dt) {
    const hop = inst.hop;
    const pause = () => {
      inst.hop = null;
      inst.mode = 'idle';
      inst.wait = rand(1.6, 3.8);
      this.play(inst, 'idle');
    };
    if (!hop) { pause(); return; }
    const maxStep = Math.min(1.2, 3) * dt;
    const dx = hop.x - inst.x, dy = hop.y - inst.y;
    const d = Math.hypot(dx, dy);
    if (!(d > 0) || d <= Math.max(0.02, maxStep)) {
      if (d <= 3 * dt) this.place(inst, hop.x, hop.y, 0);
      pause();
      return;
    }
    const step = Math.min(d, maxStep);
    const nx = inst.x + (dx / d) * step, ny = inst.y + (dy / d) * step;
    const travelled = Math.hypot(nx - hop.fromX, ny - hop.fromY);
    const u = Math.min(1, travelled / Math.max(0.05, hop.dist));
    this.place(inst, nx, ny, Math.sin(Math.PI * u) * 0.12);
    inst.targetYaw = Math.atan2(dx, -dy);
  }

  startFlight(inst) {
    // Rise, circle once, and land back on the take-off spot (already known to be dry land).
    const r = 1.6, a = Math.random() * Math.PI * 2, dir = Math.random() < 0.5 ? 1 : -1;
    inst.flight = { start: { x: inst.x, y: inst.y }, center: { x: inst.x + Math.cos(a) * r, y: inst.y + Math.sin(a) * r }, angle0: a + Math.PI, r, dir, t: 0, up: 1.1, circle: 4.5, down: 1.3 };
    inst.mode = 'fly';
    this.play(inst, 'fly');
  }

  stepFlight(inst, dt) {
    const f = inst.flight;
    f.t += dt;
    const total = f.up + f.circle + f.down;
    if (f.t >= total) {
      inst.flight = null;
      inst.mode = 'idle';
      inst.wait = this.roaming(inst) ? rand(0.35, 0.9) : rand(4, 10);
      this.place(inst, f.start.x, f.start.y);
      this.play(inst, 'idle');
      return;
    }
    const ease = (u) => { u = THREE.MathUtils.clamp(u, 0, 1); return u * u * (3 - 2 * u); };
    let lift, x, y, heading;
    if (f.t < f.up) {
      lift = 1.5 * ease(f.t / f.up); x = f.start.x; y = f.start.y;
      heading = f.angle0 + f.dir * Math.PI / 2;
    } else if (f.t < f.up + f.circle) {
      const u = (f.t - f.up) / f.circle, angle = f.angle0 + f.dir * u * Math.PI * 2;
      lift = 1.5 + Math.sin(u * Math.PI * 2) * 0.25;
      x = f.center.x + Math.cos(angle) * f.r; y = f.center.y + Math.sin(angle) * f.r;
      heading = angle + f.dir * Math.PI / 2;
    } else {
      const u = (f.t - f.up - f.circle) / f.down;
      lift = 1.5 * (1 - ease(u)); x = f.start.x; y = f.start.y;
      heading = f.angle0 + f.dir * Math.PI / 2;
    }
    this.place(inst, x, y, lift);
    // Face along the heading: +Z forward in three space, world y is -z.
    inst.targetYaw = Math.atan2(Math.cos(heading), -Math.sin(heading));
  }

  stepMove(inst, dt) {
    const raw = inst.rush || inst.def.speed || 0.7;
    // Coyotes keep their chase. Livestock wander shares this helper and cannot be flung faster than 3 m/s.
    const speed = inst.kind === 'coyote' ? raw : Math.min(raw, 3);
    let left = speed * dt;
    const x0 = inst.x, y0 = inst.y;
    while (inst.path?.length && left > 0) {
      const next = inst.path[0], d = dist(inst, next);
      if (d <= left) { this.place(inst, next.x, next.y); inst.path.shift(); left -= d; continue; }
      const k = left / d;
      inst.targetYaw = Math.atan2(next.x - inst.x, -(next.y - inst.y));
      this.place(inst, inst.x + (next.x - inst.x) * k, inst.y + (next.y - inst.y) * k);
      left = 0;
    }
    if (inst.kind !== 'coyote') {
      const dx = inst.x - x0, dy = inst.y - y0, moved = Math.hypot(dx, dy), cap = 3 * dt;
      if (moved > cap && moved > 0) this.place(inst, x0 + (dx * cap) / moved, y0 + (dy * cap) / moved, inst.lift || 0);
    }
    if (!inst.path?.length) {
      inst.path = null;
      inst.mode = 'idle';
      inst.wait = this.roaming(inst) ? rand(0.35, 0.9) : rand(4, 10);
      this.play(inst, 'idle');
    }
  }

  update(dt) {
    if (this.disposed) return;
    // Cheap reconcile if another window changed the save or a reset happened.
    this.signatureClock += dt;
    if (this.signatureClock > 1) {
      this.signatureClock = 0;
      const list = this.game.store?.state?.animals || [];
      if (list.map((a) => a.id).join('|') !== this.lastSignature) this.sync();
    }
    const night = !!this.game.store?.state?.night;
    const list = this.game.store?.state?.animals || [];
    const byId = new Map(list.map((a) => [a.id, a]));
    this.herdClock += dt;
    if (this.herdClock > 0.45) { this.herdClock = 0; this.refreshHerd(); }
    for (const inst of this.instances.values()) {
      if (!inst.root) continue;
      this.game.stepMixer(inst.mixer, dt);
      if (inst.model && (inst.kind === 'rabbit' || inst.kind === 'squirrel')) {
        for (const child of inst.model.children) {
          if (Math.abs(child.position.x) > 2 || Math.abs(child.position.z) > 2) { child.position.x = 0; child.position.z = 0; }
        }
      }
      const rec = byId.get(inst.id);
      if (rec) inst.record = rec;
      const wildlife = inst.kind === 'rabbit' || inst.kind === 'squirrel';
      // A hitch makes the sim delta much larger than the frame. Cap movement to the time that actually elapsed, and never more than 3 m/s.
      const nowMs = performance.now();
      const wall = inst._movedAt == null ? Math.min(dt, 0.05) : Math.min(0.05, Math.max(0, (nowMs - inst._movedAt) / 1000));
      inst._movedAt = nowMs;
      const stepDt = Math.min(dt, wall);
      // Herd snaps may move livestock in one step. A wildlife den only moves when we bring them back onto nearby grass.
      if (wildlife && rec && Math.hypot(rec.x - inst.home.x, rec.y - inst.home.y) > 1.5) {
        inst.home = { x: rec.x, y: rec.y };
        this.place(inst, rec.x, rec.y, 0);
        inst.hop = null;
        inst.path = null;
        inst.mode = 'idle';
        inst.wait = 0.3;
        inst._lastY = undefined;
      } else if (!wildlife && rec && Math.hypot(rec.x - inst.home.x, rec.y - inst.home.y) > 0.45) {
        inst.home = { x: rec.x, y: rec.y };
        inst.x = rec.x;
        inst.y = rec.y;
        inst.root.position.set(rec.x, heightAt(this.game.world, rec.x, rec.y) + GROUND_LIFT, -rec.y);
        inst.lift = 0;
        inst.path = null;
        inst.mode = 'idle';
        inst.wait = 0.2;
      }
      const x0 = inst.x, y0 = inst.y;
      const asDog = this.herd.find((h) => h.dogId === inst.id);
      const asAnimal = this.herd.find((h) => h.animalId === inst.id);
      const herdJob = asDog || asAnimal;
      if (herdJob && (!night || herdJob.manual)) {
        const followed = asDog ? this.instances.get(asDog.animalId) : null;
        const target = followed ? { x: followed.x, y: followed.y } : { x: (asAnimal || asDog).x, y: (asAnimal || asDog).y };
        if (!inst.path?.length || dist(inst.path[inst.path.length - 1], target) > 1.2) {
          inst.rush = asDog ? 1.6 : inst.def.speed;
          inst.path = this.routeTo(inst, target) || [target];
          inst.mode = 'move';
          this.play(inst, 'move');
        }
        this.stepMove(inst, stepDt);
      } else if (rec?.wild && rec.kind === 'coyote' && rec.flee) {
        // Abel shooed this one (garden-keeper.js). Run to the edge he pointed at; do not turn back toward the crops.
        inst.chasing = false;
        inst.rush = 8;
        const goal = { x: rec.x, y: rec.y };
        if (dist({ x: inst.x, y: inst.y }, goal) > 0.6) {
          if (inst.mode !== 'move' || !inst.path?.length) { inst.path = this.routeTo(inst, goal) || [goal]; inst.mode = 'move'; this.play(inst, 'move'); }
          this.stepMove(inst, stepDt);
        } else inst.mode = 'idle';
      } else if (rec?.wild && rec.kind === 'coyote' && inst.mode !== 'move') {
        inst.rush = 7;
        inst.chasing = true;
        const goal = threatTarget(this.game.world, this.game.store.state);
        inst.path = this.routeTo(inst, goal) || [goal];
        inst.mode = 'move';
        this.play(inst, 'move');
        this.stepMove(inst, stepDt);
      } else if (inst.mode === 'idle') {
        inst.wait -= dt;
        if (inst.wait <= 0) {
          // A stabled animal keeps its own day: out to pasture after 7:00, back in its stall by 18:00, and it still heads home if night catches it outside.
          const stable = !wildlife && this.stableFor(inst);
          if (stable) this.stableRoutine(inst, stable, night);
          else if (night) { /* asleep where it stands */ }
          else if (wildlife) this.startHop(inst);
          else if (inst.actions.fly && !this.roaming(inst) && Math.random() < 0.35) this.startFlight(inst);
          else this.startWander(inst);
        }
      } else if (inst.mode === 'graze') {
        this.stepGraze(inst, stepDt);
      } else if (inst.mode === 'hop') {
        this.stepHop(inst, stepDt);
      } else if (inst.mode === 'move') {
        this.stepMove(inst, stepDt);
      } else if (inst.mode === 'fly') {
        this.stepFlight(inst, dt);
      }
      if (wildlife) {
        const dx = inst.x - x0, dy = inst.y - y0, moved = Math.hypot(dx, dy), cap = 3 * stepDt;
        if (moved > cap && moved > 0) this.place(inst, x0 + (dx * cap) / moved, y0 + (dy * cap) / moved, inst.lift || 0);
      }
      // Bob is an offset from the ground. Adding abs(sin) every frame launched rabbits and squirrels tens of metres, then the next hop snapped them back.
      if ((wildlife || inst.kind === 'chicken') && inst.mode !== 'fly' && inst.root) {
        const bob = inst.kind === 'chicken' ? Math.sin((inst.mixer.time || 0) * 7) * 0.025 : (inst.mode === 'hop' ? 0 : Math.abs(Math.sin((inst.mixer.time || 0) * 6)) * 0.02);
        const targetY = heightAt(this.game.world, inst.x, inst.y) + GROUND_LIFT + (inst.lift || 0) + bob;
        if (wildlife) {
          if (inst._lastY === undefined) inst._lastY = targetY;
          const maxDy = 3 * stepDt;
          inst.root.position.y = inst._lastY + Math.max(-maxDy, Math.min(maxDy, targetY - inst._lastY));
          inst._lastY = inst.root.position.y;
        } else inst.root.position.y = targetY;
      }
      const turn = inst.mode === 'fly' ? 6 : 8;
      inst.yaw += angleDelta(inst.yaw, inst.targetYaw) * Math.min(1, dt * turn);
      inst.root.rotation.y = inst.yaw;
      this.poseHead(inst);
    }
    this.settleRoundup();
  }

  /** Dusk herd, plus any dog the player tapped. A tapped dog keeps its own animals. */
  refreshHerd() {
    const state = this.game.store?.state;
    if (!state) { this.herd = []; return; }
    const dusk = herdPlan(this.game.world, state, gameTime(state));
    const manual = [];
    for (const [dogId, round] of [...this.roundups]) {
      round.jobs = round.jobs.filter((job) => (state.animals || []).some((a) => a.id === job.animalId));
      if (!round.jobs.length) { this.roundups.delete(dogId); continue; }
      for (const job of round.jobs) manual.push({ dogId, animalId: job.animalId, x: job.x, y: job.y, manual: true });
    }
    const animals = new Set(manual.map((job) => job.animalId));
    const dogs = new Set(manual.map((job) => job.dogId));
    this.herd = [...manual, ...dusk.filter((job) => !animals.has(job.animalId) && !dogs.has(job.dogId))];
  }

  /** Once a walked animal reaches the stable, remember that spot so the next plan leaves it there. */
  settleRoundup() {
    if (!this.roundups?.size) return;
    const store = this.game.store;
    if (!store || store.locked) return;
    const arrived = [];
    for (const round of this.roundups.values()) {
      for (const job of round.jobs) {
        const inst = this.instances.get(job.animalId);
        if (inst && Math.hypot(inst.x - job.x, inst.y - job.y) <= 1.15) arrived.push({ job, inst });
      }
    }
    if (!arrived.length) return;
    const next = structuredClone(store.state);
    let changed = false;
    for (const { job } of arrived) {
      const animal = next.animals?.find((a) => a.id === job.animalId);
      if (!animal || Math.hypot(animal.x - job.x, animal.y - job.y) < 0.2) continue;
      animal.x = job.x;
      animal.y = job.y;
      changed = true;
    }
    if (changed) { try { store.save(next); } catch { return; } }
    const done = new Set(arrived.map(({ job }) => job.animalId));
    for (const { job, inst } of arrived) inst.home = { x: job.x, y: job.y };
    for (const [dogId, round] of [...this.roundups]) {
      round.jobs = round.jobs.filter((job) => !done.has(job.animalId));
      if (!round.jobs.length) this.roundups.delete(dogId);
    }
  }

  roundupLine(plan, state) {
    const kinds = [...new Set(plan.map((job) => state.animals.find((a) => a.id === job.animalId)?.kind).filter(Boolean))];
    if (kinds.length !== 1) return 'Rounding up the animals.';
    const name = (animalById(kinds[0])?.name || 'animal').toLowerCase();
    const plural = name === 'sheep' || name.endsWith('s') ? name : `${name}s`;
    return `Rounding up the ${plural}.`;
  }

  /**
   * Tap on an owned dog. Uses herdPlan (same stables, pens, and capacity as dusk).
   * Returns false when this animal is not a dog the player owns.
   */
  roundUp(inst) {
    if (!inst || !DOG_CAPACITY[inst.kind] || inst.record?.wild) return false;
    const state = this.game.store?.state;
    const world = this.game.world;
    if (!state || !world) return true;
    const hasStable = (state.buildings || []).some((b) => b.status === 'complete' && b.kind === 'stable');
    if (!hasStable) { this.speak(inst, 'Build a stable first.'); return true; }
    const running = this.roundups.get(inst.id);
    if (running?.jobs?.length) { this.speak(inst, running.line); return true; }
    const skip = new Set();
    for (const [dogId, round] of this.roundups) {
      if (dogId === inst.id) continue;
      for (const job of round.jobs) skip.add(job.animalId);
    }
    const plan = herdPlan(world, state, gameTime(state), true, inst.id, skip);
    if (!plan.length) {
      const loose = herdPlan(world, state, gameTime(state), true, inst.id);
      this.speak(inst, loose.length ? this.roundupLine(loose, state) : 'Everyone is in the stable.');
      return true;
    }
    const line = this.roundupLine(plan, state);
    this.roundups.set(inst.id, { line, jobs: plan.map((job) => ({ animalId: job.animalId, x: job.x, y: job.y })) });
    this.refreshHerd();
    this.speak(inst, line);
    return true;
  }

  /** The animal under a raycast, or null. */
  pick(ray) {
    const boxes = [];
    for (const inst of this.instances.values()) if (inst.hit) boxes.push(inst.hit);
    if (!boxes.length) return null;
    const hit = ray.intersectObjects(boxes, false)[0];
    return hit ? this.instances.get(hit.object.userData.animalId) || null : null;
  }

  /** Tap on a placed animal. Dogs round up livestock. Snakes get shooed. Everyone else says hello. */
  tap(inst) {
    if (!inst) return false;
    if (this.roundUp(inst)) return true;
    if (inst.record?.kind === 'snake' || inst.kind === 'snake') return this.shoo(inst.id);
    this.speak(inst);
    return true;
  }

  /**
   * Passing remark for a tap. Same life as a resident greeting: on screen for 4s,
   * CSS fades the last 300ms, then this clears it. A newer line replaces it and restarts the timer.
   */
  speak(inst, line) {
    const text = line || `${inst.def.emoji} ${inst.def.name}${inst.mode === 'fly' ? ' is flying!' : inst.mode === 'move' ? ' is out for a stroll.' : ' says hello.'}`;
    clearTimeout(this.helloTimer);
    const hello = { text, shownAt: Date.now() };
    this.hello = hello;
    this.helloTimer = setTimeout(() => {
      if (this.disposed || this.hello !== hello) return;
      this.hello = null;
      this.game.notify?.();
    }, 4000);
    this.game.notify?.();
  }

  shoo(id) {
    const store = this.game.store;
    const rec = store?.state?.animals?.find((a) => a.id === id);
    if (!rec || rec.kind !== 'snake') return false;
    const next = structuredClone(store.state);
    next.animals = next.animals.filter((a) => a.id !== id);
    if (rec.key && next.cells?.[rec.key]) { const cell = { ...next.cells[rec.key] }; delete cell.hold; next.cells = { ...next.cells, [rec.key]: cell }; }
    next.farm = { ...(next.farm || {}), pendingToasts: [...(next.farm?.pendingToasts || []), 'Shoo! The snake slithered off.'] };
    try { store.save(next); } catch (error) { this.game.toast(error.message); return false; }
    this.sync();
    this.game.pullFarmToasts?.();
    this.game.notify?.();
    return true;
  }

  beginPlace(kind) {
    const shop = animalShop(kind);
    if (!shop) return false;
    if (this.game.store?.state?.night) { this.game.toast('Everyone is asleep. Place animals in the morning.'); return false; }
    if (shop.wild) { this.game.toast(`${shop.name}s are wild. They find the island on their own.`); return false; }
    const coins = this.game.coins;
    if (typeof coins === 'number' && coins < shop.price) { this.game.toast(`Need ${shop.price - coins} coins.`); return false; }
    this.placing = null;
    this.confirming = shop;
    this.game.notify?.();
    return true;
  }

  confirmBuy() {
    const shop = this.confirming;
    if (!shop || shop.wild) return false;
    const parent = window.parent;
    if (!parent || parent === window) { this.game.toast('Gold coins live in the app. Open the island from My Home.'); return false; }
    this.paidKind = shop.id;
    parent.postMessage({ type: 'gk-buy', id: shop.id, cost: shop.price, item: shop.name }, location.origin);
    return true;
  }

  onBuyResult(msg) {
    if (!msg || (this.paidKind && msg.id && msg.id !== this.paidKind)) return;
    if (Number.isFinite(msg.balance)) this.game.coins = msg.balance;
    if (!msg.ok) {
      this.confirming = null;
      this.paidKind = null;
      this.game.toast(msg.reason || 'Not enough gold coins.');
      this.game.notify?.();
      return;
    }
    const shop = animalShop(msg.id) || this.confirming;
    this.confirming = null;
    this.placing = animalById(msg.id);
    this.paidKind = msg.id;
    this.game.toast(`Tap the grass to place the ${shop?.name?.toLowerCase() || 'animal'}.`);
    this.game.notify?.();
  }

  cancelPlace() {
    if (this.paidKind && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'gk-refund', id: this.paidKind, cost: ANIMAL_PRICE[this.paidKind] }, location.origin);
    }
    this.paidKind = null;
    this.confirming = null;
    if (!this.placing) { this.game.notify?.(); return; }
    this.placing = null;
    this.game.notify?.();
  }

  /** Commit the placement at a ground point; toasts success or the reason it failed. */
  placeAt(point) {
    const def = this.placing;
    if (!def) return false;
    if (this.paidKind !== def.id) { this.game.toast('Buy the animal first.'); return false; }
    const game = this.game, state = game.store.state;
    const plan = { kind: def.id, x: point.x, y: point.y };
    const status = animalPlacementStatus(game.world, state, plan);
    if (!status.ok) { game.toast(status.reason); return false; }
    try {
      const before = game.store.state;
      game.store.commit({ type: 'place_animal', ...plan, id: crypto.randomUUID(), actionId: crypto.randomUUID() });
      if (game.store.state === before) { game.toast('That spot did not work. Try open grass.'); return false; }
    } catch (error) {
      game.toast(error.message);
      return false;
    }
    this.placing = null;
    this.paidKind = null;
    if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'gk-buy-commit', id: def.id }, location.origin);
    this.sync();
    game.toast(`${def.emoji} ${status.reason}`);
    game.notify?.();
    return true;
  }

  /** Send an animal away (not exposed in the UI yet). */
  remove(id) {
    try {
      this.game.store.commit({ type: 'remove_animal', id, actionId: crypto.randomUUID() });
    } catch (error) {
      this.game.toast(error.message);
      return false;
    }
    this.sync();
    this.game.notify?.();
    return true;
  }

  snapshot() {
    const coins = this.game.coins;
    return {
      placing: this.placing ? { kind: this.placing.id, name: this.placing.name, emoji: this.placing.emoji } : null,
      confirming: this.confirming ? { id: this.confirming.id, name: this.confirming.name, emoji: this.confirming.emoji, price: this.confirming.price } : null,
      coins: Number.isFinite(coins) ? coins : null,
      count: this.instances.size,
      kinds: ANIMALS.map((a) => a.id),
      hello: this.hello || null,
    };
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.helloTimer);
    window.removeEventListener('message', this.onMessage);
    for (const inst of this.instances.values()) this.destroy(inst);
    this.instances.clear();
    this.game.scene.remove(this.group);
  }
}
