import {useEffect,useState} from 'react';
import {islandStoryProgressService} from '../services/islandStoryProgressService';
import { getProfileScopeKey, onProfileScopeChange } from './profileScope';
import { resolveFirstStoryPackDestination } from './onboardingJourney';
import { rewardsService, ONBOARDING_ADAM_ID, ONBOARDING_ADAM_REWARD } from '../services/rewardsService';
import { firstFriendKey,readFirstFriend,startFirstFriendVoyage,beginFirstFriendPack,beginFirstFriendStory,isFirstFriendReading,finishFirstFriendStory,claimFirstFriend,prepareFirstFriendDrop } from '../homeworld/src/living-first-friend.mjs';
const EVENT='gk-living-friend-journey';
const changed=()=>window.dispatchEvent(new Event(EVENT));
export const livingFriendRecord=()=>readFirstFriend(localStorage,firstFriendKey(getProfileScopeKey()));
export function useLivingFriendJourney(){
 const [record,setRecord]=useState(livingFriendRecord);
 useEffect(()=>{const sync=()=>setRecord(livingFriendRecord());window.addEventListener(EVENT,sync);window.addEventListener('storage',sync);const off=onProfileScopeChange(sync);return()=>{window.removeEventListener(EVENT,sync);window.removeEventListener('storage',sync);off();};},[]);
 return record;
}
export function openLivingFirstFriendVoyage(scope:string){
 if(scope!==getProfileScopeKey()||!startFirstFriendVoyage(localStorage,firstFriendKey(scope)))throw Error('Finish your prayer tent first.');
 changed();return {path:'/crew',state:{livingFirstFriend:true}};
}
/** Tapping the ship's first island saves the pack before sailing. It does not start the reader. */
export async function openLivingFirstFriendStory(scope:string){
 if(scope!==getProfileScopeKey())throw Error('The active child changed.');
 const key=firstFriendKey(scope),record=readFirstFriend(localStorage,key);
 if(!record||!['ship','pack','reading','reward'].includes(record.phase))throw Error('Start your voyage first.');
 let islandId=record.islandId,storyId=record.storyId,state:Record<string,unknown>={};
 if(!islandId||!storyId){
  const destination=await resolveFirstStoryPackDestination(),url=new URL(destination.path,window.location.origin);
  islandId=decodeURIComponent(/^\/sail\/([^/]+)\/lesson/.exec(url.pathname)?.[1]||'');storyId=url.searchParams.get('storyId')||'';state={...destination.state};
 }
 if(scope!==getProfileScopeKey()||!beginFirstFriendPack(localStorage,key,islandId,storyId))throw Error('Couldn’t save the voyage. Try again.');
 // A resumed pack can already have a real reader completion on this profile.
 if(islandStoryProgressService.get(islandId,storyId).read){beginFirstFriendStory(localStorage,key,islandId,storyId);finishFirstFriendStory(localStorage,key,islandId,storyId);}
 delete state.onboardingJourney;changed();
 return {path:`/sail/${encodeURIComponent(islandId)}/lesson?storyId=${encodeURIComponent(storyId)}`,state:{...state,fromSail:true,livingFirstFriend:true}};
}
export function startLivingFirstFriendReading(islandId:string,storyId:string){
 const ok=!!beginFirstFriendStory(localStorage,firstFriendKey(getProfileScopeKey()),islandId,storyId);if(ok)changed();return ok;
}
export function completeLivingFirstFriendReading(islandId:string,storyId:string,readPageCount:number){
 if(!Number.isInteger(readPageCount)||readPageCount<1)return false;
 const ok=finishFirstFriendStory(localStorage,firstFriendKey(getProfileScopeKey()),islandId,storyId);if(ok)changed();return ok;
}
export function collectLivingFirstFriend(islandId:string,storyId:string,requirements:{hasQuizContent:boolean;hasTryIt:boolean}){
 const key=firstFriendKey(getProfileScopeKey());let record=readFirstFriend(localStorage,key);
 if(!record||record.islandId!==islandId||record.storyId!==storyId||!islandStoryProgressService.arePackBeatsComplete(islandId,storyId,requirements))return false;
 // Existing readers may resume at the quiz or Try It after updating the test build.
 if(['pack','reading'].includes(record.phase)){beginFirstFriendStory(localStorage,key,islandId,storyId);finishFirstFriendStory(localStorage,key,islandId,storyId);record=readFirstFriend(localStorage,key);}
 if(record?.phase!=='reward')return false;
 const findAdam=()=>rewardsService.getUnlockedCharacters().find(c=>c.id===ONBOARDING_ADAM_ID||/^adam$/i.test(c.name.trim()));
 // Use the same reward service as other story packs, with the already-packaged mobile model.
 if(!findAdam())rewardsService.collectReward(storyId,{...ONBOARDING_ADAM_REWARD,modelUrl:'/homeworld/assets/mobile/adam.glb?v=mobile-1'});
 if(!findAdam()||!claimFirstFriend(localStorage,key,islandId,storyId))return false;
 changed();return true;
}
export function bringLivingFirstFriendHome(){const ok=prepareFirstFriendDrop(localStorage,firstFriendKey(getProfileScopeKey()));if(ok)changed();return ok;}
export function isLivingFirstFriendReading(islandId:string,storyId:string){return isFirstFriendReading(localStorage,firstFriendKey(getProfileScopeKey()),islandId,storyId);}
