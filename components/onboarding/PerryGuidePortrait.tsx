import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  PERRY_INTRO_MODEL,
  finishPerryMaterial,
  pinArmatureXZ,
  stylePerryEye,
} from './PerryFlyIn';

/** Tiny looping Perry bust for the island guide card. */
const PerryGuidePortrait: React.FC = () => {
  const hostRef = useRef<HTMLDivElement>(null);

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
      powerPreference: 'low-power',
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

    const camera = new THREE.OrthographicCamera(-1, 1, 1.15, -1.15, 0.1, 40);
    camera.position.set(0.4, 0.15, 8);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.HemisphereLight(0xfff2e0, 0x6eb6d4, 1.15));
    const sun = new THREE.DirectionalLight(0xffe9c4, 1.35);
    sun.position.set(-1.6, 2.4, 2.4);
    scene.add(sun);

    const wrapper = new THREE.Group();
    scene.add(wrapper);

    const resize = () => {
      const w = host.clientWidth || 108;
      const h = host.clientHeight || 124;
      renderer.setSize(w, h, false);
      const aspect = w / Math.max(h, 1);
      const halfH = 0.95;
      camera.left = -halfH * aspect;
      camera.right = halfH * aspect;
      camera.top = halfH;
      camera.bottom = -halfH;
      camera.updateProjectionMatrix();
    };
    resize();

    const loader = new GLTFLoader();
    loader.load(PERRY_INTRO_MODEL, (gltf) => {
      if (disposed) return;
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
        gltf.animations.find((c) => /perry|intro|fly/i.test(c.name)) || gltf.animations[0];
      if (clip) {
        pinArmatureXZ(clip);
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.play();
        mixer.update(0);
      }
      const live = new THREE.Box3().setFromObject(wrapper);
      const liveCenter = live.getCenter(new THREE.Vector3());
      wrapper.position.sub(liveCenter);
    });

    const tick = () => {
      if (disposed) return;
      frame = requestAnimationFrame(tick);
      mixer?.update(clock.getDelta());
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      mixer?.stopAllAction();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="w-full h-full min-h-full" style={{ width: '100%', height: '100%' }} />;
};

export default PerryGuidePortrait;
