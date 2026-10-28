import React,{useEffect,useState} from 'react';
import {Icon,ItemIcon} from './ui.jsx';
import {SEEDS,gameTime,growth} from './core.mjs';
import {completedHomes} from './nutrition.mjs';

/** Jobs a friend can be given from the Task button, beyond what the to-do list suggests right now. */
function jobsFor(g,helper){
 const s=g?.store?.state;if(!s)return {todo:[],more:[]};
 const todo=(g.plan?.()||[]).filter(i=>i.task&&!['eat','rest','cook'].includes(i.task.type)).slice(0,4);
 const min=gameTime(s),cells=Object.values(s.cells||{}),inv=s.inventory||{};
 const thirsty=cells.some(c=>c?.seed&&growth(c,min)?.thirsty),ready=cells.filter(c=>c?.seed&&growth(c,min)?.stage==='ready').length,seeds=SEEDS.some(x=>inv[x.id]>0);
 const more=[
  {id:'chop',icon:'axe',title:'Chop wood',why:'A few logs for the pile',task:{type:'chop',goal:'few'}},
  {id:'mine',icon:'mine',title:'Break rocks',why:'Stone for building',task:{type:'mine',goal:'any',count:1}},
  {id:'fish',icon:'fish',title:'Catch fish',why:'Three for supper',task:{type:'fish',goal:'few',count:3}},
  thirsty&&{id:'water',icon:'water',title:'Water the garden',why:'Every thirsty plant',task:{type:'water',goal:'all'}},
  {id:'harvest',icon:'harvest',title:'Harvest the garden',why:ready?`${ready} crop${ready===1?' is':'s are'} ripe right now`:'Nothing ripe yet · check back later',task:{type:'harvest'}},
  seeds&&!helper&&{id:'plant',icon:'plant',title:'Plant seeds',why:'Fill the empty garden spots',task:{type:'plant'}},
  !helper&&{id:'build',icon:'build',title:'Build something',why:'Pick a project and a spot',task:{type:'build'}},
  !helper&&completedHomes(s).length>0&&{id:'sleep',icon:'rest',title:'Go to sleep',why:'Refill energy at home',task:{type:'sleep'}},
 ].filter(Boolean).filter(j=>!todo.some(t=>t.task.type===j.task.type));
 return {todo,more};
}

