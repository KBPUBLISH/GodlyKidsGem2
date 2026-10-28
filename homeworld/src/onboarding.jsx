import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {heightAt,cellAt,cellFromKey,canPlow,dist,terrainType} from './core.mjs';
import {woodTotal,bedCount} from './building.mjs';
import {Icon} from './ui.jsx';
import './onboarding.css';

/**
 * First-visit tour of the island (My Home onboarding, part B).
 *
 * The parent page (MyHomePage) owns the gate: no story friend yet → read a story,
 * friends but nobody on the island → drop one off. Once a friend is placed it posts
 * `gk-onboarding {phase:'tour'}` and this module walks the kid through the island:
 * a spotlight on the real button or world spot to tap, a short caption, and the
 * step moves on when the thing actually happens (or on Next). Progress lives in
 * the same localStorage record the parent uses, so it resumes after a reload and
 * the island can keep its own pop-ups quiet until the tour is over.
 */
export const ONBOARDING_KEY='gk_home_onboarding_v1';
export function readOnboarding(){try{const v=JSON.parse(localStorage.getItem(ONBOARDING_KEY)||'null');return v&&typeof v==='object'?v:null;}catch{return null;}}
export function writeOnboarding(patch){const next={...(readOnboarding()||{}),...patch,updatedAt:Date.now()};try{localStorage.setItem(ONBOARDING_KEY,JSON.stringify(next));}catch{/* remembered for this visit only */}return next;}
/** True until the kid has finished (or skipped) the My Home onboarding. */
export function onboardingPending(){const o=readOnboarding();return !o||!o.done;}

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const tellParent=(type,extra={})=>{if(window.parent&&window.parent!==window)window.parent.postMessage({type,...extra},location.origin);};

/** Screen rect of the first visible element matching `sel` (null when hidden or missing). */
function rect(sel,{rx=18}={}){
  const el=document.querySelector(sel);if(!el)return null;
  let r=el.getBoundingClientRect();if(!r.width||!r.height)return null;
  if(getComputedStyle(el).visibility==='hidden')return null;
  // Inside a scrolling sheet (build cards, to-do list) bring the thing to tap into view first.
  const sheet=el.closest('.action-menu-content,.plan-card,.job-sheet');
  if(sheet){const a=sheet.getBoundingClientRect();if(r.top<a.top||r.bottom>a.bottom){el.scrollIntoView({block:'nearest'});r=el.getBoundingClientRect();}}
  return {x:r.left-6,y:r.top-6,w:r.width+12,h:r.height+12,rx:Math.min(rx,(r.height+12)/2)};
}
/** A patch of grass a couple of steps from the player, reachable on foot, for the very first "tap to walk". */
function walkSpot(g){
  const p=g.player;
  for(let k=0;k<8;k++){const a=k*Math.PI/4+.4,pt={x:p.x+2.6*Math.cos(a),y:p.y+2.6*Math.sin(a)};if(terrainType(g.world,pt.x,pt.y)===2&&g.nav?.path(p,pt))return pt;}
  return null;
}
/** Screen rect for a circle around a scene-space point (null when behind the camera / far off-screen). */
function projectPoint(g,v,r){
  const rect=g.renderer.domElement.getBoundingClientRect();if(!rect.width||!rect.height)return null;
  g.camera.updateMatrixWorld(true);const p=v.clone().project(g.camera);if(p.z<-1||p.z>1)return null;
  const x=(p.x+1)*rect.width/2+rect.left,y=(1-p.y)*rect.height/2+rect.top;
  return {x:x-r,y:y-r,w:r*2,h:r*2,rx:r,cx:x,cy:y,on:Math.abs(p.x)<.98&&Math.abs(p.y)<.96};
}
const projectWorld=(g,x,y,h,r)=>projectPoint(g,V(x,heightAt(g.world,x,y)+h,-y),r);

