import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import {
  PERRY_INTRO_MODEL,
  PERRY_PORTRAIT_CLIP,
  finishPerryMaterial,
  pinArmatureXZ,
  stylePerryEye,
} from './PerryFlyIn';

/** Tiny looping Perry bust for the island guide card. */
const PerryGuidePortrait: React.FC = () => {
  const [ready,setReady]=useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let frame = 0,lastPaint=-Infinity,stillDrawn=false;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const release=(root:THREE.Object3D)=>root.traverse(obj=>{const mesh=obj as THREE.Mesh;if(!mesh.isMesh)return;mesh.geometry?.dispose();for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){for(const value of Object.values(material))if(value instanceof THREE.Texture)value.dispose();material.dispose();}});
    let mixer: THREE.AnimationMixer | null = null;
    let fitUntil = 0;
    const clock = new THREE.Clock();

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04, .1, 100, {size:64}).texture;
    scene.environmentIntensity = 0.22;
    room.dispose();
    pmrem.dispose();

    const camera = new THREE.OrthographicCamera(-1, 1, 1.15, -1.15, 0.1, 40);
    camera.position.set(0.4, 0.15, 8);
    camera.lookAt(0, 0, 0);
    // Wings open wider than the body. Keep the widest flap seen so tips are never sliced off.
    const seen = new THREE.Box3();
    let spanReady = false;
    const fitBird = () => {
      if (!wrapper.children.length) return;
      const box = new THREE.Box3().setFromObject(wrapper);
      if (box.isEmpty()) return;
      if (!spanReady) { seen.copy(box); spanReady = true; }
      else { seen.min.min(box.min); seen.max.max(box.max); }
      const size = seen.getSize(new THREE.Vector3());
      const center = seen.getCenter(new THREE.Vector3());
      const aspect = (host.clientWidth || 168) / Math.max(host.clientHeight || 112, 1);
      const pad = 1.14;
      const halfH = Math.max(size.y / 2, size.x / 2 / aspect) * pad;
      camera.top = center.y + halfH;
      camera.bottom = center.y - halfH;
      camera.left = center.x - halfH * aspect;
      camera.right = center.x + halfH * aspect;
      camera.updateProjectionMatrix();
    };

    scene.add(new THREE.HemisphereLight(0xfff2e0, 0x6eb6d4, 1.15));
    const sun = new THREE.DirectionalLight(0xffe9c4, 1.35);
    sun.position.set(-1.6, 2.4, 2.4);
    scene.add(sun);

    const wrapper = new THREE.Group();
    scene.add(wrapper);

    const resize = () => {
      const w = host.clientWidth || 168;
      const h = host.clientHeight || 112;
      renderer.setSize(w, h, false);
      fitBird();
    };
    resize();

    const loader = new GLTFLoader();
    const draco = new DRACOLoader().setDecoderPath('/draco/');
    loader.setDRACOLoader(draco);
    loader.load(PERRY_INTRO_MODEL, (gltf) => {
      if (disposed){release(gltf.scene);return;}
      const model = gltf.scene;
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.frustumCulled = false;
        if (stylePerryEye(mesh)) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => finishPerryMaterial(m));
      });
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const s = 1.6 / Math.max(size.y, 0.001);
      model.scale.setScalar(s);
      model.position.set(-center.x * s, -center.y * s, -center.z * s);
      wrapper.add(model);

      mixer = new THREE.AnimationMixer(model);
      const clip =
        gltf.animations.find((c) => c.name === PERRY_PORTRAIT_CLIP) ||
        gltf.animations.find((c) => /hover/i.test(c.name)) ||
        gltf.animations[0];
      if (clip) {
        pinArmatureXZ(clip);
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.play();
        const marks = 8;
        for (let i = 0; i < marks; i++) {
          mixer.setTime(clip.duration * (i / marks));
          fitBird();
        }
        mixer.setTime(0);
      } else fitBird();
      fitUntil = performance.now() + 2200;
      stillDrawn=false;setReady(true);
    },undefined,()=>{ /* The small parrot fallback remains; navigation never waits. */ });

    const tick = (now=performance.now()) => {
      if (disposed) return;
      frame = requestAnimationFrame(tick);
      if(document.hidden||now-lastPaint<1000/30||(reduced.matches&&stillDrawn))return;
      lastPaint=now;stillDrawn=true;
      mixer?.update(reduced.matches?0:Math.min(clock.getDelta(),.08));
      if (now < fitUntil) fitBird();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      mixer?.stopAllAction();
      release(scene);
      scene.environment?.dispose();
      renderer.dispose();renderer.forceContextLoss();
      draco.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="w-full h-full min-h-full" style={{ width: '100%', height: '100%',position:'relative' }}>{!ready&&<span aria-hidden="true" style={{position:'absolute',inset:0,display:'grid',placeItems:'center',fontSize:54}}>🦜</span>}</div>;
};

export default PerryGuidePortrait;