export function ResidentGreeting({engine,enabled}){
 const [card,setCard]=useState(null),[picking,setPicking]=useState(false),[jobs,setJobs]=useState(null);
 useEffect(()=>{
  if(!enabled){setCard(null);setPicking(false);setJobs(null);return;}
  let frame;
  const update=()=>{setCard(engine.current?.residentGreeting?.()||null);frame=requestAnimationFrame(update);};
  frame=requestAnimationFrame(update);
  return()=>cancelAnimationFrame(frame);
 },[engine,enabled]);
 if(!enabled||!card){if(picking)setPicking(false);if(jobs)setJobs(null);return null;}
 const sleep=()=>{const g=engine.current;if(g?.nutrition?.goSleep())g.residents?.closeMenu();};
 const pray=()=>{const g=engine.current;setJobs(null);if(g?.nutrition?.pray())g.residents?.closeMenu();};
 const foods=card.foods||[];
 const eatItem=id=>{const g=engine.current;if(!g)return;setPicking(false);if(card.helper)g.residents?.feed(g.residents.menuActor(),id);else g.nutrition.eat(id);g.residents?.closeMenu();};
 const eat=()=>{const g=engine.current;if(!g)return;setJobs(null);if(!foods.length){g.toast(card.hasRawFish?'There is raw fish in the bag. Grill it at the campfire first.':'No snacks in the bag. Pick ripe crops, bake bread, or grill a fish.');return;}if(!foods.some(f=>f.gain>0)){g.toast(`${card.name} is full. Save the snacks for later.`);return;}setPicking(p=>!p);};
 const openJobs=()=>{const g=engine.current;if(!g)return;setPicking(false);setJobs(j=>j?null:jobsFor(g,card.helper));};
 const give=task=>{const g=engine.current;if(!g)return;setJobs(null);const who=g.residents?.menuId;g.assign(task,who);g.residents?.closeMenu();};
 const work=card.work;
 return <>
  <aside className={`resident-profile ${card.low?'is-low':''}`} aria-label={`${card.name} energy`}>
   <span className="resident-portrait">{card.imageUrl?<img src={card.imageUrl} alt=""/>:card.name[0]}</span>
   <div><strong>{card.name}</strong><div className="character-level energy"><div className="character-level-label"><span><Icon type="energy" size={15}/>Energy</span><b>{card.energy}<small>%</small></b></div><div className="character-level-track" role="progressbar" aria-label={`${card.name} energy`} aria-valuenow={card.energy} aria-valuemin="0" aria-valuemax="100"><i style={{width:`${card.energy}%`}}/></div></div>
    {card.hunger!=null&&<div className={`character-level hunger ${card.hunger<=25?'level-low':''}`}><div className="character-level-label"><span><Icon type="food" size={15}/>Hungry</span><b>{card.hunger}<small>%</small></b></div><div className="character-level-track" role="progressbar" aria-label={`${card.name} tummy`} aria-valuenow={card.hunger} aria-valuemin="0" aria-valuemax="100"><i style={{width:`${card.hunger}%`}}/></div>{card.hunger<=0?<small className="level-note">Empty tummy · working very slowly</small>:card.hunger<=25?<small className="level-note">Hungry · working slower</small>:null}</div>}
    {work&&<div className={`resident-work ${work.paused?'paused':''}`}><Icon type={work.type==='chop'?'axe':work.type==='fish'?'rawfish':work.type==='water'?'water':'rest'} size={15}/><span>{work.paused?'Paused · ':''}{work.label}{work.target!=null?` · ${work.done}/${work.target}`:work.done?` · ${work.progress}`:''}</span></div>}
   </div>
  </aside>
  {card.actions&&picking&&!work&&<div className="resident-food-picker" role="menu" aria-label={`Food for ${card.name}`} style={{left:card.actions.x,top:card.actions.y-78}} onPointerDown={e=>e.stopPropagation()}>
   <strong>What should {card.name} eat?</strong>
   <div className="resident-food-list">{foods.map(f=><button key={f.id} type="button" role="menuitem" disabled={f.gain<=0} aria-label={`${f.name}, ${f.count} in the bag${f.gain>0?`, plus ${f.gain}`:', full'}`} onClick={e=>{e.stopPropagation();eatItem(f.id);}}><ItemIcon id={f.id} size={30}/><span>{f.name}</span><small>{f.gain>0?`+${f.gain}`:'Full'} · ×{f.count}</small></button>)}</div>
  </div>}
  {jobs&&<div className="job-shade" onPointerDown={e=>e.stopPropagation()} onClick={()=>setJobs(null)}>
   <section className="job-sheet panel" role="dialog" aria-modal="true" aria-label={`A job for ${card.name}`} onClick={e=>e.stopPropagation()}>
    <div className="job-head"><span className="job-face">{card.imageUrl?<img src={card.imageUrl} alt=""/>:card.name[0]}</span><div><div className="eyebrow">GIVE A JOB</div><h2>What should {card.name} do?</h2></div><button type="button" className="close" onClick={()=>setJobs(null)} aria-label="Never mind">Later</button></div>
    {card.hunger<=25&&<p className="job-note"><Icon type="food" size={18}/> {card.name} is {card.hunger<=0?'starving and will work very slowly':'hungry and will work slower'}. A snack first helps!</p>}
    {jobs.todo.length>0&&<><small className="resident-job-group">From the to-do list</small><div className="resident-job-list">{jobs.todo.map(j=><button key={j.id} type="button" onClick={()=>give(j.task)}><Icon type={j.icon} size={34}/><span>{j.title}</span><small>{j.why}</small></button>)}</div></>}
    {jobs.more.length>0&&<><small className="resident-job-group">{jobs.todo.length?'Other jobs':'Jobs'}</small><div className="resident-job-list">{jobs.more.map(j=><button key={j.id} type="button" onClick={()=>give(j.task)}><Icon type={j.icon} size={34}/><span>{j.title}</span><small>{j.why}</small></button>)}</div></>}
    {!jobs.todo.length&&!jobs.more.length&&<p className="job-note">Nothing to do right now. Everyone can take a breather!</p>}
   </section>
  </div>}
  {card.actions&&<div className="resident-actions" style={{left:card.actions.x,top:card.actions.y}}>
   {work?<>
    {!work.helper&&<button type="button" className={`resident-action ${work.paused?'resume':'pause'}`} aria-label={work.paused?`${card.name} keep working`:`Pause ${card.name}`} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();const g=engine.current;if(work.paused)g?.autoWork?.resume();else g?.autoWork?.pause();}}>{work.paused?<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>}<span>{work.paused?'Go on':'Pause'}</span></button>}
    <button type="button" className="resident-action stop" aria-label={`Stop ${card.name}'s work`} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();const g=engine.current;if(work.helper)g?.residents?.stopJob(g.residents.menuActor());else g?.autoWork?.stop();g?.residents?.closeMenu();}}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/></svg><span>Stop</span></button>
    <button type="button" className={`resident-action task ${jobs?'open':''}`} aria-expanded={!!jobs} aria-label={`Give ${card.name} a different job`} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();openJobs();}}><Icon type="actions" size={22}/><span>New job</span></button>
    <button type="button" className="resident-action" aria-label={`Chat with ${card.name}`} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();engine.current?.residents?.talk();}}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg><span>Chat</span></button>
   </>:<>
    <button type="button" className={`resident-action task ${jobs?'open':''}`} aria-expanded={!!jobs} aria-label={`Give ${card.name} a job`} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();openJobs();}}><Icon type="actions" size={22}/><span>Task</span></button>
    <button type="button" className="resident-action" aria-label={`Chat with ${card.name}`} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();engine.current?.residents?.talk();}}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg><span>Chat</span></button>
    <button type="button" className={`resident-action eat ${card.food&&card.food.gain>0?'':'empty'} ${picking?'open':''}`} aria-expanded={picking} aria-label={card.food&&card.food.gain>0?`Choose something for ${card.name} to eat`:`Nothing to eat yet`} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();eat();}}><Icon type="food" size={22}/><span>Eat</span></button>
    {card.canPray&&<button type="button" className="resident-action pray" aria-label={`${card.name} says a prayer`} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();pray();}}><Icon type="pray" size={22}/><span>Pray</span></button>}
    {card.canSleep&&<button type="button" className="resident-action sleep" aria-label={`Send ${card.name} to sleep`} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();sleep();}}><Icon type="rest" size={22}/><span>Sleep</span></button>}
   </>}
  </div>}
 </>;
}