function nearestTree(g){
  const p=g.player,trees=[...(g.trees||[])].sort((a,b)=>dist(p,{x:a.position[0],y:a.position[1]})-dist(p,{x:b.position[0],y:b.position[1]})).slice(0,8);
  for(const t of trees)if(g.nav?.approach(p,{x:t.position[0],y:t.position[1]},1.22))return t;
  return trees[0]||null;
}
/** A clear grass cell near the player that the hoe can dig (a step or two away so the tap is obvious). */
function digSpot(g){
  const s=g.store.state,p=g.player,c0=cellAt(g.world,p.x,p.y);let best=null,bd=1e9;
  for(let dx=-3;dx<=3;dx++)for(let dy=-3;dy<=3;dy++){
    const key=`${c0.col+dx}:${c0.row+dy}`,c=cellFromKey(g.world,key),d=dist(p,c);
    if(d<.7||d>=bd||s.cells[key]?.soil||!canPlow(g.world,s,key))continue;bd=d;best=c;
  }
  return best;
}
/** The dug, empty garden spot closest to the player. */
function plantSpot(g){
  const s=g.store.state,p=g.player;let best=null,bd=1e9;
  for(const [key,c] of Object.entries(s.cells||{})){if(!c?.soil||c.seed)continue;const cell=cellFromKey(g.world,key),d=dist(p,cell);if(d<bd){bd=d;best=cell;}}
  return best;
}
/** Who is working right now: the played body's auto-work plus any friend with a job of their own. */
function jobSignature(g){
  const mine=g.autoWork?.task?`me:${g.autoWork.task.type}:${g.autoWork.task.startedAt}`:'';
  const theirs=[...(g.residents?.models?.values()||[])].filter(a=>a.userData.job&&a!==g.actor).map(a=>`${a.userData.residentId}:${a.userData.job.type}`).join(',');
  return `${mine}|${theirs}`;
}
const hasJob=g=>!!g.autoWork?.task||[...(g.residents?.models?.values()||[])].some(a=>a.userData.job&&a!==g.actor);
const myName=g=>g.actor?.userData?.name||g.store?.state.characters?.[g.store.state.activeCharacter]?.name||'your friend';

/** Where to tap for a tool: the recent-tools strip when it is out, otherwise Build → Actions → the tool. */
function toolPath(ctx,name,verb,tabs=['actions']){
  const {ui}=ctx;
  if(!ui.actionsOpen){
    const recent=rect(`.recent-tool[aria-label="${name}"]`,{rx:14});
    if(recent)return {target:recent,text:`Tap ${name} ${verb}.`};
    return {target:rect('.actions-menu-button',{rx:20}),text:'Tap Build to find your tools.'};
  }
  if(!tabs.includes(ui.actionsTab))return {target:rect('#activity-actions',{rx:17}),text:'Tap Actions.'};
  return {target:rect(`.action-options button[aria-label="${name}"]`,{rx:17}),text:`Tap ${name} ${verb}.`};
}

/**
 * Each step: `resolve(ctx)` says what to spotlight and what to say right now (the
 * caption follows the kid through the menus), `base(g)` remembers where things stood
 * when the step began and `done(g,base)` says when the step is really done.
 */
