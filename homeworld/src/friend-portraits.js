import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
const cache=new WeakMap();
export function cloneFriendForPortrait(source){
 // Runtime mixers/controllers in userData can contain circular references.
 // SkeletonUtils only needs the scene hierarchy; restore metadata synchronously.
 const metadata=[];
 source.traverse(node=>{metadata.push([node,node.userData]);node.userData={};});
 try{return clone(source);}finally{for(const [node,data] of metadata)node.userData=data;}
}
/** Still pictures of the actual island models. No animation loops or per-card WebGL contexts. */
export function friendPortraits(game,friends){
 const pictures={};let renderer;
 try{
  for(const friend of friends){
   const source=friend.id==='adam'?game?.community?.actors?.adam?.actor:game?.residents?.models?.get(friend.id);
   if(!source){if(friend.imageUrl)pictures[friend.id]=friend.imageUrl;continue;}
   if(cache.has(source)){pictures[friend.id]=cache.get(source);continue;}
   renderer ||= new THREE.WebGLRenderer({alpha:true,antialias:true});
   renderer.setSize(192,192);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
   const scene=new THREE.Scene(),model=cloneFriendForPortrait(source);
   model.visible=true;model.position.set(0,0,0);model.rotation.set(0,0,0);scene.add(model);
   scene.add(new THREE.HemisphereLight(0xffffff,0x8c7760,2.6));
   const light=new THREE.DirectionalLight(0xfff4df,2.5);light.position.set(3,5,6);scene.add(light);
   model.updateMatrixWorld(true);
   const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
   if(!Number.isFinite(size.y)||size.y<=0)continue;
   const span=Math.max(size.y*.62,size.x*.78),target=new THREE.Vector3(center.x,box.max.y-size.y*.26,center.z);
   const camera=new THREE.OrthographicCamera(-span/2,span/2,span/2,-span/2,.01,100);
   camera.position.copy(target).add(new THREE.Vector3(0,0,Math.max(4,size.z*3)));camera.lookAt(target);
   renderer.render(scene,camera);
   const url=renderer.domElement.toDataURL('image/png');cache.set(source,url);pictures[friend.id]=url;
   // The clone shares textures/geometries with the live model: never dispose those.
   scene.clear();
  }
 }catch{ /* A CMS portrait or initial remains usable if WebGL is unavailable. */ }
 finally{renderer?.dispose();renderer?.forceContextLoss();}
 return pictures;
}
