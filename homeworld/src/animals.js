import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { heightAt, terrainType, dist, animalPlacementStatus } from './core.mjs';
import { activeBuildings, footprint, pointInBounds } from './building.mjs';
import { ANIMALS, animalById } from './animals.mjs';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);
const FADE = 0.25;
const GROUND_LIFT = 0.01;
const HIT_MATERIAL = new THREE.MeshBasicMaterial({ visible: false });
/** Shortest signed angle from a to b. */
const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

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
    this.disposed = false;
    this.lastSignature = null;
    this.signatureClock = 0;
    this.sync();
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
          if (obj.isSkinnedMesh) obj.frustumCulled = false;
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
      const inst = { id: record.id, kind: record.kind, def, home: { x: record.x, y: record.y }, x: record.x, y: record.y, root: null, mixer: null, actions: {}, current: null, mode: 'loading', wait: rand(1, 4), path: null, yaw: Math.random() * Math.PI * 2, targetYaw: 0 };
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
    inst.root?.position.set(x, heightAt(this.game.world, x, y) + GROUND_LIFT + lift, -y);
  }

  play(inst, key) {
    const next = inst.actions[key] || inst.actions.idle;
    if (!next || inst.current === next) return;
    next.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(FADE).play();
    inst.current?.fadeOut(FADE);
    inst.current = next;
  }

  /** Is this ground point somewhere an animal may stand? Dry land, clear of buildings. */
  walkable(x, y) {
    if (terrainType(this.game.world, x, y) === 0) return false;
    const state = this.game.store.state;
    for (const b of activeBuildings(state)) {
      const fp = footprint(this.game.world, b);
      if (fp && pointInBounds({ x, y }, fp.bounds, 0.3)) return false;
    }
    return true;
  }

  /** Random reachable spot near home, or null. */
  pickTarget(inst) {
    const radius = inst.def.wander || 4;
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, r = radius * Math.sqrt(Math.random());
      const candidate = { x: inst.home.x + Math.cos(a) * r, y: inst.home.y + Math.sin(a) * r };
      if (dist(candidate, inst) < 0.6 || !this.walkable(candidate.x, candidate.y)) continue;
      const snapped = this.game.nav?.nearest ? this.game.nav.nearest(candidate, 1) : candidate;
      if (!snapped || !this.walkable(snapped.x, snapped.y)) continue;
      return snapped;
    }
    return null;
  }

  /** A path to the target: the island navigator when available, else a straight line over dry land. */
  routeTo(inst, target) {
    const path = this.game.nav?.path?.(inst, target);
    if (path && path.length) return path;
    const steps = Math.max(2, Math.ceil(dist(inst, target) / 0.5));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!this.walkable(inst.x + (target.x - inst.x) * t, inst.y + (target.y - inst.y) * t)) return null;
    }
    return [target];
  }

  startWander(inst) {
    const target = this.pickTarget(inst);
    const path = target && this.routeTo(inst, target);
    if (!path) { inst.wait = rand(2, 5); return; }
    inst.path = path;
    inst.mode = 'move';
    this.play(inst, 'move');
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
      inst.wait = rand(4, 10);
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
    const speed = inst.def.speed || 0.7;
    let left = speed * dt;
    while (inst.path?.length && left > 0) {
      const next = inst.path[0], d = dist(inst, next);
      if (d <= left) { this.place(inst, next.x, next.y); inst.path.shift(); left -= d; continue; }
      const k = left / d;
      inst.targetYaw = Math.atan2(next.x - inst.x, -(next.y - inst.y));
      this.place(inst, inst.x + (next.x - inst.x) * k, inst.y + (next.y - inst.y) * k);
      left = 0;
    }
    if (!inst.path?.length) {
      inst.path = null;
      inst.mode = 'idle';
      inst.wait = rand(4, 10);
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
    for (const inst of this.instances.values()) {
      if (!inst.root) continue;
      inst.mixer.update(dt);
      if (inst.mode === 'idle') {
        inst.wait -= dt;
        if (inst.wait <= 0 && !night) {
          if (inst.actions.fly && Math.random() < 0.3) this.startFlight(inst);
          else this.startWander(inst);
        }
      } else if (inst.mode === 'move') {
        this.stepMove(inst, dt);
      } else if (inst.mode === 'fly') {
        this.stepFlight(inst, dt);
      }
      const turn = inst.mode === 'fly' ? 6 : 8;
      inst.yaw += angleDelta(inst.yaw, inst.targetYaw) * Math.min(1, dt * turn);
      inst.root.rotation.y = inst.yaw;
    }
  }

  /** The animal under a raycast, or null. */
  pick(ray) {
    const boxes = [];
    for (const inst of this.instances.values()) if (inst.hit) boxes.push(inst.hit);
    if (!boxes.length) return null;
    const hit = ray.intersectObjects(boxes, false)[0];
    return hit ? this.instances.get(hit.object.userData.animalId) || null : null;
  }

  /** Tap on a placed animal: say hello. */
  tap(inst) {
    if (!inst) return false;
    this.game.toast(`${inst.def.emoji} ${inst.def.name}${inst.mode === 'fly' ? ' is flying!' : inst.mode === 'move' ? ' is out for a stroll.' : ' says hello.'}`);
    return true;
  }

  beginPlace(kind) {
    const def = animalById(kind);
    if (!def) return false;
    if (this.game.store?.state?.night) { this.game.toast('Everyone is asleep. Place animals in the morning.'); return false; }
    this.placing = def;
    this.game.toast(`Tap the grass to place the ${def.name.toLowerCase()}.`);
    this.game.notify?.();
    return true;
  }

  cancelPlace() {
    if (!this.placing) return;
    this.placing = null;
    this.game.notify?.();
  }

  /** Commit the placement at a ground point; toasts success or the reason it failed. */
  placeAt(point) {
    const def = this.placing;
    if (!def) return false;
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
    return {
      placing: this.placing ? { kind: this.placing.id, name: this.placing.name, emoji: this.placing.emoji } : null,
      count: this.instances.size,
      kinds: ANIMALS.map((a) => a.id),
    };
  }

  dispose() {
    this.disposed = true;
    for (const inst of this.instances.values()) this.destroy(inst);
    this.instances.clear();
    this.game.scene.remove(this.group);
  }
}
