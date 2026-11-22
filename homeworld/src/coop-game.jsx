import React,{useEffect,useRef,useState} from 'react';
import {useDialogFocus} from './ui.jsx';
import './coop-game.css';
import {CoopHens3D} from './coop-hens-3d.js';
function Hen({id='coop-welcome'}){return <div className="coop-hen-slot" data-coop-hen={id} aria-hidden="true"/>;}
function HensCanvas({rootRef,game,ids,rendererRef}){
 const canvas=useRef(null),[unavailable,setUnavailable]=useState(false);
 useEffect(()=>{let renderer;try{renderer=new CoopHens3D(rootRef.current,canvas.current,game);rendererRef.current=renderer;}catch{setUnavailable(true);}return()=>{renderer?.dispose();if(rendererRef.current===renderer)rendererRef.current=null;};},[game,ids]);
 return <><canvas ref={canvas} className="coop-hens-canvas" aria-hidden="true"/>{unavailable&&<p className="coop-model-note">Your eggs are ready to collect below.</p>}</>;
}
export function CoopGame({farm,game,onCollect,onClose,onBuy}){
 const dialog=useRef(null),hensRenderer=useRef(null),[pops,setPops]=useState([]),[notice,setNotice]=useState(''),[gathered,setGathered]=useState(0),inFlight=useRef(new Set());
 const hens=farm.animals.filter(a=>a.kind==='chicken'),ready=hens.reduce((n,a)=>n+a.ready,0);
 useDialogFocus(true,dialog,onClose);
 useEffect(()=>{if(!pops.length)return;const t=setTimeout(()=>setPops([]),900);return()=>clearTimeout(t);},[pops]);
 const take=(a,slot)=>{const id=`${a.id}:${slot}`;if(inFlight.current.has(id))return;inFlight.current.add(id);try{if(onCollect(a.id,slot)){hensRenderer.current?.react(a.id);setPops(p=>[...p,{id,hen:a.id,slot}]);setGathered(n=>n+1);setNotice('An egg in your basket!');}else setNotice('That egg could not be saved. Please try again.');}finally{inFlight.current.delete(id);}};
 return <section className="coop-game" role="dialog" aria-modal="true" aria-labelledby="coop-title" tabIndex={-1} ref={dialog}>
  <div className="coop-sunbeam" aria-hidden="true"/><div className="coop-window" aria-hidden="true"><i/><b>☀</b><span>🌿</span></div>
  <header className="coop-header"><button onClick={onClose} aria-label="Leave chicken coop">← Outside</button><div><span>OUR LITTLE FARM</span><h1 id="coop-title">The chicken coop</h1></div><div className="coop-ready" aria-label={`${ready} eggs ready`}>🥚 <b>{ready}</b></div></header>
  <div className="coop-sign"><span aria-hidden="true">✦</span> {ready?'Tap the eggs. Into the basket!':hens.length?'Happy hens, fresh eggs soon.':'A cozy home for your first chicken.'} <span aria-hidden="true">✦</span></div>
  <div className={`coop-nests ${hens.length>3?'coop-nests-large':''}`}>
   {hens.map((a,i)=><div className="coop-nest" key={a.id}><div className="coop-nest-plaque">{a.name==='Chicken'?`Hen ${i+1}`:a.name}</div><div className="coop-hay" aria-hidden="true"/><Hen id={a.id}/><div className="coop-egg-row">{[0,1,2].map(slot=>a.eggSlots.includes(slot)?<button key={slot} className="coop-egg" aria-label={`Collect egg ${slot+1} from hen ${i+1}`} onClick={()=>take(a,slot)}><svg viewBox="0 0 60 80" aria-hidden="true"><defs><radialGradient id={`egg-${i}-${slot}`} cx="30%" cy="25%" r="75%"><stop stopColor="#fffdf0"/><stop offset="1" stopColor="#ddc9a2"/></radialGradient></defs><path d="M30 4C16 4 5 37 5 52a25 24 0 0 0 50 0C55 37 44 4 30 4Z" fill={`url(#egg-${i}-${slot})`} stroke="#a47e4c" strokeWidth="2"/><ellipse cx="20" cy="29" rx="5" ry="11" fill="white" opacity=".65"/></svg><i aria-hidden="true">✦</i></button>:<span key={slot} className="coop-empty-slot" aria-hidden="true"/> )}</div>{pops.filter(p=>p.hen===a.id).map(p=><div key={p.id} className="coop-egg-pop" aria-hidden="true">🥚<b>+1</b><span>✦</span></div>)}<small className="coop-hen-status">{a.ready?'Fresh eggs for you':`Next egg in ${Math.max(1,Math.ceil(a.seconds/60))} min`}</small></div>)}
   {!hens.length&&<div className="coop-empty"><Hen/><p>Your hens will lay their eggs here.</p><button onClick={onBuy}>Welcome a chicken →</button></div>}
  </div>
  <HensCanvas rootRef={dialog} game={game} ids={hens.map(a=>a.id).join('|')} rendererRef={hensRenderer}/>
  <footer className="coop-basket"><span className="coop-basket-art" aria-hidden="true">🧺</span><div><strong>My egg basket</strong><span>{farm.bag.egg} eggs in your bag</span></div><b aria-label={`${gathered} eggs collected this visit`}>+{gathered}</b></footer>
  <p className="coop-live" role="status" aria-live="polite">{farm.error||notice}</p>
 </section>;
}
