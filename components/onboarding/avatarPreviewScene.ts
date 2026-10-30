import * as THREE from 'three';
import {createLivingPlayer} from '../../homeworld/src/living-player-model.js';

/** A single small scene. The six designs use geometry, not downloaded model files. */
export function createAvatarPreview(host: HTMLElement, avatarId: string, portrait = false) {
  const renderer = new THREE.WebGLRenderer({alpha:true, antialias:true, powerPreference:'low-power', preserveDrawingBuffer:portrait});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.setAttribute('aria-hidden','true');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(portrait ? 25 : 32,1,.1,20);
  camera.position.set(0,portrait ? 1.43 : 1.12,portrait ? 1.85 : 4.05);
  camera.lookAt(0,portrait ? 1.43 : .86,0);
  scene.add(new THREE.HemisphereLight('#fff5df','#7d9890',2.5));
  const key = new THREE.DirectionalLight('#fff5e5',3);key.position.set(3,4,5);scene.add(key);
  const rim = new THREE.DirectionalLight('#c6e5f0',1.5);rim.position.set(-3,2,-2);scene.add(rim);
  let player = createLivingPlayer(avatarId);scene.add(player.model);
  let stopped=false,frame=0,last=0,elapsed=0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const draw = () => renderer.render(scene,camera);
  const resize = () => {
    const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();draw();
  };
  const observer = new ResizeObserver(resize);observer.observe(host);resize();
  function animate(now: number) {
    if(stopped)return;
    frame=requestAnimationFrame(animate);
    if(document.hidden || reduced.matches || portrait){last=now;return;}
    if(now-last<1000/30)return;
    const dt=Math.min((now-last)/1000,.05);last=now;elapsed+=dt;
    player.model.rotation.y=elapsed*.38;
    player.update(dt,0,elapsed);
    draw();
  }
  frame=requestAnimationFrame(animate);
  return {
    select(id: string) {
      if(player.model.userData.avatarId===id)return;
      scene.remove(player.model);player.dispose();player=createLivingPlayer(id);scene.add(player.model);
      elapsed=0;draw();
    },
    portrait() { player.model.rotation.y=0;draw();return renderer.domElement.toDataURL('image/png'); },
    dispose() {
      stopped=true;cancelAnimationFrame(frame);observer.disconnect();player.dispose();
      renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
    },
  };
}
