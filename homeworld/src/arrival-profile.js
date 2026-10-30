/**
 * Welcome-ashore profile cards.
 *
 * When a story friend is dropped off (residents.js `consumeTap` → `game.arrivals.arrive`), a card
 * with their strengths, "still learning" list and the tasks they do pops up once. Which friends
 * already had their card is kept in `godlykids_island_profile_shown_v1`, scoped per kid profile
 * like every other island key, so a reload never repeats it and profiles never leak between
 * kids. The same card opens later from About on a friend's card (`open`) without being recorded.
 */
import {scopeKey} from './storage-scope.mjs';
import {RESIDENTS_KEY} from './residents.js';
import {profileFor} from './character-profile.mjs';

export const PROFILE_SHOWN_KEY_BASE='godlykids_island_profile_shown_v1';
export const PROFILE_SHOWN_KEY=scopeKey(PROFILE_SHOWN_KEY_BASE);
/** Real ms before the card slides up, so the friend is standing on the grass first. */
export const ARRIVAL_DELAY_MS=900;
/** The welcome card dismisses itself after this long; About cards stay until tapped. */
export const ARRIVAL_AUTO_DISMISS_MS=9000;

function readShown(storage){
  try{const raw=storage.getItem(PROFILE_SHOWN_KEY);if(raw===null)return null;const list=JSON.parse(raw);return Array.isArray(list)?list.filter(x=>typeof x==='string'):[];}catch{return [];}
}
function residentIds(storage){
  try{const list=JSON.parse(storage.getItem(RESIDENTS_KEY)||'[]');return Array.isArray(list)?list.map(r=>r?.id).filter(x=>typeof x==='string'):[];}catch{return [];}
}

export class Arrivals{
  constructor(game,storage=typeof localStorage!=='undefined'?localStorage:null){
    this.game=game;this.storage=storage;
    this.card=null;      // {resident, mode:'arrival'|'about', at}
    this.queue=[];       // arrivals waiting while another card is up
    const shown=storage?readShown(storage):[];
    // First boot with this feature: friends already living here are not "new", so they are not greeted.
    this.shown=new Set(shown===null?residentIds(storage):shown);
    if(shown===null)this.persist();
  }
  persist(){try{this.storage?.setItem(PROFILE_SHOWN_KEY,JSON.stringify([...this.shown]));}catch{/* storage full: the card may repeat once */}}

  /** A friend was just placed on the grass. Shows their card once per profile. */
  arrive(resident){
    if(!resident?.id||this.shown.has(resident.id))return false;
    this.shown.add(resident.id);this.persist();
    const entry={resident:{id:resident.id,name:resident.name||'Friend',imageUrl:resident.imageUrl||''},mode:'arrival',at:Date.now()+ARRIVAL_DELAY_MS};
    if(this.card)this.queue.push(entry);else this.card=entry;
    this.game.notify?.();
    return true;
  }
  /** About <name> from a friend's card: same profile, no timer, not recorded. */
  open(id){
    const actor=this.game.residents?.models?.get(id);
    const home=actor?.userData;
    if(!home?.residentId)return false;
    this.card={resident:{id:home.residentId,name:home.name||'Friend',imageUrl:home.imageUrl||''},mode:'about',at:Date.now()};
    this.game.notify?.();
    return true;
  }
  dismiss(){
    this.card=this.queue.shift()||null;
    if(this.card)this.card.at=Math.max(this.card.at,Date.now()+300);
    this.game.notify?.();
  }
  /** Lets a test or a grown-up tool show the welcome card again for one friend. */
  forget(id){this.shown.delete(id);this.persist();}

  /** What the UI renders, or null. */
  snapshot(){
    const c=this.card;if(!c)return null;
    const profile=profileFor(c.resident,this.game.store?.state);
    return {...c.resident,mode:c.mode,at:c.at,autoDismissMs:c.mode==='arrival'?ARRIVAL_AUTO_DISMISS_MS:0,profile};
  }
}
