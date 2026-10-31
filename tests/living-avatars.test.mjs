import {test} from 'node:test';
import {statSync} from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LIVING_AVATARS,getLivingAvatar,livingAvatarForProfile,livingAvatarPortraitUrl} from '../shared/livingAvatars.mjs';
import {createLivingPlayer} from '../homeworld/src/living-player-model.js';

test('six distinct designs retain the same world scale and a bounded geometry budget',()=>{
  assert.equal(LIVING_AVATARS.length,6);
  assert.equal(new Set(LIVING_AVATARS.map(a=>a.id)).size,6);
  assert.equal(new Set(LIVING_AVATARS.map(a=>a.hairStyle)).size,6);
  for(const avatar of LIVING_AVATARS){
    const player=createLivingPlayer(avatar.id);
    assert.equal(player.model.userData.avatarId,avatar.id);
    player.update(.03,1,.5,{carrying:true});
    const bounds=new THREE.Box3().setFromObject(player.model),size=bounds.getSize(new THREE.Vector3());
    assert.ok(size.y>1.5&&size.y<2.1,avatar.id);
    let triangles=0;player.model.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
    assert.ok(triangles<30000,`${avatar.id}: ${triangles} triangles`);
    player.dispose();
  }
});

test('profile choices survive the existing cloud payload and stay independent',()=>{
  const sarah={worldAvatarId:'berry',avatarSeed:getLivingAvatar('berry').portrait};
  const brother={worldAvatarId:'sky',avatarSeed:getLivingAvatar('sky').portrait};
  assert.equal(livingAvatarForProfile(sarah).id,'berry');
  assert.equal(livingAvatarForProfile(brother).id,'sky');
  assert.equal(livingAvatarForProfile({avatarSeed:sarah.avatarSeed}).id,'berry');
  assert.equal(livingAvatarForProfile({worldAvatarId:'invalid',avatarSeed:brother.avatarSeed}).id,'sky');
  assert.equal(getLivingAvatar('invalid').id,'trail');
  assert.equal(livingAvatarForProfile(null).id,'trail');
});


test('updated portraits bypass old artwork caches without changing saved avatar identifiers',()=>{
  const src=getLivingAvatar('berry').portrait;
  assert.equal(src,'/avatars/adventurers/berry.png');
  assert.equal(livingAvatarPortraitUrl(src),src.replace('.png','.webp')+'?v=harbor-4');
  assert.equal(livingAvatarPortraitUrl(src.replace('.png','.webp')),'/avatars/adventurers/berry.webp?v=harbor-4');
  for(const other of [null,'/avatars/heads/head-1.png','https://example.com/me.png'])assert.equal(livingAvatarPortraitUrl(other),other);
});


test('the generated avatar screen stays within a small mobile artwork budget',()=>{
 const root=new URL('../public/',import.meta.url);
 const bytes=path=>statSync(new URL(path,root)).size;
 const shared=['logo','heading','caption','confirm','arrow'].reduce((n,name)=>n+bytes(`assets/images/avatar-harbor/${name}-v1.webp`),0);
 const portraits=LIVING_AVATARS.reduce((n,a)=>n+bytes(`avatars/adventurers/${a.id}.webp`),0);
 assert.ok(shared+portraits+bytes('assets/images/avatar-harbor/harbor-phone-v1.webp')<450000);
 assert.ok(bytes('assets/images/avatar-harbor/harbor-tablet-v1.webp')<300000);
 for(const a of LIVING_AVATARS)assert.ok(bytes(`avatars/adventurers/${a.id}-full.webp`)<50000);
});