const clockText=sec=>sec==null?'':sec>=3600?`${Math.floor(sec/3600)}h ${Math.ceil((sec%3600)/60)}m`:sec>=60?`${Math.floor(sec/60)}m ${sec%60}s`:`${sec}s`;

/** Progress timers floating over every building site: percent, time left and who is on the job. */
export function BuildPeeks({engine,enabled}){
 const [sites,setSites]=useState([]);
 useEffect(()=>{
  if(!enabled){setSites([]);return;}
  let frame,last=0;const update=now=>{if(now-last>120){last=now;setSites(engine.current?.buildPeekSnapshot?.()||[]);}frame=requestAnimationFrame(update);};
  frame=requestAnimationFrame(update);return()=>cancelAnimationFrame(frame);
 },[engine,enabled]);
 // Compact by default: just a progress bar over the site. Tap it to open the details (time left, crew, hunger note).
 const [open,setOpen]=useState(null);
 useEffect(()=>{if(open&&!sites.some(b=>b.id===open))setOpen(null);},[sites,open]);
 if(!enabled||!sites.length)return null;
 return <>{sites.map(b=>{const expanded=open===b.id,status=b.blocked?b.blocked:b.paused?'Paused':b.queued?'Builders are on their way':b.seconds!=null?`About ${clockText(b.seconds)} left`:'Building';
  return <button key={b.id} type="button" className={`build-peek ${expanded?'open':'compact'} ${b.paused||b.blocked?'paused':''} ${b.slow?'slow':''}`} style={{left:b.x,top:b.y}} onClick={()=>setOpen(expanded?null:b.id)} aria-expanded={expanded} aria-label={`${b.name} ${b.percent}% built. ${status}. ${expanded?'Hide':'Show'} details`}>
   {expanded&&<div className="plant-peek-head"><Icon type="build" size={26}/><div><strong>{b.name}</strong><small>{status}</small></div><b>{b.percent}%</b></div>}
   <div className="plant-peek-track"><i style={{width:`${b.percent}%`}}/>{!expanded&&<b className="build-peek-pct">{b.percent}%</b>}</div>
   {expanded&&b.builders.length>0&&<div className="build-peek-crew">{b.builders.map(w=><span key={w.id} className={`crew-${w.phase} ${w.rate<1?'hungry':''}`} title={w.note}>{w.you?'You':w.name}<small>{w.phase==='building'?(w.note||'building'):w.phase}</small></span>)}</div>}
   {expanded&&b.slow&&!b.paused&&<small className="plant-peek-note">Hungry builders work slower · a snack speeds things up</small>}
  </button>;})}</>;
}

/** Floating growth meter shown for ~2 seconds after tapping a planted spot. */
export function PlantPeek({engine,enabled}){
 const [peek,setPeek]=useState(null);
 useEffect(()=>{
  if(!enabled){setPeek(null);return;}
  let frame;const update=()=>{const g=engine.current;setPeek(g?.plantPeekSnapshot?.()||g?.grillPeekSnapshot?.()||null);frame=requestAnimationFrame(update);};
  frame=requestAnimationFrame(update);return()=>cancelAnimationFrame(frame);
 },[engine,enabled]);
 if(!enabled||!peek)return null;
 return <div className={`plant-peek ${peek.cook?'cook':''} ${peek.ready?'ready':peek.thirsty?'thirsty':''}`} style={{left:peek.x,top:peek.y,opacity:peek.opacity}} role="status" aria-live="polite">
  <div className="plant-peek-head"><ItemIcon id={peek.plant} size={26}/><div><strong>{peek.name}</strong><small>{peek.stage}{peek.thirsty&&!peek.ready?' · needs water':''}</small></div><b>{peek.percent}%</b></div>
  <div className="plant-peek-track"><i style={{width:`${peek.percent}%`}}/></div>
  {peek.cook&&<small className="plant-peek-note">{peek.seconds>0?`Ready in ${peek.seconds}s`:'Done!'}</small>}
  {peek.remaining&&!peek.thirsty&&<small className="plant-peek-note">Ready in about {peek.remaining}</small>}
  {peek.thirsty&&!peek.ready&&<small className="plant-peek-note">Growth paused until it is watered</small>}
 </div>;
}

