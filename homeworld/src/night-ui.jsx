import React,{useEffect,useRef,useState} from 'react';
import {Icon} from './ui.jsx';
export function NightRest({night}){
 if(!night?.sleeping)return null;
 return <div className="night-curtain"><section className="night-rest" role="status" aria-live="polite"><small className="night-bedtime">10 PM · Bedtime</small><Icon type="moon" size={48}/><strong>Good night, island!</strong><p>Everyone is resting.</p><small>Morning in {night.remaining} {night.remaining===1?'second':'seconds'}…</small><progress aria-label="Night rest" value={night.nightProgress} max="1"/></section></div>;
}
/** Small morning card. The island stays visible. One list per dawn; OK, a tap outside, or about 8 seconds closes it. */
export function MorningNote({report,onDismiss}){
 const dismiss=useRef(onDismiss);dismiss.current=onDismiss;
 const [fading,setFading]=useState(false);
 const day=report?.day;
 useEffect(()=>{
  if(day==null)return;
  setFading(false);
  const fade=setTimeout(()=>setFading(true),7000);
  const done=setTimeout(()=>dismiss.current?.(),8000);
  return ()=>{clearTimeout(fade);clearTimeout(done);};
 },[day]);
 if(!report?.lines?.length)return null;
 return <div className={`morning-note-layer${fading?' fading':''}`} onPointerDown={()=>dismiss.current?.()}>
  <aside className="morning-note" role="status" aria-live="polite" aria-label="This morning" onPointerDown={e=>e.stopPropagation()}>
   <strong>This morning</strong>
   <ul>{report.lines.map((line,i)=><li key={`${day}-${i}`}>{line}</li>)}</ul>
   <button type="button" onClick={()=>dismiss.current?.()}>OK</button>
  </aside>
 </div>;
}
