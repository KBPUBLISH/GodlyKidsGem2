import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fetchPerrySpeech } from '../../utils/perrySpeech';

/** Flight-only Perry: sideways fly-in, dive-and-hover, and a flapping hover. */
export const PERRY_MODEL = '/models/perry-flight-essentials.glb?v=flight-3';
export const PERRY_INTRO_MODEL = PERRY_MODEL;
/** 30 s clip: dive, turn, then an authored hover until the end. */
export const PERRY_DIVE_MODEL = PERRY_MODEL;
export const PERRY_INTRO_CLIP = 'FlySidewaysTalking';
export const PERRY_DIVE_CLIP = 'DiveTurnHover';
export const PERRY_PORTRAIT_CLIP = 'HoverFlapping';

const NAVY = '#12264A';
const GOLD = '#FFC43D';
const BUBBLE = "'Baloo 2', 'Fredoka', sans-serif";
const FLY_IN_MS = 1800;
const FLY_OUT_MS = 900;
const DIVE_MS = 980;
const START_X = -2.8;
const END_X = 0;
const FLY_OUT_X = 6.6;
const HOLD_Y = 0.28;
const PERRY_HEIGHT = 1.05;
const DIVE_LAND_SEC = 7.05;

type PerryMotion = 'meet' | 'dive';

