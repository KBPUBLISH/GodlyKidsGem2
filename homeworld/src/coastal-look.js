import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { heightAt, terrainType, cellAt } from './core.mjs';
import { activeBuildings, footprint } from './building.mjs';
import { LeafyTrees } from './coastal-leaves.js';

// Island scenery only. Does not alter terrain, collision or saved progress.
const c = hex => new THREE.Color(hex);
const smooth = THREE.MathUtils.smoothstep;
const leafColors = {Oak:'#70a93c',Maple:'#a3b64b',Apple:'#58a747',Palm:'#67ae43',Pine:'#408b58',PineMid:'#5d9c50',PineTop:'#8ab35a'};
const random = seed => () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0) / 4294967296);

function shoreTexture(grid) {
  const {columns:w, rows:h, mask} = grid;
  let values = new Float32Array(w*h).fill(40);
  const queue = new Int32Array(w*h); let head=0, tail=0;
  for(let i=0;i<mask.length;i++) if(mask[i]) { values[i]=0;queue[tail++]=i; }
  while(head<tail){
    const i=queue[head++],x=i%w,y=(i-x)/w;
    for(const n of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1])
      if(n>=0&&values[n]>values[i]+1){values[n]=values[i]+1;queue[tail++]=n;}
  }
  // Smooth grid edges so the foam follows a continuous coast instead of square tiles.
  for(let pass=0;pass<3;pass++){
    const next=values.slice();
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const i=y*w+x;next[i]=(values[i]*4+values[i-1]+values[i+1]+values[i-w]+values[i+w])/8;
    }
    values=next;
  }
  const bytes=new Uint8Array(w*h*4);
  for(let i=0;i<values.length;i++){bytes[i*4]=Math.round(Math.min(1,values[i]/32)*255);bytes[i*4+3]=255;}
  const tex=new THREE.DataTexture(bytes,w,h,THREE.RGBAFormat);
  tex.minFilter=tex.magFilter=THREE.LinearFilter;tex.needsUpdate=true;
  return tex;
}