/** Sweat beads and a red "-N" that pop beside the character whenever energy is spent. */
export function EnergyFx({engine,enabled}){
 const [fx,setFx]=useState([]);
 useEffect(()=>{
  if(!enabled){setFx([]);return;}
  let frame;const update=()=>{setFx(engine.current?.energyFxSnapshot?.()||[]);frame=requestAnimationFrame(update);};
  frame=requestAnimationFrame(update);return()=>cancelAnimationFrame(frame);
 },[engine,enabled]);
 if(!enabled||!fx.length)return null;
 return fx.map(f=>{
  const rise=f.t*46,fade=f.t<.15?f.t/.15:f.t>.6?Math.max(0,1-(f.t-.6)/.4):1;
  return <div key={f.id} className="energy-fx" style={{left:f.x,top:f.y-rise,opacity:fade}} aria-hidden="true">
   <b className="energy-fx-num" style={{transform:`translate(${f.side*22}px,0) scale(${f.t<.2?.6+f.t*2.5:1.1})`}}>-{f.delta}</b>
   <span className="energy-fx-sweat">{[0,1,2].map(i=><i key={i} style={{'--d':`${i*.08}s`,'--ox':`${(i-1)*14+f.side*-8}px`,'--oy':`${-4+(i%2)*8}px`}}/>)}</span>
  </div>;
 });
}
export function CharacterVitals({engine,enabled,onInspect}){
 const [hud,setHud]=useState([]);
 useEffect(()=>{
  if(!enabled){setHud([]);return;}
  let frame,last=0;
  const update=time=>{if(time-last>=33){setHud(engine.current?.allCharacterVitalsSnapshots()||[]);last=time;}frame=requestAnimationFrame(update);};
  frame=requestAnimationFrame(update);return()=>cancelAnimationFrame(frame);
 },[engine,enabled]);
 if(!enabled)return null;
 return hud.map(h=><CharacterLevel key={h.id} hud={h} engine={engine} onInspect={onInspect}/>);
}
function CharacterLevel({hud,engine,onInspect}){
 const reveal=()=>{if(engine.current?.revealCharacterVitals(Date.now(),hud.id))onInspect?.();};
 const choose=()=>{const g=engine.current;if(hud.selected)reveal();else if(g?.selectCharacter(hud.id))onInspect?.();};
 const begin=e=>{
  if(e.button!==0)return;e.preventDefault();e.stopPropagation();
  const g=engine.current;g.renderer.domElement.focus({preventScroll:true});g.mapGesture.begin(e.nativeEvent,choose);
 };
 return <>
  <button className="character-tap-target" style={{left:hud.hit.x,top:hud.hit.y,width:hud.hit.width,height:hud.hit.height}} aria-label={`${hud.selected?'Playing as':'Select'} ${hud.name}. Energy ${hud.energy} of 100. Show energy`} aria-expanded={hud.visible} aria-controls={hud.visible?`character-vitals-${hud.id}`:undefined} onPointerDown={begin} onClick={e=>{e.stopPropagation();if(e.detail===0)choose();}} onFocus={reveal}/>
  {hud.visible&&<aside id={`character-vitals-${hud.id}`} className={`character-vitals ${hud.pinned?'levels-low':''}`} style={{left:hud.screen.x,top:hud.screen.y,opacity:hud.opacity}} aria-label={`${hud.name} levels`}>
   <strong className="vitals-name">{hud.name}{hud.selected?' · Playing':''}</strong>
   {[{label:'Energy',value:hud.energy,icon:'energy',low:hud.lowEnergy,kind:'energy'}].map(v=><div className={`character-level ${v.kind} ${v.low?'level-low':''}`} key={v.kind}><div className="character-level-label"><span><Icon type={v.icon} size={15}/>{v.label}</span><b>{v.value}<small>%</small></b></div><div className="character-level-track" role="progressbar" aria-label={`${hud.name} ${v.label}`} aria-valuenow={v.value} aria-valuemin="0" aria-valuemax="100"><i style={{width:`${v.value}%`}}/></div></div>)}

  </aside>}
 </>;
}
