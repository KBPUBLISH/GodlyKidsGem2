import {CharacterWelcome} from './character-welcome.js';
/** New residents get one close-up and chat per child profile. About still opens
 * their reusable profile card; existing residents never replay an arrival. */
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
    this.scene=null;
    this.onChatClose=e=>{if(e.origin===location.origin&&e.source===window.parent&&e.data?.type==='gk-arrival-chat-close'&&e.data.id===this.card?.resident.id)this.dismiss();};
    if(typeof window!=='undefined')window.addEventListener('message',this.onChatClose);
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
    if(this.busy)return false;
    const actor=this.game.residents?.models?.get(id);
    const home=actor?.userData;
    if(!home?.residentId)return false;
    this.card={resident:{id:home.residentId,name:home.name||'Friend',imageUrl:home.imageUrl||''},mode:'about',at:Date.now()};
    this.game.notify?.();
    return true;
  }
  dismiss(){
    this.scene?.restore();this.scene=null;
    this.card=this.queue.shift()||null;
    if(this.card)this.card.at=Math.max(this.card.at,Date.now()+300);
    this.game.notify?.();
  }
  get busy(){return this.card?.mode==='arrival';}
  owns(actor){return !!this.scene&&this.scene.actor===actor;}
  update(dt,now=Date.now()){
    if(!this.busy)return;
    const g=this.game,c=this.card;
    if(!this.scene){
      if(this.uiPaused||now<c.at||g.store?.state?.night||g.interior||g.mapOnly||g.siteView||g.fishing?.active||g.livingTest?.arrival?.active||g.livingTest?.friend?.chatOpen||g.action||g.order)return;
      const helper=g.community?.actors?.[c.resident.id];
      const actor=g.residents?.models?.get(c.resident.id)||(helper?.modelReady!==false?helper?.actor:null);
      if(!actor&&now<c.at+12000)return;
      this.scene=new CharacterWelcome(g,c.resident,actor,{reduced:typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches,onHello:()=>this.startChat()});
      g.notify?.();
    }
    this.scene.update(dt);
  }
  startChat(){
    const g=this.game,c=this.card;if(!c||!this.scene)return;
    const embedded=typeof window!=='undefined'&&window.parent!==window;
    if(c.resident.id==='adam'&&g.livingTest?.state.adamUnlocked){
      g.livingTest.welcomeAdam();g.livingTest.syncFirstFriend();
      if(embedded){
        // Restore before opening so Adam's chat saves the normal gameplay camera.
        this.scene.restore();g.livingTest.friend.open('chat',true);
        if(g.livingTest.friend.chatOpen){g.notify?.();return;}
      }
    }
    if(embedded){
      window.parent.postMessage({type:'gk-resident-talk',arrival:true,character:c.resident,world:g.autoWork?.brief?.()||null},location.origin);
    }
    g.notify?.();
  }
  hello(){this.scene?.hello();}
  dispose(){this.scene?.restore();this.scene=null;if(typeof window!=='undefined')window.removeEventListener('message',this.onChatClose);}
  /** Lets a test or a grown-up tool show the welcome card again for one friend. */
  forget(id){this.shown.delete(id);this.persist();}

  /** What the UI renders, or null. */
  snapshot(){
    const c=this.card;if(!c)return null;
    const profile=profileFor(c.resident,this.game.store?.state);
    return {...c.resident,cinematic:c.mode==='arrival',phase:this.scene?.phase||'waiting',hasModel:!!this.scene?.actor,standalone:typeof window!=='undefined'&&window.parent===window,mode:c.mode,at:c.at,autoDismissMs:c.mode==='arrival'?ARRIVAL_AUTO_DISMISS_MS:0,profile};
  }
}