export class CoastalLook {
  constructor(game){
    this.game=game;this.enabled=true;
    this.time=0;this.saved=new Map();this.decor=new THREE.Group();this.decor.name='Coastal planting';
    game.scene.add(this.decor);
    this.u={on:{value:1},day:{value:1},time:{value:0},shore:{value:shoreTexture(game.world.grid)},grid:{value:new THREE.Vector4(...game.world.grid.origin,game.world.grid.columns,game.world.grid.rows)}};
    this.patchScenery();this.leafyTrees=new LeafyTrees(game);this.patchOcean();this.makePlanting();this.makeWaterfall();this.setEnabled(this.enabled);
  }
  remember(mat){
    if(this.saved.has(mat))return;
    this.saved.set(mat,{color:mat.color.clone(),roughness:mat.roughness,metalness:mat.metalness});
  }
  patchScenery(){
    const mats=new Set();
    const collect=root=>root?.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);});
    for(const m of this.game.staticMeshes)collect(m);
    for(const m of this.game.groundCoverMeshes)collect(m);
    for(const [id,root] of Object.entries(this.game.library))if(/^(tree_|treegrowth_|tile_)/.test(id))collect(root);
    for(const node of this.game.mining?.nodes.values()||[])collect(node.mesh);
    for(const mat of mats){
      if(!mat.color)continue;
      const n=mat.name||'';
      if(/SoftTree_(Oak|Maple|Apple|Palm|Pine|PineMid|PineTop)$/.test(n)||/Leaf_(Mid|Bright|Deep|Gold)|Tuft|Farm_Leaf/.test(n)){
        this.remember(mat);this.patchMaterial(mat,'leaf');
      }else if(/HW_Baked_terrain/.test(n)){this.remember(mat);this.patchMaterial(mat,'grass');}
      else if(/HW_Baked_shore|IslandBeach|Sand_Wet/.test(n)){this.remember(mat);this.patchMaterial(mat,'sand');}
      else if(/Bark/.test(n)){this.remember(mat);this.patchMaterial(mat,'bark');}
      else if(/MAT_HW_Farm_Soil(Dry|Wet)/.test(n)){this.remember(mat);this.patchMaterial(mat,'soil');}
      else if(/MAT_HW_Stone(_Light)?$/.test(n)){this.remember(mat);this.patchMaterial(mat,'stone');}
    }
  }
  patchMaterial(mat,kind){
    const previous=mat.onBeforeCompile;
    mat.onBeforeCompile=shader=>{
      previous?.call(mat,shader);
      shader.uniforms.uCoastOn=this.u.on;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCoastLocal;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nvCoastLocal=position;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vCoastLocal;uniform float uCoastOn;');
      const changes={
        leaf:`float tip=smoothstep(-1.5,4.0,vCoastLocal.y);float dapple=sin(vCoastLocal.x*3.9+sin(vCoastLocal.y*4.8))*sin(vCoastLocal.z*4.2+vCoastLocal.y*2.1);vec3 painted=diffuseColor.rgb*mix(vec3(.80,.98,.91),vec3(1.15,1.10,.87),tip);painted*=.94+.14*smoothstep(-.5,.65,dapple);diffuseColor.rgb=mix(diffuseColor.rgb,painted,uCoastOn);`,
        grass:`vec3 lush=diffuseColor.rgb*vec3(.80,1.02,.90);float speck=sin(vCoastLocal.x*6.1)*sin(vCoastLocal.z*7.3);lush*=1.+speck*.018;diffuseColor.rgb=mix(diffuseColor.rgb,lush,uCoastOn);`,
        sand:`vec3 beach=diffuseColor.rgb*vec3(1.15,1.055,.88)+vec3(.035,.022,.009);diffuseColor.rgb=mix(diffuseColor.rgb,beach,uCoastOn);`,
        bark:`float grain=sin(vCoastLocal.x*24.+sin(vCoastLocal.y*2.1)*2.)*sin(vCoastLocal.z*19.);vec3 wood=diffuseColor.rgb*vec3(1.10,1.02,.91)*(1.+grain*.045);diffuseColor.rgb=mix(diffuseColor.rgb,wood,uCoastOn);`,
        soil:`vec3 soil=diffuseColor.rgb*vec3(1.07,1.01,.94);diffuseColor.rgb=mix(diffuseColor.rgb,soil,uCoastOn);`,
        stone:`float moss=smoothstep(2.8,4.8,vCoastLocal.y)*.13;vec3 rock=diffuseColor.rgb*vec3(1.13,1.055,.96);rock=mix(rock,vec3(.20,.29,.10),moss);diffuseColor.rgb=mix(diffuseColor.rgb,rock,uCoastOn);`,
      };
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+changes[kind]);
    };
    mat.customProgramCacheKey=()=>`coastal-${kind}-v1`;mat.needsUpdate=true;
  }
  patchOcean(){
    const mat=this.game.water?.mesh.material;if(!mat)return;
    const previous=mat.onBeforeCompile;
    mat.onBeforeCompile=shader=>{
      previous?.call(mat,shader);
      Object.assign(shader.uniforms,{uCoastOn:this.u.on,uCoastDay:this.u.day,uCoastTime:this.u.time,uCoastShore:this.u.shore,uCoastGrid:this.u.grid});
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCoastWorld;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nvCoastWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
        varying vec3 vCoastWorld;uniform float uCoastOn,uCoastDay,uCoastTime;
        uniform sampler2D uCoastShore;uniform vec4 uCoastGrid;
      `).replace('#include <color_fragment>',`#include <color_fragment>
        vec2 shoreUV=(vec2(vCoastWorld.x,-vCoastWorld.z)-uCoastGrid.xy)/uCoastGrid.zw;
        float inGrid=step(0.,shoreUV.x)*step(0.,shoreUV.y)*step(shoreUV.x,1.)*step(shoreUV.y,1.);
        float coastDist=mix(32.,texture2D(uCoastShore,shoreUV).r*32.,inGrid);
        vec3 shallow=vec3(.009,.39,.39), deep=vec3(.004,.13,.34);
        vec3 sea=mix(shallow,deep,smoothstep(.4,17.,coastDist));
        float ripple=sin(vCoastWorld.x*1.8+vCoastWorld.z*1.1+uCoastTime*.6)*sin(vCoastWorld.z*2.4-vCoastWorld.x*.7-uCoastTime*.4);
        sea+=vec3(.02,.065,.055)*pow(max(0.,ripple),5.)*(1.-smoothstep(3.,10.,coastDist));
        float wave=sin(coastDist*5.-uCoastTime*1.4+sin(vCoastWorld.x*.55+vCoastWorld.z*.42)*.7);
        float foam=pow(max(0.,wave),14.)*(1.-smoothstep(.6,3.8,coastDist))*smoothstep(.05,.5,coastDist);
        sea=mix(sea,vec3(.80,.96,.88),foam*.72);
        diffuseColor.rgb=mix(diffuseColor.rgb,sea,uCoastOn*uCoastDay);
      `);
    };
    mat.customProgramCacheKey=()=>'hw-water-fade-coastal-v1';mat.needsUpdate=true;
  }
  makePlanting(){
    const rnd=random(20261031),world=this.game.world,clusters=[];
    // Flowers live at existing scenic planting edges. Their footprints are hidden under new buildings.
    for(const item of this.game.groundCover||[]){
      const [x0,y0,x1,y1]=item.bounds,x=(x0+x1)/2,y=(y0+y1)/2;
      if(Math.hypot(x-1.7,y-.6)>32||Math.abs(x)<5&&Math.abs(y)<6||terrainType(world,x,y)!==2)continue;
      if(rnd()>.55)continue;
      clusters.push({x,y});if(clusters.length>=45)break;
    }
    const petals=[];
    for(let i=0;i<5;i++){
      const a=i*Math.PI*2/5,g=new THREE.SphereGeometry(1,6,4);
      g.scale(.105,.035,.17);g.rotateY(a);g.translate(Math.sin(a)*.13,0,Math.cos(a)*.13);petals.push(g);
    }
    const petalGeo=mergeGeometries(petals);petals.forEach(g=>g.dispose());
    const count=clusters.length*5;
    this.flowerMeshes=[
      new THREE.InstancedMesh(petalGeo,new THREE.MeshStandardMaterial({color:'white',roughness:.8}),count),
      new THREE.InstancedMesh(new THREE.SphereGeometry(.065,6,4),new THREE.MeshStandardMaterial({color:'#ffcb49',roughness:.85}),count),
      new THREE.InstancedMesh(new THREE.CylinderGeometry(.013,.021,1,4),new THREE.MeshStandardMaterial({color:'#548c39',roughness:1}),count),
    ];
    this.flowerTransforms=[];const temp=new THREE.Object3D(),colors=['#fff5cb','#fff5cb','#ffccbb','#f5afd1','#baa9f1'];
    for(const pos of clusters)for(let j=0;j<5;j++){
      const x=pos.x+(rnd()-.5)*1.9,y=pos.y+(rnd()-.5)*1.9,z=heightAt(world,x,y),h=.22+rnd()*.32;
      this.flowerTransforms.push({x,y,z,h,color:colors[Math.floor(rnd()*colors.length)],yaw:rnd()*6.28});
    }
    for(const m of this.flowerMeshes){m.castShadow=false;m.receiveShadow=true;this.decor.add(m);}
    this.refreshPlanting();
  }
  refreshPlanting(){
    const s=this.game.store.state,buildings=activeBuildings(s),signature=buildings.map(b=>`${b.id}:${b.key}:${b.rotation}`).join('|')+Object.keys(s.cells||{}).join('|');
    if(signature===this.plantingSignature)return;this.plantingSignature=signature;
    const occupied=buildings.map(b=>footprint(this.game.world,b).bounds),temp=new THREE.Object3D();let i=0;
    for(const f of this.flowerTransforms){
      if(s.cells?.[cellAt(this.game.world,f.x,f.y).key])continue;
      if(occupied.some(b=>f.x>b[0]-.3&&f.x<b[2]+.3&&f.y>b[1]-.3&&f.y<b[3]+.3))continue;
      temp.position.set(f.x,f.z+f.h,-f.y);temp.rotation.set(0,f.yaw,0);temp.scale.setScalar(1);temp.updateMatrix();this.flowerMeshes[0].setMatrixAt(i,temp.matrix);this.flowerMeshes[0].setColorAt(i,c(f.color));
      temp.position.y+=.027;temp.updateMatrix();this.flowerMeshes[1].setMatrixAt(i,temp.matrix);
      temp.position.y=f.z+f.h/2;temp.scale.set(1,f.h,1);temp.updateMatrix();this.flowerMeshes[2].setMatrixAt(i,temp.matrix);i++;
    }
    for(const m of this.flowerMeshes){m.count=i;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;m.computeBoundingSphere();}
  }
  makeWaterfall(){
    // Scenic outcrop sits entirely in existing unwalkable water, clear of docks and building land.
    const island=new THREE.Group();island.position.set(15,0,-3);island.rotation.y=-.35;island.name='Coastal waterfall outcrop';
    this.decor.add(island);this.scenicGeometries=[];this.scenicMaterials=[];
    const rockParts=[],rnd=random(87);
    for(const [x,y,z,sx,sy,sz] of [[0,1,0,2.6,2.4,2.2],[-1.2,2.8,-.6,1.45,2,1.7],[.85,2.9,-.75,1.65,2.2,1.6],[2,-.2,.8,1.25,.6,1.1],[-2,-.25,1.4,1.1,.55,.8]]){
      const geo=new THREE.IcosahedronGeometry(1,2);geo.scale(sx,sy,sz);geo.rotateY(rnd()*2);geo.translate(x,y,z);rockParts.push(geo);
    }
    const rockGeo=mergeGeometries(rockParts),rockMat=new THREE.MeshStandardMaterial({color:'#c6b798',roughness:.96});rockParts.forEach(g=>g.dispose());
    const rocks=new THREE.Mesh(rockGeo,rockMat);rocks.castShadow=false;rocks.receiveShadow=true;island.add(rocks);
    this.scenicGeometries.push(rockGeo);this.scenicMaterials.push(rockMat);
    const capGeo=new THREE.SphereGeometry(1,12,7);capGeo.scale(1.68,.36,1.35);capGeo.translate(0,4.65,-.7);
    const capMat=new THREE.MeshStandardMaterial({color:'#78a841',roughness:1});const cap=new THREE.Mesh(capGeo,capMat);cap.receiveShadow=true;island.add(cap);
    this.scenicGeometries.push(capGeo);this.scenicMaterials.push(capMat);
    const palm=this.game.library.tree_coconut_palm?.clone(true);
    if(palm){palm.position.set(.25,4.75,-.9);palm.scale.setScalar(.83);palm.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});island.add(palm);}
    const geo=new THREE.PlaneGeometry(1.15,1,10,22),pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){
      const t=pos.getY(i)+.5,x=pos.getX(i);pos.setXYZ(i,x*(1.25-t*.3),-.36+t*4.85,2.6-t*2+Math.sin(t*Math.PI)*.85);
    }
    geo.computeVertexNormals();
    this.fallMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uTime:this.u.time,uDay:this.u.day},vertexShader:`varying vec2 vUv;uniform float uTime;void main(){vUv=uv;vec3 p=position;p.z+=sin(uv.y*30.-uTime*4.+uv.x*14.)*.025;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`varying vec2 vUv;uniform float uTime,uDay;void main(){float streak=.5+.5*sin(vUv.x*46.+sin(vUv.y*18.+uTime*3.)*.9);float rush=pow(.5+.5*sin(vUv.y*75.+uTime*8.+vUv.x*9.),7.);float edge=smoothstep(0.,.13,vUv.x)*(1.-smoothstep(.87,1.,vUv.x));vec3 water=mix(vec3(.19,.66,.78),vec3(.88,.99,1.),streak*.6+rush*.28);water*=mix(.25,1.,uDay);gl_FragColor=vec4(water,edge*.86);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`.replace(';#include',';\n#include')});
    const fall=new THREE.Mesh(geo,this.fallMaterial);fall.renderOrder=3;island.add(fall);this.scenicGeometries.push(geo);this.scenicMaterials.push(this.fallMaterial);
    this.splashRings=[];
    for(let i=0;i<3;i++){
      const ringGeo=new THREE.RingGeometry(.76,.9,36),mat=new THREE.MeshBasicMaterial({color:'#d2fff6',transparent:true,opacity:.5,depthWrite:false,side:THREE.DoubleSide});
      const ring=new THREE.Mesh(ringGeo,mat);ring.rotation.x=-Math.PI/2;ring.position.set(0,-.35+i*.005,2.6);ring.renderOrder=4;island.add(ring);this.splashRings.push(ring);this.scenicGeometries.push(ringGeo);this.scenicMaterials.push(mat);
    }
  }
  setEnabled(on){
    this.enabled=on;this.u.on.value=on?1:0;this.decor.visible=on;
    this.leafyTrees.setEnabled(on);
    for(const [mat,base] of this.saved){
      mat.color.copy(base.color);mat.roughness=base.roughness;mat.metalness=base.metalness;
      const n=mat.name||'',leaf=Object.keys(leafColors).find(x=>n===`MAT_HW_SoftTree_${x}`);
      if(on&&leaf)mat.color.set(leafColors[leaf]);
      if(on&&/Leaf_Mid/.test(n))mat.color.set('#6b9f40');
      if(on&&/Leaf_Bright/.test(n))mat.color.set('#a1c955');
      if(on&&/Leaf_Deep/.test(n))mat.color.set('#35744b');
    }
  }
  update(dt,day){
    this.time+=dt;this.u.time.value=this.time;this.u.day.value=smooth(day,.38,.95);
    for(let i=0;i<this.splashRings.length;i++){const p=(this.time*.38+i/3)%1,r=this.splashRings[i];r.scale.setScalar(.45+p*1.8);r.material.opacity=(1-p)*.5;}
    if(this.enabled){
      const g=this.game,w=this.u.day.value;
      g.sun.color.lerp(c('#fff0d1'),w*.55);g.hemi.color.lerp(c('#b7ddf0'),w*.55);
      g.hemi.groundColor.set('#687f44');g.sun.intensity*=1.-w*.10;g.hemi.intensity*=1.+w*.07;
      g.renderer.toneMappingExposure=1.14;
    }else{this.game.hemi.groundColor.set('#6c6f3d');this.game.renderer.toneMappingExposure=1.12;}
    if(this.time-(this.lastRefresh||0)>1){this.lastRefresh=this.time;this.refreshPlanting();}
  }
  dispose(){
    this.leafyTrees.dispose();
    this.game.scene.remove(this.decor);this.u.shore.value.dispose();
    for(const m of this.flowerMeshes){m.geometry.dispose();m.material.dispose();}
    this.scenicGeometries.forEach(g=>g.dispose());this.scenicMaterials.forEach(m=>m.dispose());
  }
}
