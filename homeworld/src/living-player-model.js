import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {getLivingAvatar} from '../../shared/livingAvatars.mjs';

/** Chunky, sculpted cartoon scouts. Shared by the picker, portraits and island. */
export function createLivingPlayer(avatarId) {
  const avatar=getLivingAvatar(avatarId);
  const model=new THREE.Group();model.name='Child adventurer';model.userData.avatarId=avatar.id;
  const tint=(color,target,amount)=>new THREE.Color(color).lerp(new THREE.Color(target),amount);
  const palette={skin:avatar.skin,cheek:tint(avatar.skin,'#cb755e',.28),nose:tint(avatar.skin,'#d68b6a',.13),
    hair:avatar.hair,hairLight:avatar.hairLight,shirt:avatar.shirt,shirtShade:tint(avatar.shirt,'#163e4a',.22),
    trim:avatar.accent,pants:avatar.pants,boots:'#6d4832',sole:'#3b3029',bag:'#a06a38',bagShade:'#754b2d',
    white:'#fff7e8',iris:avatar.iris,eyes:'#211d20',mouth:'#642f2b',tongue:'#c77e70',metal:'#e8b65f'};
  const materials=Object.fromEntries(Object.entries(palette).map(([key,color])=>[key,new THREE.MeshStandardMaterial({color,roughness:key==='eyes'||key==='iris'?.42:.77,metalness:key==='metal'?.15:0})]));
  const sphere=new THREE.SphereGeometry(1,16,12),curl=new THREE.IcosahedronGeometry(1,1),boxes=new Map();
  const mesh=(geo,key,parent,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geo,materials[key]);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;};
  const oval=(key,parent,x,y,z,sx,sy,sz,geo=sphere)=>{const m=mesh(geo,key,parent,x,y,z);m.scale.set(sx,sy,sz);return m;};
  const box=(key,parent,x,y,z,w,h,d,r=.04)=>{
    const id=[w,h,d,r].join(':');if(!boxes.has(id))boxes.set(id,new RoundedBoxGeometry(w,h,d,2,r));
    return mesh(boxes.get(id),key,parent,x,y,z);
  };
  const capsule=(key,parent,r,length,x,y,z)=>mesh(new THREE.CapsuleGeometry(r,length,4,10),key,parent,x,y,z);
  // Beveled silhouettes give hair, eyebrows and clothes broad planes, not bead-like tufts.
  const sculpt=(key,parent,points,depth,x,y,z,bevel=.018)=>{
    const shape=new THREE.Shape();points.forEach(([px,py],i)=>i?shape.lineTo(px,py):shape.moveTo(px,py));shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,steps:1,curveSegments:4});
    geometry.translate(0,0,-depth/2);return mesh(geometry,key,parent,x,y,z);
  };
  const pivot=(parent,x,y,z)=>{const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;};
  const body=pivot(model,0,0,0),hips=pivot(body,0,.53,0),legs=[],arms=[],eyes=[],bones={mixamorigHips:body,mixamorigSpine:hips};
  for(const side of [-1,1]){
    const sideName=side<0?'Right':'Left',leg=pivot(hips,side*.145,0,0);legs.push(leg);bones[`mixamorig${sideName}UpLeg`]=leg;
    const lower=pivot(leg,0,-.24,0),foot=pivot(lower,0,-.16,.045);bones[`mixamorig${sideName}Leg`]=lower;bones[`mixamorig${sideName}Foot`]=foot;
    box('pants',leg,0,-.13,0,.235,.31,.23,.07);
    box('boots',lower,0,-.11,0,.23,.22,.24,.055);
    box('boots',foot,0,-.012,.035,.27,.19,.37,.075);
    box('sole',foot,0,-.09,.035,.28,.055,.38,.02);
    box('bag',lower,0,-.035,.125,.235,.055,.045,.015);
  }
  const torso=mesh(new THREE.CylinderGeometry(.29,.255,.47,8,1),'shirt',body,0,.82,0);torso.scale.z=.78;
  box('shirt',body,0,1.015,0,.54,.20,.36,.08);
  box('pants',body,0,.565,0,.45,.16,.32,.05);
  box('bagShade',body,0,.61,0,.52,.075,.37,.02);
  box('metal',body,0,.61,.202,.105,.085,.045,.018);
  box('bagShade',body,0,.61,.23,.052,.039,.012,.005);
  capsule('skin',body,.115,.10,0,1.13,0);
  for(const side of [-1,1]){
    const strap=box('bag',body,side*.18,.865,.18,.055,.35,.035,.012);strap.rotation.z=-side*.08;
    box('metal',body,side*.18,.77,.205,.063,.045,.018,.008);
    const arm=pivot(body,side*.29,1.025,0);arms.push(arm);
    box('shirt',arm,side*.045,-.075,0,.235,.25,.27,.065);
    box('trim',arm,side*.052,-.175,.005,.235,.055,.275,.018);
    const sideName=side<0?'Right':'Left',forearm=pivot(arm,side*.052,-.23,.018),hand=pivot(forearm,0,-.15,.017);
    bones[`mixamorig${sideName}Arm`]=arm;bones[`mixamorig${sideName}ForeArm`]=forearm;bones[`mixamorig${sideName}Hand`]=hand;
    capsule('skin',forearm,.082,.105,0,-.035,0);
    box('skin',hand,0,-.012,.005,.17,.18,.16,.055);
    oval('skin',hand,-side*.075,.005,.045,.039,.06,.043);
  }
  // A short neckerchief, belt and squared pack keep the silhouette adventurous.
  sculpt('trim',body,[[-.17,.045],[0,-.085],[.17,.045],[.115,.07],[0,-.015],[-.115,.07]],.035,0,1.05,.21,.012);
  sculpt('trim',body,[[-.035,.04],[.035,.04],[.055,-.12],[-.005,-.16],[-.045,-.09]],.025,.025,.985,.235,.01);
  box('trim',body,0,1.015,.25,.07,.065,.055,.02);
  box('bag',body,0,.86,-.255,.40,.43,.19,.07);
  box('bagShade',body,0,.88,-.356,.33,.28,.055,.035);
  box('bag',body,0,1.02,-.36,.43,.14,.07,.035);
  box('metal',body,0,.87,-.397,.065,.10,.02,.012);

  const head=pivot(body,0,1.42,.015);bones.mixamorigHead=head;bones.mixamorigSpine2=head;
  const face=box('skin',head,0,.01,-.015,.71,.69,.59,.18);
  // Taper the lower face as one surface, so cheeks and chin have no visible seams.
  const positions=face.geometry.attributes.position,normals=face.geometry.attributes.normal,n=new THREE.Vector3();
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),width=1-.16*Math.max(0,-y)/.345,slope=y<0?.16/.345:0;
    positions.setX(i,x*width);
    n.set(normals.getX(i)/width,normals.getY(i)-normals.getX(i)*x*slope/width,normals.getZ(i)).normalize();normals.setXYZ(i,n.x,n.y,n.z);
  }
  positions.needsUpdate=true;normals.needsUpdate=true;
  for(const side of [-1,1]){
    const ear=box('skin',head,side*.365,-.035,-.015,.13,.21,.125,.055);ear.rotation.z=-side*.14;
    oval('cheek',head,side*.388,-.035,.052,.035,.062,.018);
    const eye=pivot(head,side*.145,.035,.292);eyes.push(eye);
    const white=box('white',eye,0,0,0,.19,.175,.065,.048);white.rotation.z=-side*.05;
    oval('iris',eye,-side*.012,-.003,.041,.058,.066,.02);
    oval('eyes',eye,-side*.012,-.005,.057,.034,.048,.012);
    oval('white',eye,-side*.012-.018,.022,.069,.017,.021,.006);
    oval('white',eye,-side*.012+.017,-.024,.069,.007,.009,.004);
    const brow=sculpt('hair',head,[[-.105,-.018],[-.115,.024],[-.065,.055],[.065,.048],[.105,.012],[.09,-.02]],.065,side*.145,.167,.292,.015);
    brow.rotation.z=-side*.045;
  }
  box('skin',head,0,-.015,.307,.102,.16,.105,.04);
  box('nose',head,0,-.065,.365,.16,.12,.15,.048);
  // A carved smile with one broad tooth band stays legible at island scale.
  sculpt('mouth',head,[[-.13,.025],[-.08,.006],[.05,.006],[.135,.04],[.115,-.035],[.05,-.071],[-.04,-.074],[-.11,-.04]],.012,0,-.165,.294,.012);
  sculpt('white',head,[[-.114,.019],[-.07,.002],[.05,.002],[.119,.03],[.10,-.005],[.04,-.022],[-.065,-.02],[-.102,-.006]],.01,0,-.16,.309,.006);
  oval('tongue',head,.015,-.221,.311,.053,.014,.009);

  box('hair',head,0,.255,-.06,.735,.30,.61,.13);
  for(const side of [-1,1]){
    const sideburn=box('hair',head,side*.323,.025,-.005,.085,.25,.22,.028);sideburn.rotation.z=-side*.09;
  }
  const sweep=()=>{
    sculpt('hair',head,[[-.31,.16],[-.30,.30],[-.16,.42],[.07,.44],[.15,.35],[.02,.25],[-.13,.23]],.11,0,0,.225,.028);
    sculpt('hair',head,[[.045,.23],[.14,.37],[.27,.34],[.33,.20],[.25,.14],[.16,.17]],.10,0,0,.22,.024);
    sculpt('hairLight',head,[[-.26,.295],[-.145,.395],[.04,.414],[-.065,.345],[-.18,.29]],.008,0,0,.315,.009);
  };
  if(avatar.hairStyle==='crop'){
    for(const [x,y,w] of [[-.21,.29,.19],[0,.34,.24],[.22,.30,.18]]){
      const tuft=box('hair',head,x,y,.06,w,.23,.40,.055);tuft.rotation.z=-.22;
    }
    sculpt('hair',head,[[-.32,.21],[-.30,.30],[.27,.32],[.30,.22],[.12,.19],[-.15,.18]],.08,0,0,.24,.02);
    sculpt('hairLight',head,[[-.08,.37],[.02,.43],[.10,.42],[.03,.37]],.008,0,0,.22,.008);
  }else if(avatar.hairStyle==='curls'||avatar.hairStyle==='puffs'){
    for(let i=0;i<7;i++){
      const a=i*Math.PI/6;oval(i===2?'hairLight':'hair',head,Math.cos(a)*.27,.24+Math.sin(a)*.13,.12,.125,.12,.14,curl);
    }
    if(avatar.hairStyle==='puffs')for(const side of [-1,1]){
      oval('hair',head,side*.37,.23,-.08,.21,.21,.20,curl);
      for(let i=0;i<4;i++){const a=i*Math.PI/2;oval('hair',head,side*.37+Math.cos(a)*.12,.23+Math.sin(a)*.12,.025,.10,.105,.105,curl);}
      const tie=box('trim',head,side*.33,.135,.13,.12,.07,.08,.02);tie.rotation.z=side*.2;
    }
  }else if(avatar.hairStyle==='bob'){
    box('hair',head,0,-.015,-.235,.73,.61,.27,.11);
    for(const side of [-1,1]){
      sculpt('hair',head,[[-.065,.22],[.065,.17],[.08,-.23],[.015,-.30],[-.07,-.23]],.24,side*.31,-.015,-.025,.035);
    }
    sweep();const clip=box('trim',head,.295,.155,.25,.085,.04,.04,.012);clip.rotation.z=-.35;
  }else{
    sweep();
    if(avatar.hairStyle==='ponytail'){
      box('trim',head,0,.185,-.39,.13,.10,.10,.03);
      sculpt('hair',head,[[-.065,.15],[.075,.16],[.15,.04],[.14,-.20],[.03,-.34],[-.045,-.27],[-.10,-.06]],.23,0,0,-.43,.045);
      sculpt('hairLight',head,[[-.005,.12],[.04,.10],[.075,-.12],[.035,-.25],[.015,-.10]],.012,0,0,-.57,.01);
    }
  }
  // Give the torso its own joints. Bending a spine must move the shirt, arms,
  // backpack and head together, without rotating the legs from their hips.
  const upperParts=body.children.filter(part=>part!==hips&&part.position.y>.7);
  const spine=pivot(body,0,.62,0),chest=pivot(spine,0,.32,0);
  model.updateMatrixWorld(true);
  for(const part of upperParts)spine.attach(part);
  for(const part of [head,...arms])chest.attach(part);
  bones.mixamorigSpine=spine;bones.mixamorigSpine2=chest;
  let phase=0,stride=0;
  const restPose=[...new Set(Object.values(bones))].map(bone=>({bone,position:bone.position.clone(),quaternion:bone.quaternion.clone()}));
  return {model,bones,restPose,dispose(){
    const geometries=new Set([sphere,curl]);model.traverse(object=>{if(object.geometry)geometries.add(object.geometry);});
    geometries.forEach(geometry=>geometry.dispose());Object.values(materials).forEach(material=>material.dispose());
  },update(dt,speed,time,{celebrating=false,carrying=false,working=false}={}){
    const blink=time%4.8;eyes.forEach(e=>e.scale.y=blink>4.6?.12:1);
    if(working)return;
    for(const p of restPose){p.bone.position.copy(p.position);p.bone.quaternion.copy(p.quaternion);}
    stride=THREE.MathUtils.damp(stride,speed>.05?1:0,10,dt);phase+=dt*(speed>.05?9:0);
    legs.forEach((leg,i)=>leg.rotation.x=Math.sin(phase+i*Math.PI)*.5*stride);
    arms.forEach((arm,i)=>{arm.rotation.x=carrying?-.32:Math.sin(phase+i*Math.PI)*-.38*stride;arm.rotation.z=(i===0?1:-1)*(.11+(celebrating?.6:0));});
    body.position.y=Math.abs(Math.sin(phase))*.035*stride+(celebrating?Math.abs(Math.sin(time*7))*.12:Math.sin(time*2)*.007);
    head.rotation.y=Math.sin(time*.7)*.045*(1-stride);head.rotation.z=Math.sin(time*.8)*.02*(1-stride);
  }};
}
