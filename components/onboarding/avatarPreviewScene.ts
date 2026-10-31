import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createLivingPlayer} from '../../homeworld/src/living-player-model.js';

/** One visible rig, capped resolution and 30 fps; hidden/reduced-motion screens stop rendering. */
export function createAvatarPreview(host: HTMLElement, avatarId: string, portrait = false) {
  const renderer = new THREE.WebGLRenderer({alpha:true, antialias:true, powerPreference:'low-power', preserveDrawingBuffer:portrait});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden','true');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  // Small, locally generated studio reflections add broad highlights without
  // an HDR download or per-frame post-processing on phones.
  const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);
  const reflections=pmrem.fromScene(room,.06,.1,100,{size:64});
  scene.environment=reflections.texture;scene.environmentIntensity=.12;
  room.dispose();pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(portrait ? 27 : 30,1,.1,20);
  camera.position.set(0,portrait ? 1.48 : 1.13,portrait ? 3.0 : 3.85);
  camera.lookAt(0,portrait ? 1.43 : .96,0);
  scene.add(new THREE.HemisphereLight('#fff4df','#80634f',.85));
  // A warm side key, restrained fill and cool rim reveal the sculpted planes.
  // Tight shadow bounds retain soft facial detail with one small shadow map.
  const key = new THREE.DirectionalLight('#fff1d9',3.4);key.position.set(-3,4.5,4);key.target.position.y=.95;scene.add(key.target);key.castShadow=true;key.shadow.mapSize.set(512,512);key.shadow.camera.left=-1.05;key.shadow.camera.right=1.05;key.shadow.camera.top=1.15;key.shadow.camera.bottom=-1.15;key.shadow.camera.near=.1;key.shadow.camera.far=12;key.shadow.normalBias=.008;key.shadow.bias=-.00015;scene.add(key);
  const fill=new THREE.DirectionalLight('#d6edff',.48);fill.position.set(3,1.5,4);scene.add(fill);
  const rim = new THREE.DirectionalLight('#c8efff',1.4);rim.position.set(3,2,-2);scene.add(rim);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShadowMaterial({opacity:.16}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=-.01;shadow.receiveShadow=true;shadow.visible=!portrait;scene.add(shadow);
  let player = createLivingPlayer(avatarId);scene.add(player.model);player.model.rotation.y=.3;
  let stopped=false,paused=false,dragging=false,frame=0,last=0,elapsed=0,resumeAt=0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const draw = () => renderer.render(scene,camera);
  const resize = () => {
    const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();draw();
  };
  const observer = new ResizeObserver(resize);observer.observe(host);resize();
  function animate(now: number) {
    frame=0;if(stopped||paused||document.hidden||reduced.matches||portrait)return;
    frame=requestAnimationFrame(animate);
    if(now-last<1000/30)return;
    const dt=Math.min((now-last)/1000,.05);last=now;elapsed+=dt;
    if(!dragging&&elapsed>resumeAt)player.model.rotation.y+=dt*.38;
    player.update(dt,0,elapsed);draw();
  }
  function activity(){cancelAnimationFrame(frame);frame=0;last=performance.now();if(!stopped&&!paused&&!document.hidden&&!reduced.matches&&!portrait)frame=requestAnimationFrame(animate);}
  document.addEventListener('visibilitychange',activity);reduced.addEventListener('change',activity);activity();
  return {
    select(id: string) {
      if(player.model.userData.avatarId===id)return;
      scene.remove(player.model);player.dispose();player=createLivingPlayer(id);scene.add(player.model);
      player.model.rotation.y=.3;elapsed=0;resumeAt=1.5;draw();
    },
    turn(radians:number){player.model.rotation.y+=radians;resumeAt=elapsed+2;draw();},
    setDragging(value:boolean){dragging=value;resumeAt=elapsed+2;},
    pause(){paused=true;activity();},
    portrait() { player.model.rotation.y=.3;draw();return renderer.domElement.toDataURL('image/png'); },
    dispose() {
      stopped=true;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',activity);reduced.removeEventListener('change',activity);player.dispose();
      shadow.geometry.dispose();shadow.material.dispose();key.shadow.map?.dispose();
      reflections.dispose();
      renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
    },
  };
}
