/** Shared, profile-bound handoff between the original island and the app reader. */
export const TEST_SCOPE_PREFIX='living-test-solo';
export const FIRST_FRIEND_BASE='gk_living_first_friend_v1';
export const testScopeFor=profile=>`${TEST_SCOPE_PREFIX}:${String(profile||'local').trim()||'local'}`;
export const firstFriendKey=profile=>`${FIRST_FRIEND_BASE}:${testScopeFor(profile)}`;
const validId=v=>typeof v==='string'&&v.length>0&&v.length<=200&&!/[\u0000-\u001f]/.test(v);

export function readFirstFriend(storage,key){
  try{
    const value=JSON.parse(storage.getItem(key)||'null');
    if(!value||value.version!==1||!['offered','reading','unlocked'].includes(value.phase))return null;
    if(value.phase!=='offered'&&(!validId(value.islandId)||!validId(value.storyId)))return null;
    if(value.phase==='unlocked'&&value.character!=='adam')return null;
    return value;
  }catch{return null;}
}
export function offerFirstFriend(storage,key){
  const existing=readFirstFriend(storage,key);if(existing)return existing;
  const value={version:1,phase:'offered'};
  try{storage.setItem(key,JSON.stringify(value));return value;}catch{return null;}
}
export function beginFirstFriendStory(storage,key,islandId,storyId){
  const existing=readFirstFriend(storage,key);
  if(!existing||existing.phase==='unlocked'||!validId(islandId)||!validId(storyId))return null;
  // Once reading begins, a different story cannot silently replace Adam's first-story target.
  if(existing.phase==='reading')return existing.islandId===islandId&&existing.storyId===storyId?existing:null;
  const value={version:1,phase:'reading',islandId,storyId};
  try{storage.setItem(key,JSON.stringify(value));return value;}catch{return null;}
}
export function isFirstFriendReading(storage,key,islandId,storyId){
  const value=readFirstFriend(storage,key);
  return value?.phase==='reading'&&value.islandId===islandId&&value.storyId===storyId;
}
export function finishFirstFriendStory(storage,key,islandId,storyId){
  if(!isFirstFriendReading(storage,key,islandId,storyId))return false;
  const value={version:1,phase:'unlocked',islandId,storyId,character:'adam'};
  try{storage.setItem(key,JSON.stringify(value));return true;}catch{return false;}
}
