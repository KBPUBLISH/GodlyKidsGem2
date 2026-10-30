import * as THREE from 'three';

/** A lightweight child adventurer, built for the same rounded, warm island style. */
export function createLivingPlayer() {
  const model=new THREE.Group();model.name='Child adventurer';
  const palette={skin:'#c88f68',cheek:'#bb775d',hair:'#493125',hairLight:'#61402d',shirt:'#368e88',trim:'#f1d7a0',pants:'#77704d',boots:'#74513b',sole:'#513e30',bag:'#ac784a',white:'#fff3dd',eyes:'#302922'};
  const materials=Object.fromEntries(Object.entries(palette).map(([k,color])=>[k,new THREE.MeshStandardMaterial({color,roughness:.86,metalness:0})]));
  const mesh=(geo,key,parent,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geo,materials[key]);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;};
  const oval=(key,parent,x,y,z,sx,sy,sz)=>{const m=mesh(new THREE.SphereGeometry(1,20,14),key,parent,x,y,z);m.scale.set(sx,sy,sz);return m;};
  const capsule=(key,parent,r,length,x,y,z)=>mesh(new THREE.CapsuleGeometry(r,length,6,12),key,parent,x,y,z);
  const pivot=(parent,x,y,z)=>{const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;};
  const body=pivot(model,0,0,0),hips=pivot(body,0,.53,0),legs=[],arms=[],eyes=[];
  for(const side of [-1,1]){
    const leg=pivot(hips,side*.13,0,0);legs.push(leg);
    capsule('pants',leg,.105,.22,0,-.16,0);
    oval('boots',leg,0,-.40,.045,.135,.13,.195);
    oval('sole',leg,0,-.475,.055,.138,.045,.19);
  }
  const torso=mesh(new THREE.CylinderGeometry(.225,.29,.48,24,2),'shirt',body,0,.82,0);torso.scale.z=.77;
  oval('shirt',body,0,1.04,0,.245,.15,.185);
  const hem=mesh(new THREE.CylinderGeometry(.288,.29,.045,24),'trim',body,0,.59,0);hem.scale.z=.77;
  capsule('skin',body,.10,.1,0,1.13,0);
  // Neckline and backpack straps read clearly at the normal island camera distance.
  for(const side of [-1,1]){
    const collar=capsule('trim',body,.025,.16,side*.055,1.06,.17);collar.rotation.z=side*.5;
    const strap=capsule('bag',body,.024,.33,side*.16,.87,.155);strap.rotation.z=-side*.08;
    const arm=pivot(body,side*.27,1.03,0);arms.push(arm);
    capsule('shirt',arm,.09,.12,side*.035,-.08,0);
    capsule('skin',arm,.068,.15,side*.045,-.26,.018);
    oval('skin',arm,side*.045,-.39,.035,.078,.09,.07);
  }
  oval('bag',body,0,.86,-.22,.22,.245,.115);
  oval('trim',body,0,.92,-.315,.155,.11,.028);
  const head=pivot(body,0,1.40,.015);
  oval('skin',head,0,0,0,.305,.325,.275);
  oval('skin',head,0,-.13,.12,.23,.17,.19);
  for(const side of [-1,1]){
    oval('skin',head,side*.305,-.025,0,.067,.095,.05);
    oval('cheek',head,side*.225,-.09,.205,.049,.026,.016);
    const eye=pivot(head,side*.112,.03,.246);eyes.push(eye);
    oval('white',eye,0,0,0,.074,.085,.026);
    oval('eyes',eye,0,-.002,.021,.045,.061,.015);
    oval('white',eye,-.012,.024,.034,.014,.019,.007);
    const brow=capsule('hair',head,.017,.075,side*.112,.145,.23);brow.rotation.z=side*.12+Math.PI/2;
  }
  oval('skin',head,0,-.05,.274,.049,.052,.048);
  const smilePath=new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.075,-.135,.305),new THREE.Vector3(0,-.19,.32),new THREE.Vector3(.075,-.135,.305));
  mesh(new THREE.TubeGeometry(smilePath,12,.009,6,false),'hair',head);
  oval('hair',head,0,.18,-.065,.312,.20,.25);
  for(const [x,y,z,sx,sy,sz] of [[-.17,.20,.12,.15,.12,.13],[.02,.25,.10,.20,.12,.16],[.17,.22,.08,.14,.11,.14],[-.255,.075,-.005,.07,.14,.12],[.255,.09,-.03,.07,.13,.12]])oval('hair',head,x,y,z,sx,sy,sz);
  const lock=oval('hairLight',head,-.11,.23,.19,.13,.045,.055);lock.rotation.z=.25;
  let phase=0,stride=0;
  return {model,update(dt,speed,time,{celebrating=false,carrying=false}={}){
    stride=THREE.MathUtils.damp(stride,speed>.05?1:0,10,dt);phase+=dt*(speed>.05?9:0);
    legs.forEach((leg,i)=>leg.rotation.x=Math.sin(phase+i*Math.PI)*.5*stride);
    arms.forEach((arm,i)=>{arm.rotation.x=carrying?-.28:Math.sin(phase+i*Math.PI)*-.38*stride;arm.rotation.z=(i===0?1:-1)*(.08+(celebrating?.6:0));});
    body.position.y=Math.abs(Math.sin(phase))*.035*stride+(celebrating?Math.abs(Math.sin(time*7))*.12:Math.sin(time*2)*.007);
    head.rotation.y=Math.sin(time*.7)*.04*(1-stride);
    const blink=time%4.8;eyes.forEach(e=>e.scale.y=blink>4.6?.12:1);
  }};
}
