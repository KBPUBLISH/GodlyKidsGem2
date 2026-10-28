import * as THREE from 'three';
export const CHARACTER_HEIGHT=1.85;
export function normalizeCharacterModel(model,height=CHARACTER_HEIGHT){
 model.updateMatrixWorld(true);const original=new THREE.Box3().setFromObject(model,true),size=original.max.y-original.min.y;
 if(!(size>0&&Number.isFinite(size)))throw Error('Character model has no measurable height');
 model.scale.multiplyScalar(height/size);model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model,true);
 model.position.add(new THREE.Vector3(-(box.min.x+box.max.x)/2,-box.min.y,-(box.min.z+box.max.z)/2));model.updateMatrixWorld(true);return height;
}
