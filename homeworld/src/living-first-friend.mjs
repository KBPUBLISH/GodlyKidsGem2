/** Profile-bound journey: ship → Genesis pack → Adam aboard → island tasks/tent → placement. */
export const TEST_SCOPE_PREFIX='living-test-solo';
export const FIRST_FRIEND_BASE='gk_living_first_friend_v1';
export const testScopeFor=profile=>`${TEST_SCOPE_PREFIX}:${String(profile||'local').trim()||'local'}`;
export const firstFriendKey=profile=>`${FIRST_FRIEND_BASE}:${testScopeFor(profile)}`;
const validId=v=>typeof v==='string'&&v.length>0&&v.length<=200&&!/[\u0000-\u001f]/.test(v);
const validPoint=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)&&Math.abs(p.x)<10000&&Math.abs(p.y)<10000;
const phases=['offered','ship','pack','reading','reward','aboard','placing','placed'];
export function readFirstFriend(storage,key){
 try{
  const v=JSON.parse(storage.getItem(key)||'null');
  if(!v||![1,2].includes(v.version)||(!phases.includes(v.phase)&&!(v.version===1&&v.phase==='unlocked')))return null;
  if(!['offered','ship'].includes(v.phase)&&(!validId(v.islandId)||!validId(v.storyId)))return null;
  if(['aboard','placing','placed','unlocked'].includes(v.phase)&&v.character!=='adam')return null;
  if(v.phase==='placed'&&!validPoint(v.position))return null;
  return v;
 }catch{return null;}
}
function write(storage,key,v){try{storage.setItem(key,JSON.stringify(v));return v;}catch{return null;}}
export function offerFirstFriend(storage,key){return readFirstFriend(storage,key)||write(storage,key,{version:2,phase:'offered'});}
export function startFirstFriendVoyage(storage,key){
 const v=readFirstFriend(storage,key);if(!v||['placed','unlocked'].includes(v.phase))return null;
 return v.phase==='offered'?write(storage,key,{...v,version:2,phase:'ship'}):v;
}
export function beginFirstFriendPack(storage,key,islandId,storyId){
 const v=readFirstFriend(storage,key);if(!v||!validId(islandId)||!validId(storyId))return null;
 if(['pack','reading','reward'].includes(v.phase))return v.islandId===islandId&&v.storyId===storyId?v:null;
 if(v.phase!=='ship')return null;
 return write(storage,key,{version:2,phase:'pack',islandId,storyId});
}
export function beginFirstFriendStory(storage,key,islandId,storyId){
 const v=readFirstFriend(storage,key);if(!v||!validId(islandId)||!validId(storyId))return null;
 if(v.phase==='reading')return v.islandId===islandId&&v.storyId===storyId?v:null;
 if(v.phase!=='pack'||v.islandId!==islandId||v.storyId!==storyId)return null;
 return write(storage,key,{...v,phase:'reading'});
}
export function isFirstFriendReading(storage,key,islandId,storyId){
 const v=readFirstFriend(storage,key);return v?.phase==='reading'&&v.islandId===islandId&&v.storyId===storyId;
}
export function finishFirstFriendStory(storage,key,islandId,storyId){
 if(!isFirstFriendReading(storage,key,islandId,storyId))return false;
 return !!write(storage,key,{version:2,phase:'reward',islandId,storyId});
}
export function claimFirstFriend(storage,key,islandId,storyId){
 const v=readFirstFriend(storage,key);if(v?.phase!=='reward'||v.islandId!==islandId||v.storyId!==storyId)return false;
 return !!write(storage,key,{...v,character:'adam',phase:'aboard'});
}
export function prepareFirstFriendDrop(storage,key){
 const v=readFirstFriend(storage,key);if(v?.phase==='placing')return true;
 return v?.phase==='aboard'&&!!write(storage,key,{...v,phase:'placing'});
}
export function placeFirstFriend(storage,key,position){
 const v=readFirstFriend(storage,key);if(v?.phase!=='placing'||!validPoint(position))return false;
 return !!write(storage,key,{...v,phase:'placed',position:{x:position.x,y:position.y}});
}