export type PerryFlyInProps = {
  bubble?: string | null;
  tts?: string | null;
  underlay?: React.ReactNode;
  footer?: React.ReactNode;
  departing?: boolean;
  holdY?: number;
  height?: number;
  motion?: PerryMotion;
  /** Override the GLB. Dive defaults to the fly-and-dive clip. */
  modelUrl?: string;
  onReady?: () => void;
  onDeparted?: () => void;
  /** Dive only: fires once when the authored clip plays to its end. */
  onClipEnd?: () => void;
  className?: string;
  /** Sit the speech bubble just under Perry instead of in the bottom stack. */
  bubbleNearBird?: boolean;
  /** Legacy: default Continue that flies Perry out, then calls this. */
  onContinue?: () => void;
};

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function easeInCubic(t: number) {
  return t * t * t;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

const RIG_POSITION = /(?:SmartRigArmature|Parrot2_Rig)\.position$/;

/** Authored clip carries the rig across the scene. Pin XZ so we own the fly-in. */
export function pinArmatureXZ(clip: THREE.AnimationClip) {
  for (const track of clip.tracks) {
    if (!RIG_POSITION.test(track.name)) continue;
    const values = track.values;
    for (let i = 0; i < values.length; i += 3) {
      values[i] = 0;
      values[i + 2] = 0;
    }
  }
}

/** Pin the last armature pose to the origin so the dive lands in frame. */
function recenterArmaturePath(clip: THREE.AnimationClip, pathScale: number) {
  const track = clip.tracks.find((t) => RIG_POSITION.test(t.name));
  if (!track || track.values.length < 3) return;
  const v = track.values;
  const ex = v[v.length - 3];
  const ey = v[v.length - 2];
  const ez = v[v.length - 1];
  for (let i = 0; i < v.length; i += 3) {
    v[i] = (v[i] - ex) * pathScale;
    v[i + 1] = (v[i + 1] - ey) * pathScale;
    v[i + 2] = (v[i + 2] - ez) * pathScale;
  }
}

/** Keep the baked albedo/roughness/normal. Don't flatten with emissive or kill sheen. */
export function finishPerryMaterial(mat: THREE.Material) {
  const pbr = mat as THREE.MeshStandardMaterial;
  if (!pbr.isMeshStandardMaterial && !(pbr as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
    return;
  }
  if (pbr.map) pbr.map.colorSpace = THREE.SRGBColorSpace;
  pbr.emissiveMap = null;
  pbr.emissive.setHex(0x000000);
  pbr.emissiveIntensity = 0;
  if (pbr.normalMap) pbr.normalScale.set(1.55, 1.55);
  if (pbr.transparent && pbr.opacity >= 1) {
    pbr.transparent = false;
    pbr.depthWrite = true;
  }
  const phys = pbr as THREE.MeshPhysicalMaterial;
  if (phys.isMeshPhysicalMaterial) {
    phys.sheen = Math.min(phys.sheen || 0, 0.4);
    phys.sheenColor.multiplyScalar(0.4);
    phys.clearcoat = Math.min(phys.clearcoat || 0, 0.12);
  }
  pbr.needsUpdate = true;
}

/** Layered physical eyes read as black glass sockets. Paint a soft cartoon eye instead. */
export function stylePerryEye(mesh: THREE.Mesh) {
  const name = mesh.name || '';
  if (!/eye/i.test(name)) return false;

  // Outer cornea is a glass shell — hide it so the white macaw face reads as sclera.
  if (!/_1$|_2$/.test(name)) {
    mesh.visible = false;
    return true;
  }

  const isPupil = /_2$/.test(name);
  if (isPupil) mesh.scale.setScalar(0.52);

  const color = isPupil ? 0x4a2c16 : 0xe0a04a;
  const mat = new THREE.MeshBasicMaterial({ color });
  mesh.material = mat;

  if (isPupil && !mesh.getObjectByName('perry-catchlight')) {
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const r = Math.max(size.x, size.y, size.z, 0.01) * 0.5;
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(r * 0.22, 0.004), 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    dot.name = 'perry-catchlight';
    dot.position.set(r * 0.28, r * 0.32, r * 0.62);
    mesh.add(dot);
  }
  return true;
}

const PerryFlyIn: React.FC<PerryFlyInProps> = ({
  bubble,
  tts,
  underlay,
  footer,
  departing = false,
  holdY = HOLD_Y,
  height = PERRY_HEIGHT,
  motion = 'meet',
  modelUrl,
  onReady,
  onDeparted,
  onClipEnd,
  className,
  bubbleNearBird = false,
  onContinue,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const talkRef = useRef<HTMLAudioElement>(null);
  const onDepartedRef = useRef(onDeparted);
  const onReadyRef = useRef(onReady);
  const onClipEndRef = useRef(onClipEnd);
  const onContinueRef = useRef(onContinue);
  const holdYRef = useRef(holdY);
  const motionRef = useRef(motion);
  const departingRef = useRef(departing);
  const flyOutRef = useRef({ active: false, t0: 0, done: false });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selfDeparting, setSelfDeparting] = useState(false);

  onDepartedRef.current = onDeparted;
  onReadyRef.current = onReady;
  onClipEndRef.current = onClipEnd;
  onContinueRef.current = onContinue;
  holdYRef.current = holdY;
  motionRef.current = motion;
  departingRef.current = departing || selfDeparting;

  useEffect(() => {
    if (tts) void fetchPerrySpeech(tts);
  }, [tts]);

  useEffect(() => {
    if (!ready || !tts) return;
    let cancelled = false;
    let audio: HTMLAudioElement | null = null;

    void fetchPerrySpeech(tts).then((url) => {
      if (cancelled || !url) return;
      const node = talkRef.current ?? new Audio(url);
      if (talkRef.current) node.src = url;
      audio = node;
      void node.play().catch(() => {
        /* autoplay can fail if the last gesture has gone stale */
      });
    });

    return () => {
      cancelled = true;
      audio?.pause();
      audio = null;
    };
  }, [ready, tts]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let frame = 0;
    let mixer: THREE.AnimationMixer | null = null;
    const clock = new THREE.Clock();

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    scene.environmentIntensity = 0.22;
    room.dispose();
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40);
    camera.position.set(0, 0.15, 6.6);
    camera.lookAt(0, 0.05, 0);

    scene.add(new THREE.HemisphereLight(0xfff2e0, 0x6eb6d4, 1.15));
    const sun = new THREE.DirectionalLight(0xffe9c4, 1.4);
    sun.position.set(-2.2, 3.4, 3.2);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc8e8ff, 0.4);
    fill.position.set(2.4, 1.2, 2);
    scene.add(fill);

    const wrapper = new THREE.Group();
    scene.add(wrapper);
    const authoredPath = motion === 'dive';
    wrapper.position.set(authoredPath ? 0 : START_X, 0, 0);
    if (authoredPath) {
      camera.position.set(0, 0.55, 9.2);
      camera.lookAt(0, -0.05, 0);
    }
    let flyT0 = 0;
    let diveT0 = 0;
    const worldCenter = new THREE.Vector3();
    const worldBox = new THREE.Box3();

    const resize = () => {
      const w = host.clientWidth || window.innerWidth;
      const h = host.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    const loader = new GLTFLoader();
    const src =
      modelUrl || (motion === 'dive' ? PERRY_DIVE_MODEL : PERRY_INTRO_MODEL);
    let clipFinished = false;

    loader.load(
      src,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        // Older Perry files ship extra scene objects beside SmartRigArmature.
        // Parrot 2's scene root is the rig itself, so leave that graph intact.
        if (model.getObjectByName('SmartRigArmature')) {
          [...model.children].forEach((child) => {
            if (child.name !== 'SmartRigArmature') child.removeFromParent();
          });
        }
        model.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = false;
          mesh.frustumCulled = false;
          if (stylePerryEye(mesh)) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => finishPerryMaterial(m));
        });

        const wanted = motion === 'dive' ? PERRY_DIVE_CLIP : PERRY_INTRO_CLIP;
        const clip =
          gltf.animations.find((c) => c.name === wanted) ||
          gltf.animations.find((c) =>
            motion === 'dive' ? /dive/i.test(c.name) : /introduction|sideways/i.test(c.name),
          ) ||
          gltf.animations[0];
        if (clip && !authoredPath) pinArmatureXZ(clip);
        if (clip && authoredPath) recenterArmaturePath(clip, 1);

        let probe: THREE.AnimationMixer | null = null;
        if (authoredPath && clip) {
          probe = new THREE.AnimationMixer(model);
          const probeAction = probe.clipAction(clip);
          probeAction.play();
          probe.setTime(Math.min(DIVE_LAND_SEC, clip.duration));
          model.updateMatrixWorld(true);
        }

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const tall = Math.max(size.y, size.x * 0.7, 0.001);
        const s = height / tall;
        model.scale.setScalar(s);
        model.position.set(-center.x * s, -center.y * s, -center.z * s);
        wrapper.add(model);
        probe?.stopAllAction();

        mixer = new THREE.AnimationMixer(model);
        if (clip) {
          const action = mixer.clipAction(clip);
          if (authoredPath) {
            action.reset();
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
            mixer.addEventListener('finished', () => {
              if (disposed || clipFinished) return;
              clipFinished = true;
              onClipEndRef.current?.();
            });
          } else {
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.clampWhenFinished = false;
          }
          action.play();
          mixer.update(0);
        }

        flyT0 = performance.now();
        setReady(true);
        onReadyRef.current?.();
      },
      undefined,
      () => {
        if (!disposed) setFailed(true);
      },
    );

    const tick = () => {
      if (disposed) return;
      frame = requestAnimationFrame(tick);
      const dt = clock.getDelta();
      mixer?.update(dt);

      if (flyT0) {
        const restY = holdYRef.current;
        const isDive = motionRef.current === 'dive';
        const approachY = isDive ? restY + 0.92 : restY;
        let desiredX = END_X;
        let desiredY = restY;
        const flyOut = flyOutRef.current;

        if (departingRef.current && !flyOut.active && !flyOut.done) {
          flyOut.active = true;
          flyOut.t0 = performance.now();
        }

        if (flyOut.active) {
          const u = Math.min(1, (performance.now() - flyOut.t0) / FLY_OUT_MS);
          desiredX = END_X + (FLY_OUT_X - END_X) * easeInCubic(u);
          desiredY = restY + 0.18 * u;
          if (u >= 1 && !flyOut.done) {
            flyOut.done = true;
            (onDepartedRef.current || onContinueRef.current)?.();
          }
        } else if (!authoredPath) {
          const uIn = Math.min(1, (performance.now() - flyT0) / FLY_IN_MS);
          desiredX = START_X + (END_X - START_X) * easeOutCubic(uIn);
          desiredY = approachY;
          if (uIn >= 1 && isDive) {
            if (!diveT0) diveT0 = performance.now();
            const uDive = Math.min(1, (performance.now() - diveT0) / DIVE_MS);
            const e = easeInOutCubic(uDive);
            if (e < 0.28) {
              const p = e / 0.28;
              desiredY = approachY + 0.22 * p;
            } else {
              const p = (e - 0.28) / 0.72;
              desiredY = (approachY + 0.22) * (1 - p) + restY * p;
            }
          }
        } else {
          desiredX = END_X;
          desiredY = restY;
        }

        const bob =
          flyOut.active || authoredPath
            ? 0
            : Math.sin(performance.now() / 380) * (isDive ? 0.07 : 0.045);

        if (authoredPath && !flyOut.active) {
          wrapper.position.y = restY;
          wrapper.position.x = 0;
        } else if (wrapper.children.length) {
          worldBox.setFromObject(wrapper);
          worldBox.getCenter(worldCenter);
          wrapper.position.x += desiredX - worldCenter.x;
          wrapper.position.y += desiredY + bob - worldCenter.y;
        } else {
          wrapper.position.x = desiredX;
          wrapper.position.y = desiredY + bob;
        }
      }

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      mixer?.stopAllAction();
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => (m as THREE.Material).dispose?.());
        }
      });
    };
  }, [height, motion, modelUrl]);

  const hideChrome = departing || selfDeparting;
  const showDefaultContinue = Boolean(onContinue) && !footer;

  return (
    <div className={`fixed inset-0 flex flex-col pointer-events-none ${className || 'z-20'}`}>
      <audio ref={talkRef} preload="auto" hidden />
      <div ref={hostRef} className="absolute inset-0" />

      {!ready && !failed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-white/40 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {underlay && (
        <div
          className="absolute inset-0 z-10 flex flex-col justify-end pointer-events-none transition-opacity duration-300"
          style={{ opacity: hideChrome ? 0 : 1 }}
        >
          {underlay}
        </div>
      )}

      {ready && bubble && bubbleNearBird ? (
        <div
          className="absolute left-1/2 z-20 w-full max-w-sm px-6 -translate-x-1/2 pointer-events-none transition-opacity duration-200"
          style={{ top: 'max(4.75rem, calc(var(--safe-area-top, env(safe-area-inset-top, 0px)) + 3.75rem))', opacity: hideChrome ? 0 : 1 }}
        >
          <div
            className="w-full px-5 py-3 rounded-3xl text-center font-extrabold text-[1.15rem] leading-snug"
            style={{
              fontFamily: BUBBLE,
              background: 'rgba(255, 248, 232, 0.96)',
              color: NAVY,
              boxShadow: '0 4px 0 #C9A35A, 0 10px 18px rgba(18, 38, 74, 0.16)',
            }}
          >
            {bubble}
          </div>
        </div>
      ) : null}

      <div
        className="relative z-20 mt-auto flex flex-col items-center px-6 pointer-events-none transition-opacity duration-200"
        style={{ opacity: hideChrome ? 0 : 1 }}
      >
        {ready && bubble && !bubbleNearBird ? (
          <div
            className="w-full max-w-sm mb-3 px-5 py-3 rounded-3xl text-center font-extrabold text-[1.15rem] leading-snug"
            style={{
              fontFamily: BUBBLE,
              background: 'rgba(255, 248, 232, 0.96)',
              color: NAVY,
              boxShadow: '0 4px 0 #C9A35A, 0 10px 18px rgba(18, 38, 74, 0.16)',
            }}
          >
            {bubble}
          </div>
        ) : null}
        {footer}
        {showDefaultContinue && (
          <button
            type="button"
            onClick={() => {
              if (flyOutRef.current.active) return;
              talkRef.current?.pause();
              setSelfDeparting(true);
            }}
            className="pointer-events-auto w-full max-w-sm px-10 py-3.5 rounded-full font-extrabold text-[1.55rem] leading-none active:scale-[0.97] transition-transform"
            style={{
              fontFamily: BUBBLE,
              background: GOLD,
              color: NAVY,
              boxShadow: '0 6px 0 #E0A21A, 0 10px 18px rgba(18, 38, 74, 0.18)',
              marginBottom: 'calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + 4.25rem)',
            }}
          >
            Continue →
          </button>
        )}
      </div>
    </div>
  );
};

export default PerryFlyIn;