export const TOUR_STEPS=[
  {id:'move',icon:'walk',title:'Walk around',why:'Your friend goes wherever you tap.',
    base:g=>({player:{...g.player},spot:walkSpot(g),at:Date.now()}),
    // The drop-off tap can leave the player mid-walk; keep sliding the baseline for a moment
    // so only a walk the kid starts *after* the card appears counts.
    done:(g,b)=>{if(Date.now()-b.at<1500){b.player={...g.player};return false;}return dist(g.player,b.player)>1.1;},
    resolve:({g},b)=>({target:b.spot?projectWorld(g,b.spot.x,b.spot.y,.1,40):null,text:'Tap the grass to walk.'})},
  {id:'chop',icon:'axe',title:'Chop a tree',why:'Wood builds homes and feeds the campfire.',
    base:g=>({wood:woodTotal(g.store.state),trees:g.store.state.stats.trees||0}),
    done:(g,b)=>woodTotal(g.store.state)>b.wood||(g.store.state.stats.trees||0)>b.trees,
    resolve:ctx=>{
      const {g}=ctx;
      if(g.action?.type==='chop'||g.order?.type==='chop')return {target:null,busy:true,text:'Chopping… keep tapping if the tree asks for more.'};
      if(g.tool==='axe'){const t=nearestTree(g);if(!t)return {target:null,text:'Walk to a tree and tap it.'};return {target:projectWorld(g,t.position[0],t.position[1],1.5*(t.scale?.[2]||1),44),text:'Tap a tree to chop wood.'};}
      return toolPath(ctx,'Chop','to grab the axe');
    }},
  {id:'plant',icon:'plant',title:'Dig and plant',why:'Water it and it grows into food.',
    base:g=>({plowed:g.store.state.stats.plowed||0,planted:g.store.state.stats.planted||0}),
    done:(g,b)=>(g.store.state.stats.planted||0)>b.planted,
    resolve:(ctx,b)=>{
      const {g}=ctx,s=g.store.state;
      if(['plow','plant'].includes(g.action?.type)||['plow','plant'].includes(g.order?.type))return {target:null,busy:true,text:g.action?.type==='plant'||g.order?.type==='plant'?'Planting…':'Digging…'};
      const dug=(s.stats.plowed||0)>b.plowed||!!plantSpot(g);
      if(!dug){
        if(g.tool==='hoe'){const c=digSpot(g);return c?{target:projectWorld(g,c.x,c.y,.1,40),text:'Tap the grass to dig a patch.'}:{target:null,text:'Walk to open grass, then tap it to dig.'};}
        return toolPath(ctx,'Dig','to grab the hoe',['actions','farm']);
      }
      if(g.tool==='plant'){const c=plantSpot(g);return {target:c?projectWorld(g,c.x,c.y,.1,40):null,text:'Tap your patch to plant a seed.'};}
      return toolPath(ctx,'Plant','to grab your seeds',['actions','farm']);
    }},
  {id:'goal',icon:'build',title:'Set a goal',why:'Pick a goal so your friends know what to work on.',
    base:g=>({goalAt:g.goal?.at||0,buildings:(g.store.state.buildings||[]).length}),
    // A goal picked (or re-picked) after the step began counts, even if an older goal already existed.
    done:(g,b)=>(!!g.goal&&(g.goal.at||0)!==b.goalAt)||(g.store.state.buildings||[]).length>b.buildings,
    resolve:ctx=>{
      const {g,ui,view}=ctx,preview=view.building?.preview;
      if(preview){
        if(preview.needsMaterials&&!preview.movingId)return {target:rect('.set-goal',{rx:16}),text:'Tap “Make it our goal”.'};
        if(preview.canPlace)return {target:rect('.place-building',{rx:16}),text:'Tap Place to build it!'};
        return {target:rect('.placement-tip button',{rx:16}),text:'Tap Find clear grass.'};
      }
      if(!ui.actionsOpen)return {target:rect('.actions-menu-button',{rx:20}),text:'Tap Build.'};
      if(ui.actionsTab!=='build')return {target:rect('#activity-build',{rx:17}),text:'Tap the Build tab.'};
      const beds=bedCount(g.store.state);
      return {target:rect('.build-card[aria-label="Choose Prayer Tent"]',{rx:16})||rect('.build-card',{rx:16}),text:beds?'Pick something to build.':'Pick the Prayer Tent. It has a bed.'};
    }},
  {id:'task',icon:'actions',title:'Give a job',why:'Friends work while you play.',
    base:g=>({jobs:jobSignature(g)}),
    done:(g,b)=>jobSignature(g)!==b.jobs&&hasJob(g),
    resolve:({g})=>{
      const name=myName(g);
      if(document.querySelector('.job-sheet'))return {target:rect('.job-sheet .resident-job-list button',{rx:14}),text:`Pick a job for ${name}.`};
      const task=rect('.resident-action.task',{rx:16});
      if(task)return {target:task,text:'Tap Task to give them a job.'};
      if(!g.actor?.visible)return {target:null,text:`Tap ${name} when they are back.`};
      g.actor.updateWorldMatrix(true,false);
      return {target:projectPoint(g,g.actor.getWorldPosition(V()).add(V(0,1,0)),54),text:`Tap ${name}.`};
    }},
  {id:'homes',icon:'rest',title:'Homes for friends',why:'Every friend needs a bed. More homes, more friends!',
    base:g=>({buildings:(g.store.state.buildings||[]).length}),
    done:(g,b)=>(g.store.state.buildings||[]).length>b.buildings,
    resolve:({g,ui})=>{
      const s=g.store.state,beds=bedCount(s),friends=g.residents?.models?.size||0;
      const note=`${beds} bed${beds===1?'':'s'} for ${friends} friend${friends===1?'':'s'}.`;
      if(ui.plan){const goal=rect('.plan-goal',{rx:16});return goal?{target:goal,text:`Your goal shows what is still needed. ${note}`}:{target:rect('.plan-list li',{rx:14}),text:`These jobs get a home built. ${note}`};}
      return {target:rect('.side-buttons button[aria-label="Open the island to-do list"]',{rx:20}),text:`Open To-do to see what a home needs. ${note}`};
    }},
  {id:'fish',icon:'fish',title:'Go fishing',why:'Fish makes a fine dinner at the campfire.',
    base:g=>({fish:g.store.state.stats.fishCaught||0}),
    done:(g,b)=>!!g.fishing?.active||(g.store.state.stats.fishCaught||0)>b.fish,
    resolve:({g,view})=>{
      if(view.fishPrompt)return {target:rect('.fish-prompt',{rx:24}),text:'Tap Fish?'};
      const pole=g.fishing?.pole;if(!pole)return {target:null,text:'Find the dock on the beach.'};
      const p=projectPoint(g,pole.position.clone().add(V(0,1.4,0)),50);
      if(!p||!p.on)return {target:null,edge:p,text:'Walk to the beach and tap the fishing pole.'};
      return {target:p,text:'Tap the fishing pole to catch dinner.'};
    }},
  {id:'done',icon:'pray',title:'You’re ready!',why:'Pray when you’re tired. Eat when you’re hungry. Have fun!',
    base:()=>({}),done:()=>false,resolve:()=>({target:null,center:true,text:'Your island is yours to grow.'})},
];

