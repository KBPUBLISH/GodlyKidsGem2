import React,{useEffect,useRef,useState} from 'react';
import {COOKING_RECIPES,cookingRecipe,cookingCount,canStartCooking} from './cooking.mjs';
import {stirDelta,sliced,dropped} from './cooking-gestures.mjs';
import {CookingArt} from './cooking-art.jsx';
import {CookingScene} from './cooking-scene.js';
import {ItemIcon,useDialogFocus} from './ui.jsx';
import {mealGain} from './nutrition.mjs';
import {gameTime} from './core.mjs';
import './cooking-game.css';

function PrepScene({recipe,action,progress}){
 const canvas=useRef(null),scene=useRef(null),[fallback,setFallback]=useState(false);
 useEffect(()=>{try{scene.current=new CookingScene(canvas.current);scene.current.set(recipe,action,progress);}catch{setFallback(true);}return()=>{scene.current?.dispose();scene.current=null;};},[]);
 useEffect(()=>{scene.current?.set(recipe,action,progress);},[recipe,action,progress]);
 return <><canvas ref={canvas} className="cooking-canvas" aria-hidden="true"/>{fallback&&<div className="cooking-fallback"><CookingArt id={recipe} size={200}/></div>}</>;
}
export function CookingGame({game,view,ovenId,onClose,onLegacy}){
 const dialog=useRef(null),gesture=useRef(null),working=useRef(false),audio=useRef(null),[progress,setProgress]=useState(0),[now,setNow]=useState(Date.now()),[notice,setNotice]=useState(''),[sharing,setSharing]=useState(false),[dragPoint,setDragPoint]=useState(null);
 const state=view.state,session=state.cooking?.session,recipe=cookingRecipe(session?.recipe),step=recipe?.steps[session?.step],phase=session?.phase;
 const done=phase==='collected',ready=phase==='cooking'&&now>=session.readyAt;
 const exit=()=>onClose();useDialogFocus(true,dialog,exit);
 useEffect(()=>{game.cookingOpen=true;game.keys?.clear();const handler=e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key))e.stopImmediatePropagation();};window.addEventListener('keydown',handler,true);return()=>{game.cookingOpen=false;window.removeEventListener('keydown',handler,true);};},[game]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),250);return()=>{clearInterval(timer);audio.current?.close().catch(()=>{});};},[]);
 useEffect(()=>{setProgress(0);gesture.current=null;setSharing(false);},[session?.id,session?.step,phase]);
 const transact=action=>{
  if(working.current)return false;working.current=true;
  try{const before=game.store.state;game.store.commit(action);game.notify();if(before===game.store.state){setNotice('Your progress changed. Please try again.');return false;}setNotice('');return true;}
  catch(error){setNotice(error.message||'Your last saved progress is safe. Try again.');game.notify();return false;}
  finally{working.current=false;}
 };
 const sound=()=>{if(game.music?.on===false)return;try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;audio.current??=new Audio();audio.current.resume().catch(()=>{});const o=audio.current.createOscillator(),g=audio.current.createGain(),t=audio.current.currentTime;o.type='sine';o.frequency.setValueAtTime(520,t);o.frequency.exponentialRampToValueAtTime(880,t+.1);g.gain.setValueAtTime(.025,t);g.gain.exponentialRampToValueAtTime(.001,t+.18);o.connect(g);g.connect(audio.current.destination);o.start(t);o.stop(t+.2);}catch{/* silent play remains available */}};
 const advance=(amount=1)=>{
  if(!step)return;const next=Math.min(step.count,progress+amount);sound();
  if(next>=step.count){if(transact({type:'cooking_step',sessionId:session.id,step:session.step}))setNotice({slice:'Lovely slicing!',prepare:'Ready for the oven!',crack:'Egg-cellent!',add:'Looking delicious!',stir:'Beautiful mixing!',bake:'Lovely! Let’s bake.'}[step.action]||'Well done!');}
  else setProgress(next);
 };
 const point=e=>{const r=e.currentTarget.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};};
 const down=e=>{if(!step||gesture.current)return;e.preventDefault();try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* Pointer capture is optional in embedded webviews. */}gesture.current={id:e.pointerId,start:point(e),last:point(e),angle:0};};
 const move=e=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;const p=point(e);if(['add','bake'].includes(step?.action)){setDragPoint(p);return;}if(step?.action!=='stir')return;g.angle+=stirDelta(g.last,p);g.last=p;setProgress(Math.min(.95,Math.abs(g.angle)/(Math.PI*2)));};
 const up=e=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;gesture.current=null;setDragPoint(null);const p=point(e),action=step?.action;
  if(action==='crack'||(action==='stir'&&Math.abs(g.angle)>=Math.PI*1.8)||(['slice','prepare','shape'].includes(action)&&sliced(g.start,p))||(['add','bake'].includes(action)&&dropped(g.start,p)))advance(action==='stir'?1:1);
  else if(action==='stir')setProgress(0);
 };
 const currentId=session?.id;
 const friendIds=new Set((view.livingTest?.friends||view.friends||[]).map(f=>f.id));
 const recipients=Object.entries(state.characters||{}).filter(([id])=>id!==state.activeCharacter&&friendIds.has(id));
 const eat=()=>{if(transact({type:'eat',item:recipe.meal,mealSession:session.id,actionId:crypto.randomUUID()})){setNotice('Yum! Energy for more adventures.');sound();}};
 return <div className="cooking-backdrop" onPointerDown={e=>e.stopPropagation()}>
 <section className="cooking-game" role="dialog" aria-modal="true" aria-labelledby="cooking-title" ref={dialog} tabIndex={-1}>
  <header className="cooking-header"><div><span>ISLAND KITCHEN</span><h1 id="cooking-title">{recipe?recipe.name:'What shall we cook?'}</h1></div><button onClick={exit} aria-label="Back to island">✕</button></header>
  {!session?<>
   <p className="cooking-intro">From your garden. Made by you.</p>
   <div className="cooking-recipes">{COOKING_RECIPES.map(r=>{const available=canStartCooking(state,r,ovenId);return <article key={r.id} className="cooking-recipe"><CookingArt id={r.id} size={110}/><h2>{r.name}</h2><div className="cooking-ingredients">{Object.entries(r.ingredients).map(([id,n])=><span key={id} className={cookingCount(state,id)>=n?'have':'need'}><ItemIcon id={id} size={24}/>{id.replaceAll('_',' ')} <b>{cookingCount(state,id)}/{n}</b></span>)}</div><button className="cooking-gold" disabled={!available} onClick={()=>{if(transact({type:'cooking_start',recipe:r.id,ovenId,sequence:state.cooking?.sequence||0}))sound();}}>{available?'Let’s cook!':'Gather first'}</button></article>;})}</div>
   <p className="cooking-gather">🥕 Grow vegetables · 🥚 Collect eggs · 🐟 Catch fish</p>
   {cookingCount(state,'potato')<2&&<p className="cooking-gather">Potato seeds: Market → Seeds</p>}
   <button className="cooking-link" onClick={onLegacy}>Manna & oven fire →</button>
  </>:<>
   <div className="cooking-steps" aria-label={`Step ${Math.min(session.step+1,3)} of 3`}>{recipe.steps.map((s,i)=><span key={i} className={session.step>i?'complete':session.step===i?'active':''}>{session.step>i?'✓':i+1}<small>{s.station==='prep'?'Prepare':s.station==='pot'?'Mix':'Bake'}</small></span>)}</div>
   <div className="cooking-workspace">
    <PrepScene recipe={recipe.id} action={done?'collected':phase==='cooking'?'cooking':step?.action} progress={progress}/>
    {step&&<div className={`cooking-gesture gesture-${step.action}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{gesture.current=null;setDragPoint(null);setProgress(0);}} role="group" aria-label={step.prompt}>
     <div className="cooking-demonstration" aria-hidden="true">{step.action==='stir'?'⟳':['add','bake'].includes(step.action)?'↑':step.action==='crack'?'☝':'↔'}</div>
     {dragPoint&&<span className="cooking-ingredient-ghost" style={{left:`${dragPoint.x*100}%`,top:`${dragPoint.y*100}%`}}><CookingArt id={recipe.id} size={80}/></span>}
     {['add','bake'].includes(step.action)&&<><span className="cooking-drop">{step.action==='bake'?'Oven':'Here'}</span><span className="cooking-drag">Drag from here ↑</span></>}
    </div>}
    {phase==='cooking'&&<div className="cooking-baking"><span aria-hidden="true">✦</span><strong>{ready?'Ready to enjoy!':'Cooking something lovely…'}</strong><progress max={session.seconds} value={Math.max(0,session.seconds-(session.readyAt-now)/1000)}/>{!ready&&<small>{Math.max(1,Math.ceil((session.readyAt-now)/1000))} seconds · no need to hurry</small>}</div>}
    {done&&<div className="cooking-finished"><CookingArt id={recipe.id} size={130}/><strong>You made it!</strong><span>Saved in My bag · +{recipe.energy} energy</span></div>}
   </div>
   {step&&<div className="cooking-action"><h2>{step.prompt}</h2><div className="cooking-progress" aria-label={`${Math.round(progress/step.count*100)} percent`}>{Array.from({length:step.action==='stir'?4:step.count},(_,i)=><i key={i} className={i<(step.action==='stir'?progress*4:progress)?'done':''}/>)}</div><button className="cooking-link" onClick={()=>advance()}>{step.action==='stir'?'Or tap to stir':step.action==='crack'?'Crack an egg':step.action==='add'?'Or tap to pour':step.action==='bake'?'Or tap to slide':'Or tap to slice'}</button></div>}
   {ready&&<button className="cooking-gold cooking-collect" onClick={()=>{if(transact({type:'cooking_collect',sessionId:currentId}))sound();}}>Collect my meal ✦</button>}
   {done&&<div className="cooking-reward"><div><button className="cooking-gold" disabled={session.used||!(state.inventory[recipe.meal]>0)||mealGain(state,recipe.meal,gameTime(state)).total<=0||view.busy} onClick={eat}>Eat</button><button disabled={session.used||!(state.inventory[recipe.meal]>0)||!recipients.length} onClick={()=>setSharing(!sharing)}>Share</button><button onClick={()=>transact({type:'cooking_done',sessionId:currentId})}>Cook again</button></div>{mealGain(state,recipe.meal,gameTime(state)).total<=0&&<small>Your tummy is full. Save your meal for later.</small>}{sharing&&<div className="cooking-share">{recipients.map(([id,c])=><button key={id} disabled={mealGain(state,recipe.meal,gameTime(state),id).total<=0} onClick={()=>{if(transact({type:'share_food',item:recipe.meal,recipient:id,mealSession:session.id,actionId:crypto.randomUUID()})){setSharing(false);setNotice(`A lovely meal for ${c.name||id}!`);sound();}}}>{c.name||id}</button>)}</div>}</div>}
   {!done&&<footer className="cooking-footer"><span>✓ Your progress is saved</span><button onClick={()=>{if(transact({type:'cooking_cancel',sessionId:currentId}))setNotice('Ingredients returned to your bag.');}}>Cancel & keep ingredients</button></footer>}
  </>}
  <p className="cooking-notice" role="status" aria-live="polite">{notice}</p>
 </section></div>;
}
