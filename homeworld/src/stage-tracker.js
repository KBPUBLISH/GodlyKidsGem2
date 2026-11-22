/**
 * Watches the island journey (stages.mjs) while the kid plays.
 *
 * Every couple of seconds it checks which stage the buildings add up to. A stage reached for the
 * first time is written into the save (`village.stageReachedAt[stage] = day`), toasted, noted in
 * the island feed, celebrated on screen (stage-journey.jsx reads `celebration`) and cheered by
 * every friend who is free to wave. Only a climb seen during play is celebrated: on the first scan of
 * a session (or an older island meeting the journey) already-reached stages are recorded quietly,
 * so nothing is celebrated twice or out of the blue.
 * Also owns the open/closed state of the Island journey panel so main.jsx stays thin.
 */
import * as THREE from 'three';
import {gameTime,timeLabel} from './core.mjs';
import {STAGE_LADDER,islandJourney,reachedIndex,unrecordedStages,recordStages,staleStages,forgetStages,stageCelebrationLine,stageById} from './stages.mjs';
import {noteEvent} from './island-feed.mjs';

const SCAN_MS=1500;
/** How long the confetti moment stays up before it clears itself. */
export const CELEBRATION_MS=6500;

export class StageTracker{
  constructor(game){
    this.g=game;
    this.lastScan=0;
    this.open=false;
    this.celebration=null;   // {id,name,icon,text,at}
    this.lastIndex=null;     // stage index at the previous scan; null until the first scan of this session
  }

  active(){const g=this.g,s=g.store?.state;return !!(s&&g.loaded&&g.playersOnly&&!g.ambient&&!g.store.locked);}

  update(){
    if(!this.active())return;
    const now=performance.now();
    if(now-this.lastScan<SCAN_MS)return;
    this.lastScan=now;
    const g=this.g,s=g.store.state;
    const index=reachedIndex(s),fresh=unrecordedStages(s);
    // The party only fires when the island climbs a step while the kid is playing. The first scan of a
    // session (and an older island meeting the journey for the first time) just remembers where it is;
    // a save that lost `stageReachedAt` to a stale overwrite is re-recorded quietly rather than re-celebrated.
    const climbed=this.lastIndex!==null&&index>this.lastIndex;
    this.lastIndex=index;
    const stale=staleStages(s);
    if(!fresh.length&&!stale.length)return;
    const day=timeLabel(gameTime(s)).day;
    try{g.store.save({...s,village:recordStages(forgetStages(s.village,stale),fresh,day)});}catch(e){g.toast?.(e.message);return;}
    if(climbed&&fresh.length)this.celebrate(STAGE_LADDER[index].id,day);
  }

  celebrate(stageId,day){
    const g=this.g,stage=stageById(stageId);if(!stage)return;
    const text=stageCelebrationLine(stageId);
    this.celebration={id:stage.id,name:stage.name,icon:stage.icon,text,at:Date.now()};
    g.toast(text,CELEBRATION_MS);
    try{noteEvent('build',text,{id:`stage:${stage.id}:${day}`});}catch{/* feed is best-effort */}
    this.cheer();
    try{g.music?.sfx?.play('harvest');}catch{/* no audio yet */}
    g.notify?.();
  }

  /** Everyone who is free waves at once (the same wave a tap on a friend plays). */
  cheer(){
    const g=this.g,res=g.residents;if(!res?.models)return;
    const s=g.store?.state;
    for(const actor of res.models.values()){
      const home=actor.userData;if(!home?.mixer)continue;
      if(s?.characters?.[home.id]?.sleep||home.chore||home.job||g.dining?.owns?.(actor))continue;
      if(actor===g.actor&&(g.action||g.autoWork?.active||g.fishing?.active||g.building?.preview))continue;
      const wave=res.waveClip(home.clips);if(!wave)continue;
      if(actor===g.actor){g.path=[];g.order=null;if(g.marker)g.marker.visible=false;g.walkSpeed=0;g.currentClip=null;g.locomotion=null;}
      home.mixer.stopAllAction();
      wave.reset();wave.setLoop(THREE.LoopOnce,1);wave.clampWhenFinished=true;wave.enabled=true;wave.play();
      home.waving=true;home.waveAction=wave;home.idling=false;home.flourish=null;
      home.strollState={wait:5+Math.random()*4};
    }
  }

  dismissCelebration(){if(!this.celebration)return;this.celebration=null;this.g.notify?.();}
  show(){if(this.open)return;this.open=true;this.g.notify?.();}
  hide(){if(!this.open)return;this.open=false;this.g.notify?.();}
  toggle(){this.open?this.hide():this.show();}

  /** What the badge, the panel and the celebration render. */
  snapshot(){
    const g=this.g,s=g.store?.state;if(!s)return null;
    const journey=islandJourney(s);
    const celebration=this.celebration&&Date.now()-this.celebration.at<CELEBRATION_MS?this.celebration:null;
    if(this.celebration&&!celebration)this.celebration=null;
    return {...journey,open:this.open,celebration,travellers:g.travellers?.stats?.()||null};
  }
}
