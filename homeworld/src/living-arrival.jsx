import React,{useEffect,useRef} from 'react';
import {Icon,useDialogFocus} from './ui.jsx';
import './living-arrival.css';
export function IslandArrival({arrival,engine}){
 const root=useRef(null),invoke=fn=>{const a=engine.current?.livingTest?.arrival;if(a)fn(a);};
 useDialogFocus(true,root,()=>invoke(a=>a.finish()));
 useEffect(()=>{root.current?.focus({preventScroll:true});},[]);
 return <section ref={root} tabIndex={-1} className={`island-arrival ${arrival.reduced?'arrival-reduced':''}`} role="dialog" aria-modal="true" aria-label="Welcome to your island">
  <div className="arrival-dark" aria-hidden="true"/>
  <button className="arrival-skip" onClick={()=>invoke(a=>a.finish())}>Skip intro</button>
  {arrival.phase==='hello'&&<div className="arrival-hello">
   <p><strong>Hey there, {arrival.name}!</strong><br/>Welcome to your own island.</p>
   <div className="arrival-actions"><button className="arrival-listen" aria-label="Hear Perry’s welcome" onClick={()=>invoke(a=>a.speak(true))}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>Listen</button><button className="arrival-plant" onClick={()=>invoke(a=>a.finish(true))}><Icon type="plant" size={28}/>Let’s plant!</button></div>
  </div>}
 </section>;
}
