import React,{useEffect,useRef,useState} from 'react';
import {useDialogFocus} from './ui.jsx';
import './coop-game.css';
function Hen({index=0}){
 return <svg className="coop-hen" viewBox="0 0 200 180" aria-hidden="true" style={{'--hen-delay':`${index*-.9}s`}}><ellipse cx="100" cy="158" rx="63" ry="10" fill="#6f452b" opacity=".18"/><path d="M72 143v18m46-18v18m-52 0h20m23 0h19" stroke="#c88a2d" strokeWidth="7" strokeLinecap="round"/><path d="M49 116C18 92 16 65 33 65c11 0 11 17 23 22-14-31 1-48 15-27l17 32" fill="#edce94" stroke="#b88a50" strokeWidth="3"/><ellipse cx="100" cy="113" rx="60" ry="40" fill={index%2?'#d8a363':'#fff1ca'} stroke="#bd945c" strokeWidth="3"/><path d="M68 111c5 36 47 37 57 2-22 12-34 11-57-2" fill={index%2?'#bf8145':'#e5c78e'}/><path d="M122 46c-12-28 3-39 12-24 3-19 21-17 19 2 18-10 26 7 9 19" fill="#d95142"/><ellipse cx="142" cy="68" rx="31" ry="37" fill="#fff2ce" stroke="#bd945c" strokeWidth="3"/><path d="m166 64 23 11-24 9" fill="#e6aa35" stroke="#ba7c24" strokeWidth="2"/><ellipse cx="144" cy="94" rx="9" ry="14" fill="#d95142"/><circle cx="151" cy="59" r="5" fill="#3c3427"/><circle cx="152" cy="57" r="1.7" fill="white"/><circle cx="159" cy="79" r="6" fill="#efb292" opacity=".8"/></svg>;
}
export function CoopGame({farm,onCollect,onClose,onBuy}){
 const dialog=useRef(null),[pops,setPops]=useState([]),[notice,setNotice]=useState(''),[gathered,setGathered]=useState(0),inFlight=useRef(new Set());
 const hens=farm.animals.filter(a=>a.kind==='chicken'),ready=hens.reduce((n,a)=>n+a.ready,0);
 useDialogFocus(true,dialog,onClose);
 useEffect(()=>{if(!pops.length)return;const t=setTimeout(()=>setPops([]),900);return()=>clearTimeout(t);},[pops]);
 const take=(a,slot)=>{const id=`${a.id}:${slot}`;if(inFlight.current.has(id))return;inFlight.current.add(id);try{if(onCollect(a.id,slot)){setPops(p=>[...p,{id,hen:a.id,slot}]);setGathered(n=>n+1);setNotice('An egg in your basket!');}else setNotice('That egg could not be saved. Please try again.');}finally{inFlight.current.delete(id);}};
 return <section className="coop-game" role="dialog" aria-modal="true" aria-labelledby="coop-title" tabIndex={-1} ref={dialog}>
  <div className="coop-sunbeam" aria-hidden="true"/><div className="coop-window" aria-hidden="true"><i/><b>☀</b><span>🌿</span></div>
  <header className="coop-header"><button onClick={onClose} aria-label="Leave chicken coop">← Outside</button><div><span>OUR LITTLE FARM</span><h1 id="coop-title">The chicken coop</h1></div><div className="coop-ready" aria-label={`${ready} eggs ready`}>🥚 <b>{ready}</b></div></header>
  <div className="coop-sign"><span aria-hidden="true">✦</span> {ready?'Tap the eggs. Into the basket!':hens.length?'Happy hens, fresh eggs soon.':'A cozy home for your first chicken.'} <span aria-hidden="true">✦</span></div>
  <div className={`coop-nests ${hens.length>3?'coop-nests-large':''}`}>
   {hens.map((a,i)=><div className="coop-nest" key={a.id}><div className="coop-nest-plaque">{a.name==='Chicken'?`Hen ${i+1}`:a.name}</div><div className="coop-hay" aria-hidden="true"/><Hen index={i}/><div className="coop-egg-row">{[0,1,2].map(slot=>a.eggSlots.includes(slot)?<button key={slot} className="coop-egg" aria-label={`Collect egg ${slot+1} from hen ${i+1}`} onClick={()=>take(a,slot)}><svg viewBox="0 0 60 80" aria-hidden="true"><defs><radialGradient id={`egg-${i}-${slot}`} cx="30%" cy="25%" r="75%"><stop stopColor="#fffdf0"/><stop offset="1" stopColor="#ddc9a2"/></radialGradient></defs><path d="M30 4C16 4 5 37 5 52a25 24 0 0 0 50 0C55 37 44 4 30 4Z" fill={`url(#egg-${i}-${slot})`} stroke="#a47e4c" strokeWidth="2"/><ellipse cx="20" cy="29" rx="5" ry="11" fill="white" opacity=".65"/></svg><i aria-hidden="true">✦</i></button>:<span key={slot} className="coop-empty-slot" aria-hidden="true"/> )}</div>{pops.filter(p=>p.hen===a.id).map(p=><div key={p.id} className="coop-egg-pop" aria-hidden="true">🥚<b>+1</b><span>✦</span></div>)}<small className="coop-hen-status">{a.ready?'Fresh eggs for you':`Next egg in ${Math.max(1,Math.ceil(a.seconds/60))} min`}</small></div>)}
   {!hens.length&&<div className="coop-empty"><Hen/><p>Your hens will lay their eggs here.</p><button onClick={onBuy}>Welcome a chicken →</button></div>}
  </div>
  <footer className="coop-basket"><span className="coop-basket-art" aria-hidden="true">🧺</span><div><strong>My egg basket</strong><span>{farm.bag.egg} eggs in your bag</span></div><b aria-label={`${gathered} eggs collected this visit`}>+{gathered}</b></footer>
  <p className="coop-live" role="status" aria-live="polite">{farm.error||notice}</p>
 </section>;
}