const STEP_CELEBRATE_MS=950;

/**
 * The coach-mark layer. Mount once in the island shell; it stays empty until the
 * parent asks for the tour. `ui` tells it what the React shell has open so the
 * caption can hide behind drawers and come back after.
 */
export function IslandTour({engine,view,ui,onActive}){
  const [active,setActive]=useState(false),[step,setStep]=useState(0),[shot,setShot]=useState(null),[cheer,setCheer]=useState(0);
  const baseRef=useRef(null),stepRef=useRef(0),cardRef=useRef(null),[cardH,setCardH]=useState(150);
  const uiRef=useRef(ui),viewRef=useRef(view);uiRef.current=ui;viewRef.current=view;

  const begin=(index)=>{
    const g=engine.current;const i=Math.max(0,Math.min(TOUR_STEPS.length-1,index|0));
    stepRef.current=i;setStep(i);baseRef.current=g?.loaded?TOUR_STEPS[i].base(g):null;
    writeOnboarding({step:'tour',tourStep:i,done:false});
  };
  const end=(how)=>{
    setActive(false);setShot(null);onActive?.(false);
    writeOnboarding({step:'done',done:true,tourStep:TOUR_STEPS.length,[how==='skipped'?'dismissedAt':'finishedAt']:Date.now(),skipped:how==='skipped'});
    tellParent('gk-onboarding-done',{[how]:true});
  };
  const advance=()=>{
    const i=stepRef.current;
    if(i>=TOUR_STEPS.length-1){end('finished');return;}
    setCheer(Date.now());begin(i+1);
  };

  // The parent starts (or replays) the tour once a friend lives here.
  useEffect(()=>{
    const onMessage=e=>{
      if(e.origin!==location.origin||e.data?.type!=='gk-onboarding')return;
      if(e.data.phase!=='tour')return;
      const saved=readOnboarding();const index=(e.data.replay||saved?.done)?0:(saved?.tourStep|0);
      setActive(true);onActive?.(true);begin(index);
    };
    window.addEventListener('message',onMessage);return()=>window.removeEventListener('message',onMessage);
  },[]);

  // The step's base is taken from the live game; if the island was still loading when the tour began, take it now.
  useEffect(()=>{if(active&&view.loaded&&!baseRef.current&&engine.current?.loaded)baseRef.current=TOUR_STEPS[stepRef.current].base(engine.current);},[active,view.loaded]);
  useEffect(()=>{if(!cheer)return;const id=setTimeout(()=>setCheer(0),STEP_CELEBRATE_MS+150);return()=>clearTimeout(id);},[cheer]);

  // Follow the game ~8× a second: did the kid do the thing? Where is the thing to tap right now?
  useEffect(()=>{
    if(!active)return;
    let frame,last=0,lastKey='';
    const tick=now=>{
      frame=requestAnimationFrame(tick);
      if(now-last<120)return;last=now;
      const g=engine.current,v=viewRef.current,u=uiRef.current;
      if(!g?.loaded||!v?.loaded){if(lastKey!=='-'){lastKey='-';setShot(null);}return;}
      const i=stepRef.current,def=TOUR_STEPS[i],b=baseRef.current;
      const paused=u.panel||u.showTime||u.mapOnly||v.overview||v.night?.sleeping||!!v.fishing||u.friendsOpen||(u.plan&&def.id!=='homes')||(!!v.building?.preview&&def.id!=='goal')||(!!document.querySelector('.job-sheet')&&def.id!=='task');
      // Bedtime (and other pauses) can move the player without a tap; re-baseline the walk step so only a real walk counts.
      if(paused&&def.id==='move')baseRef.current=def.base(g);
      else if(b&&def.done(g,b)){lastKey='';advance();return;}
      if(paused){if(lastKey!=='p'){lastKey='p';setShot(null);}return;}
      let r;try{r=def.resolve({g,view:v,ui:u},b||def.base(g));}catch{r={target:null,text:def.title};}
      const t=r.target?{x:Math.round(r.target.x),y:Math.round(r.target.y),w:Math.round(r.target.w),h:Math.round(r.target.h),rx:Math.round(r.target.rx||18),cx:r.target.cx,cy:r.target.cy}:null;
      const edge=r.edge?{cx:r.edge.cx,cy:r.edge.cy}:null;
      const key=JSON.stringify([i,r.text,t,edge,!!r.center,!!r.busy]);
      if(key===lastKey)return;lastKey=key;
      setShot({step:i,text:r.text,target:t,edge,center:!!r.center,busy:!!r.busy});
    };
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[active]);

  // Caption height, so it can sit above or below the spotlight without covering it.
  useEffect(()=>{
    const el=cardRef.current;if(!el||typeof ResizeObserver==='undefined')return;
    const ro=new ResizeObserver(()=>setCardH(el.offsetHeight||150));ro.observe(el);setCardH(el.offsetHeight||150);
    return()=>ro.disconnect();
  },[active,shot?.center,shot?.step]);

  if(!active)return null;
  const def=TOUR_STEPS[step],vw=window.innerWidth,vh=window.innerHeight;
  const safeTop=Math.max(12,(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-top'))||0)+12);
  const t=shot?.target,cardW=Math.min(330,vw-24);
  // Keep the caption clear of the spotlight and the bottom tool bar (~130px) and under the top bar.
  let cardStyle,placement='center',ax=cardW/2;
  if(shot&&!shot.center&&t){
    const cx=t.x+t.w/2,below=t.y+t.h+16+cardH<vh-130||t.y<vh*.45&&t.y+t.h+16+cardH<vh-12;
    const left=Math.max(12,Math.min(vw-12-cardW,cx-cardW/2));ax=Math.max(26,Math.min(cardW-26,cx-left));
    if(below){placement='below';cardStyle={left,top:Math.max(safeTop,t.y+t.h+16)};}
    else{placement='above';cardStyle={left,top:Math.max(safeTop,t.y-16-cardH)};}
  }else cardStyle={top:shot?.center?Math.max(safeTop+60,vh*.3-cardH/2):safeTop+64};
  const last=step>=TOUR_STEPS.length-1;
  const edge=shot?.edge&&!t?(()=>{const cx=Math.max(30,Math.min(vw-30,shot.edge.cx)),cy=Math.max(safeTop+60,Math.min(vh-150,shot.edge.cy));const dx=shot.edge.cx-vw/2,dy=shot.edge.cy-vh/2;const arrow=Math.abs(dx)>Math.abs(dy)?(dx>0?'→':'←'):(dy>0?'↓':'↑');return {left:cx-23,top:cy-23,arrow};})():null;
  return <div className="tour-layer" aria-live="polite">
    {shot&&<svg className="tour-shade" aria-hidden="true"><defs><mask id="tour-mask"><rect width="100%" height="100%" fill="#fff"/>{t&&<rect x={t.x} y={t.y} width={t.w} height={t.h} rx={t.rx} fill="#000"/>}</mask></defs><rect width="100%" height="100%" fill={t?'rgba(18,38,30,.36)':'rgba(18,38,30,.14)'} mask="url(#tour-mask)"/></svg>}
    {t&&<div className="tour-ring" style={{left:t.x,top:t.y,width:t.w,height:t.h,'--r':`${t.rx}px`}}/>}
    {edge&&<div className="tour-edge" style={{left:edge.left,top:edge.top}} aria-hidden="true">{edge.arrow}</div>}
    {shot&&<section ref={cardRef} className={`tour-card ${placement}`} style={{...cardStyle,'--ax':`${ax}px`}} role="dialog" aria-label={`Island tour step ${step+1} of ${TOUR_STEPS.length}: ${def.title}`}>
      <div className="tour-head"><Icon type={def.icon} size={36}/><div><span className="tour-step">Step {step+1} of {TOUR_STEPS.length}</span><strong>{def.title}</strong></div></div>
      <p>{shot.text}</p>
      <small>{def.why}</small>
      <div className="tour-actions">
        {!last&&<button type="button" className="tour-skip" onClick={()=>end('skipped')}>Skip tour</button>}
        <button type="button" className="tour-next" onClick={advance}>{last?'Finish':'Next'}</button>
      </div>
    </section>}
    {cheer>0&&<div key={cheer} className="tour-ok" aria-hidden="true">✓ Nice!</div>}
  </div>;
}
