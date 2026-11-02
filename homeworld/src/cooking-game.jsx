import {CookingBoard} from './cooking-board.jsx';
import React,{useEffect,useRef,useState} from 'react';
import {COOKING_RECIPES,cookingRecipe,cookingCount,canStartCooking} from './cooking.mjs';
import {stirDelta,sliced,dropped,chopCrossed} from './cooking-gestures.mjs';
import {CookingArt} from './cooking-art.jsx';
import {KitchenRoom} from './kitchen-room.jsx';
import {KITCHEN_STATIONS,kitchenNextStation,kitchenCanWork} from './kitchen-navigation.mjs';
import {ItemIcon,useDialogFocus} from './ui.jsx';
import {mealGain} from './nutrition.mjs';
import {gameTime} from './core.mjs';
import './cooking-game.css';

export function CookingGame({game,view,ovenId,onClose,onLegacy}){
 const dialog=useRef(null),panel=useRef(null),gesture=useRef(null),working=useRef(false),audio=useRef(null),[progress,setProgress]=useState(0),[now,setNow]=useState(Date.now()),[notice,setNotice]=useState(''),[sharing,setSharing]=useState(false),[dragPoint,setDragPoint]=useState(null),[pantryRecipe,setPantryRecipe]=useState(null),[station,setStation]=useState('pantry'),[moving,setMoving]=useState(false),[travel,setTravel]=useState(null);
 const state=view.state,session=state.cooking?.session,recipe=cookingRecipe(session?.recipe),step=recipe?.steps[session?.step],phase=session?.phase;
 const done=phase==='collected',ready=phase==='cooking'&&now>=session.readyAt;
 const nextStation=kitchenNextStation(session,recipe,ready),atStation=kitchenCanWork(station,moving,session,recipe,ready),nextPlace=KITCHEN_STATIONS.find(s=>s.id===nextStation);
 const walkTo=id=>{if((!moving&&station===id)||(moving&&travel?.id===id))return;gesture.current=null;setDragPoint(null);if(step?.action==='stir')setProgress(0);setMoving(true);setStation(null);setTravel({id});};
 const exit=()=>onClose();useDialogFocus(true,dialog,exit);
 useEffect(()=>{game.cookingOpen=true;game.keys?.clear();const handler=e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key))e.stopImmediatePropagation();};window.addEventListener('keydown',handler,true);return()=>{game.cookingOpen=false;window.removeEventListener('keydown',handler,true);};},[game]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),250);return()=>{clearInterval(timer);audio.current?.close().catch(()=>{});};},[]);
 useEffect(()=>{setProgress(0);gesture.current=null;setSharing(false);},[session?.id,session?.step,phase]);
 useEffect(()=>{if(panel.current)panel.current.scrollTop=0;},[session?.id,session?.step,phase,atStation]);
 const transact=action=>{
  if(working.current)return false;working.current=true;
  try{const before=game.store.state;game.store.commit(action);game.notify();if(before===game.store.state){setNotice('Your progress changed. Please try again.');return false;}setNotice('');return true;}
  catch(error){setNotice(error.message||'Your last saved progress is safe. Try again.');game.notify();return false;}
  finally{working.current=false;}
 };
 const sound=()=>{if(game.music?.on===false)return;try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;audio.current??=new Audio();audio.current.resume().catch(()=>{});const o=audio.current.createOscillator(),g=audio.current.createGain(),t=audio.current.currentTime;o.type='sine';o.frequency.setValueAtTime(520,t);o.frequency.exponentialRampToValueAtTime(880,t+.1);g.gain.setValueAtTime(.025,t);g.gain.exponentialRampToValueAtTime(.001,t+.18);o.connect(g);g.connect(audio.current.destination);o.start(t);o.stop(t+.2);}catch{/* silent play remains available */}};
 const advance=(amount=1)=>{
  if(!step||!atStation)return;const next=Math.min(step.count,progress+amount);sound();
  if(next>=step.count){if(transact({type:'cooking_step',sessionId:session.id,step:session.step}))setNotice({slice:'Lovely slicing!',prepare:'Ready for the oven!',crack:'Egg-cellent!',add:'Looking delicious!',stir:'Beautiful mixing!',bake:'Lovely! Let’s bake.'}[step.action]||'Well done!');}
  else {setProgress(next);setNotice(step.action==='slice'?`Crunch! ${next} of ${step.count} cuts.`:'Nice work!');}
 };
 const point=e=>{const r=e.currentTarget.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};};
 const down=e=>{if(!step||!atStation||gesture.current)return;e.preventDefault();try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* Pointer capture is optional in embedded webviews. */}setDragPoint(point(e));gesture.current={id:e.pointerId,start:point(e),last:point(e),angle:0};};
 const move=e=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;const p=point(e);if(['slice','prepare','add','bake'].includes(step?.action)){setDragPoint(p);return;}if(step?.action!=='stir')return;g.angle+=stirDelta(g.last,p);g.last=p;setProgress(Math.min(.95,Math.abs(g.angle)/(Math.PI*2)));};
 const up=e=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;gesture.current=null;setDragPoint(null);const p=point(e),action=step?.action;
  if(action==='crack'||(action==='stir'&&Math.abs(g.angle)>=Math.PI*1.8)||(action==='slice'&&chopCrossed(g.start,p,progress))||(['prepare','shape'].includes(action)&&sliced(g.start,p))||(['add','bake'].includes(action)&&dropped(g.start,p)))advance(action==='stir'?1:1);
  else if(action==='stir'){setProgress(0);setNotice('Draw one big circle around the bowl.');}else if(action==='slice')setNotice('Start above the glowing line and slide down through the food.');
 };
 const currentId=session?.id;
 const friendIds=new Set((view.livingTest?.friends||view.friends||[]).map(f=>f.id));
 const recipients=Object.entries(state.characters||{}).filter(([id])=>id!==state.activeCharacter&&friendIds.has(id));
 const eat=()=>{if(transact({type:'eat',item:recipe.meal,mealSession:session.id,actionId:crypto.randomUUID()})){setNotice('Yum! Energy for more adventures.');sound();}};
 return <div className="cooking-backdrop kitchen-fullscreen" onPointerDown={e=>e.stopPropagation()}>
 <section className="cooking-game" role="dialog" aria-modal="true" aria-labelledby="cooking-title" ref={dialog} tabIndex={-1}>
  <header className="cooking-header"><div><span>MY ISLAND KITCHEN · NO RUSH</span><h1 id="cooking-title">{recipe?recipe.name:'Hello, little chef!'}</h1></div><div className="kitchen-header-actions"><span className="kitchen-save-note">{session?'✓ Completed steps saved':'From your garden. Made by you.'}</span><button onClick={exit} aria-label="Back to island">✕</button></div></header>
  <div className="kitchen-play">
   <KitchenRoom game={game} next={nextStation} station={station} moving={moving} travel={travel} onTravel={walkTo} onArrive={id=>{setStation(id);setMoving(false);}} carrying={!!session&&!done} working={!!step&&atStation} done={done} counts={Object.fromEntries(['pumpkin','carrot','egg','fish','potato'].map(id=>[id,cookingCount(state,id)]))} action={step?.action} progress={progress}/>
   <aside className="kitchen-panel" aria-label="Recipe and station activities" ref={panel}>
    <div className="kitchen-next"><span>{done?'✦ Made with love':!session?'LET’S MAKE SOMETHING':`YOUR RECIPE · ${phase==='prep'?`STEP ${session.step+1} OF ${recipe.steps.length}`:ready?'READY TO SERVE':'NEARLY THERE'}`}</span><h2 aria-live="polite">{moving?'On my way!':!atStation?`Next stop: ${nextPlace.name}`:done?'You made it!':ready?'Let’s serve it!':!session?'Pick something delicious':phase==='cooking'?'Smells delicious…':step.prompt}</h2>{!atStation&&<button className="cooking-gold" onClick={()=>walkTo(nextStation)}>{moving&&travel?.id===nextStation?'Walking…':`Go to ${nextPlace.name} →`}</button>}</div>
    {session&&<div className="cooking-steps" aria-label="Recipe progress">{recipe.steps.map((s,i)=><span key={i} className={session.step>i?'complete':session.step===i?'active':''}>{session.step>i?'✓':i+1}<small>{s.station==='prep'?'Prep':s.station==='pot'?'Mix':'Bake'}</small></span>)}<span className={done?'complete':ready?'active':''}>{done?'✓':'☆'}<small>Serve</small></span></div>}
    {(!session||station==='pantry')&&<aside className="cooking-pantry" aria-label="My pantry"><h2>My pantry <small>Fresh from your island</small></h2><div>{[...new Set(COOKING_RECIPES.flatMap(r=>Object.keys(r.ingredients)))].map(id=>{const count=cookingCount(state,id),wanted=cookingRecipe(session?.recipe||pantryRecipe)?.ingredients[id];return <div key={id} className={`pantry-jar ${count?'stocked':'empty'} ${wanted?'wanted':''}`}><ItemIcon id={id} size={32}/><span>{id}</span><b>{count}</b></div>;})}</div></aside>}
    {!session&&atStation&&<>
     <div className="cooking-recipes">{COOKING_RECIPES.map(r=>{const available=canStartCooking(state,r,ovenId);return <article key={r.id} className={`cooking-recipe ${available?'recipe-ready':'recipe-missing'}`} onMouseEnter={()=>setPantryRecipe(r.id)} onFocus={()=>setPantryRecipe(r.id)}><span className="recipe-state">{available?'✦ Ready to cook!':'Missing ingredients'}</span><CookingArt id={r.id} size={84}/><h2>{r.name}</h2><div className="cooking-ingredients">{Object.entries(r.ingredients).map(([id,n])=><span key={id} className={cookingCount(state,id)>=n?'have':'need'}><ItemIcon id={id} size={22}/>{id.replaceAll('_',' ')} <b>{cookingCount(state,id)}/{n}</b></span>)}</div><button className="cooking-gold" disabled={!available} onClick={()=>{if(transact({type:'cooking_start',recipe:r.id,ovenId,sequence:state.cooking?.sequence||0}))sound();}}>{available?'Let’s cook!':'Gather first'}</button></article>;})}</div>
     <p className="cooking-gather">🥕 Grow vegetables · 🥚 Collect eggs · 🐟 Catch fish</p>
     {cookingCount(state,'potato')<2&&<p className="cooking-gather">Potato seeds: Market → Seeds</p>}
     <button className="cooking-link" onClick={onLegacy}>Manna & oven fire →</button>
    </>}
    {session&&<>
     {step&&atStation&&<>
      <div className="cooking-workspace kitchen-workbench">
       <svg viewBox="0 0 400 280" className="kitchen-bench-art" aria-hidden="true"><rect width="400" height="280" rx="20" fill="#d5a569"/><path d="M0 75H400M0 145H400M0 215H400" stroke="#bb8b55" strokeWidth="3"/>
        {['add','stir','crack'].includes(step.action)?<g><ellipse cx="200" cy="206" rx="120" ry="22" fill="#795c3d" opacity=".2"/><path d="M90 110Q95 228 200 228Q305 228 310 110" fill="#739d91" stroke="#456f65" strokeWidth="6"/><ellipse cx="200" cy="110" rx="110" ry="42" fill="#f0bd62" stroke="#b1d0b3" strokeWidth="10"/>{[0,1,2,3,4].map(i=><circle key={i} cx={135+i*30} cy={105+Math.sin(i*2)*13} r="10" fill={i%2?'#e58b3f':'#88a65b'}/>)}<g transform={`rotate(${step.action==='stir'?progress*360:25} 200 110)`}><path d="M200 110L200 35" stroke="#865c36" strokeWidth="14" strokeLinecap="round"/><ellipse cx="200" cy="112" rx="16" ry="23" fill="#a87944"/></g>{step.action==='crack'&&[0,1].map(i=><ellipse key={i} cx={140+i*120} cy="55" rx="22" ry="29" fill={i<progress?'#f5c14c':'#fff4d9'} stroke="#c5a875" strokeWidth="3"/>)}</g>:<g><rect x="65" y="65" width="270" height="155" rx="20" fill="#65867e" stroke="#b7c9b4" strokeWidth="8"/><ellipse cx="170" cy="135" rx="67" ry="30" fill="#e5ab62"/>{[0,1,2,3].map(i=><rect key={i} x={245+i*13} y="95" width="9" height="85" rx="4" fill="#f4ce7b"/>)}</g>}
       </svg>
       <div className={`cooking-gesture gesture-${step.action}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{gesture.current=null;setDragPoint(null);if(step.action==='stir')setProgress(0);}} role="group" aria-label={step.prompt}>
        {step.action==='slice'&&<CookingBoard recipe={recipe.id} progress={progress} point={dragPoint}/>}
        <div className="cooking-demonstration" aria-hidden="true">{step.action==='stir'?'⟳':['add','bake'].includes(step.action)?'↑':step.action==='crack'?'☝':'↔'}</div>
        {dragPoint&&['add','bake'].includes(step.action)&&<span className="cooking-ingredient-ghost" style={{left:`${dragPoint.x*100}%`,top:`${dragPoint.y*100}%`}}><CookingArt id={recipe.id} size={70}/></span>}
        {['add','bake'].includes(step.action)&&<><span className="cooking-drop">{step.action==='bake'?'Oven':'Here'}</span><span className="cooking-drag">Drag from here ↑</span></>}
       </div>
      </div>
      <div className="cooking-action"><div className="cooking-progress" aria-label={`${Math.round(progress/step.count*100)} percent`}>{Array.from({length:step.action==='stir'?4:step.count},(_,i)=><i key={i} className={i<(step.action==='stir'?progress*4:progress)?'done':''}/>)}</div><button className="kitchen-easy-action" onClick={()=>advance()}>{step.action==='stir'?'Tap to stir':step.action==='crack'?'Crack an egg':step.action==='add'?'Tap to pour':step.action==='bake'?'Slide into oven':step.action==='prepare'?'Prepare the fish':'Tap to chop'}</button></div>
     </>}
     {step&&!atStation&&<div className="kitchen-recipe-card"><CookingArt id={recipe.id} size={130}/><p>{moving?'Your ingredients are coming with you.':`Tap ${nextPlace.name} in the kitchen to keep cooking.`}</p><small>One little step at a time. You’ve got this!</small></div>}
     {phase==='cooking'&&<div className="kitchen-simmer"><CookingArt id={recipe.id} size={110}/><strong>{ready?'Ready for the serving counter!':'A little simmer. A lot of yum.'}</strong><progress max={session.seconds} value={Math.max(0,session.seconds-(session.readyAt-now)/1000)}/><small>{ready?'No rush. Your food stays lovely and warm.':'Explore your kitchen while it cooks. Nothing burns!'}</small></div>}
     {ready&&atStation&&<button className="cooking-gold cooking-collect" onClick={()=>{if(atStation&&transact({type:'cooking_collect',sessionId:currentId}))sound();}}>Serve my meal ✦</button>}
     {done&&<div className="kitchen-recipe-card"><CookingArt id={recipe.id} size={130}/><strong>{session.used?'A lovely meal, made by you!':'Ready to enjoy or share'}</strong><p>{session.used?'Cook something else for your next adventure.':`Saved in My bag · +${recipe.energy} energy`}</p></div>}
     {done&&atStation&&<div className="cooking-reward"><div><button className="cooking-gold" disabled={session.used||!(state.inventory[recipe.meal]>0)||mealGain(state,recipe.meal,gameTime(state)).total<=0||view.busy} onClick={eat}>Eat</button><button disabled={session.used||!(state.inventory[recipe.meal]>0)||!recipients.length} onClick={()=>setSharing(!sharing)}>Share</button><button onClick={()=>transact({type:'cooking_done',sessionId:currentId})}>Cook again</button></div>{mealGain(state,recipe.meal,gameTime(state)).total<=0&&<small>Your tummy is full. Save your meal for later.</small>}{sharing&&<div className="cooking-share">{recipients.map(([id,c])=><button key={id} disabled={mealGain(state,recipe.meal,gameTime(state),id).total<=0} onClick={()=>{if(transact({type:'share_food',item:recipe.meal,recipient:id,mealSession:session.id,actionId:crypto.randomUUID()})){setSharing(false);setNotice(`A lovely meal for ${c.name||id}!`);sound();}}}>{c.name||id}</button>)}</div>}</div>}
     {!done&&<footer className="cooking-footer"><button onClick={()=>{if(transact({type:'cooking_cancel',sessionId:currentId}))setNotice('Ingredients returned to your bag.');}}>Cancel & keep ingredients</button></footer>}
    </>}
    <p className="cooking-notice" role="status" aria-live="polite">{notice}</p>
   </aside>
  </div>
 </section></div>;
}
