/**
 * Profiles for story friends who are not in the static canon (characters.mjs).
 *
 * The reward pool keeps growing, so when a collected Bible friend is dropped off and `characterFor(name)`
 * would fall through to the generic helper, the island asks the app for a Gemini-written profile:
 *
 *   island  --postMessage gk-character-profile-please {name, id, sourceStoryId}-->  MyHomePage.tsx
 *   MyHomePage  --POST /api/island/character-profile {name, tags, deviceId}-->  backend (cached in Mongo by name)
 *   island  <--postMessage gk-character-profile {name, profile|null}--  MyHomePage.tsx
 *
 * The island has no backend access of its own (it only loads assets), so the app page does the network call.
 * Profiles are cached on the device under `godlykids_island_charprofile_v1:<key>` — NOT profile-scoped, because
 * who Gideon is does not depend on which kid is playing. Every profile is run through validateProfile() both
 * when it arrives and when it is read back, so a bad cache entry is simply ignored.
 *
 * Only friends that came through the app's drop-off (collected rewards: a reward id, a sourceStoryId, or a
 * bible_* tag) are looked up. Travellers who immigrate with made-up names never reach Gemini.
 */
import {characterKey,needsProfile,registerCharacter,validateProfile,characterFor} from './characters.mjs';

export const PROFILE_CACHE_PREFIX='godlykids_island_charprofile_v1:';
/** Real ms before a pending request is forgotten (the generic card simply stays). */
const PENDING_MS=20000;

export const cacheKeyFor=name=>`${PROFILE_CACHE_PREFIX}${characterKey(name)}`;

/** True when this drop-off is a story / Bible friend (worth a lookup), not an island-born traveller. */
export function isStoryFriend(character){
  if(!character||!character.name)return false;
  if(character.story===true||character.sourceStoryId)return true;
  return /bible|story|reward|onboarding/i.test(String(character.id||''));
}

export class RemoteProfiles{
  constructor(game,storage=typeof localStorage!=='undefined'?localStorage:null,parent=undefined){
    this.game=game;this.storage=storage;this.pending=new Map();
    // Who to ask: the app page hosting the iframe. Standalone dev pages and node tests have no parent, so they never ask.
    this.parent=parent!==undefined?parent:(typeof window!=='undefined'&&window.parent&&window.parent!==window?window.parent:null);
    this.hydrate();
  }
  /** Load every cached profile on this device into the canon registry (once, at boot). */
  hydrate(){
    const st=this.storage;if(!st)return 0;let n=0;
    try{
      for(let i=0;i<st.length;i++){
        const k=st.key(i);if(!k||!k.startsWith(PROFILE_CACHE_PREFIX))continue;
        const profile=this.readCached(k.slice(PROFILE_CACHE_PREFIX.length));
        if(profile){registerCharacter(profile.name,profile);n++;}
      }
    }catch{/* storage unavailable: profiles live for this session only */}
    return n;
  }
  readCached(name){
    try{const raw=this.storage?.getItem(cacheKeyFor(name));if(!raw)return null;const parsed=JSON.parse(raw);return validateProfile(parsed?.profile||parsed,name);}catch{return null;}
  }
  writeCached(name,profile){
    try{this.storage?.setItem(cacheKeyFor(name),JSON.stringify({v:1,at:Date.now(),profile}));}catch{/* storage full: session only */}
  }
  /** Called from Residents.beginDrop: make sure a profile is on its way before the kid taps the ground. */
  prefetch(character){
    if(!isStoryFriend(character)||!needsProfile(character.name))return false;
    const cached=this.readCached(character.name);
    if(cached){registerCharacter(character.name,cached);return false;}
    const key=characterKey(character.name),now=Date.now();
    const p=this.pending.get(key);if(p&&now-p<PENDING_MS)return true;
    this.pending.set(key,now);
    if(this.parent){
      const origin=typeof location!=='undefined'?location.origin:'*';
      this.parent.postMessage({type:'gk-character-profile-please',name:character.name,id:character.id||'',sourceStoryId:character.sourceStoryId||''},origin);
    }
    return true;
  }
  /** gk-character-profile from the app: validate, register, cache, and let an open card upgrade itself. */
  receive(data){
    const name=String(data?.name||'').trim();if(!name)return false;
    const key=characterKey(name);this.pending.delete(key);
    const profile=validateProfile(data?.profile,name);
    if(!profile)return false;
    registerCharacter(name,profile);this.writeCached(name,profile);
    this.game.notify?.();
    return true;
  }
  /** For tests and the dev panel: what the island currently knows about a name. */
  describe(name){return {key:characterKey(name),needsProfile:needsProfile(name),pending:this.pending.has(characterKey(name)),profile:characterFor(name)};}
}
