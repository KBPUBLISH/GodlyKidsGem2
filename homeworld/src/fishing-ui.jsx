import React,{useEffect,useRef,useState} from 'react';
import {Icon} from './ui.jsx';
import {SWEET_SPOT} from './fishing.js';

/** Round wooden reel: drag in circles to turn it. Clockwise turns reel the line in. */
function Reel({engine,hot,disabled}){
  const ref=useRef(null),last=useRef(null),[angle,setAngle]=useState(0);
  const angleAt=e=>{const r=ref.current.getBoundingClientRect();return Math.atan2(e.clientY-(r.top+r.height/2),e.clientX-(r.left+r.width/2));};
  const down=e=>{if(disabled)return;e.preventDefault();ref.current.setPointerCapture(e.pointerId);last.current=angleAt(e);};
  const move=e=>{if(last.current==null||disabled)return;const a=angleAt(e);let d=a-last.current;if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;last.current=a;if(Math.abs(d)>1.2)return;setAngle(v=>v+d);if(d>0)engine.current?.fishing?.reel(d);};
  const up=()=>{last.current=null;};
  return <div ref={ref} className={`fishing-reel ${hot?'hot':''} ${disabled?'off':''}`} role="slider" aria-label="Fishing reel. Drag in circles to reel in." aria-valuenow={Math.round(angle)} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
    <div className="fishing-reel-rim"/>
    <div className="fishing-reel-disc" style={{transform:`rotate(${angle}rad)`}}><i/><i/><i/><i/><u/><b/></div>
    <span className="fishing-reel-hint">{hot?'Turn!':'Reel'}</span>
  </div>;
}

const RodIcon=()=><svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><path d="M4 28 26 4" stroke="#fff7e6" strokeWidth="3" strokeLinecap="round"/><path d="M26 4c2 6 1 12-4 16" stroke="#fff7e6" strokeWidth="1.6" fill="none" strokeLinecap="round"/><circle cx="21" cy="22" r="3" fill="#ffd15c" stroke="#fff7e6" strokeWidth="1.4"/><circle cx="10" cy="20" r="2.6" fill="#ffd15c" stroke="#8a5a1f" strokeWidth="1.2"/></svg>;

/**
 * Full-screen overlay for dock fishing: a hanging cove sign, Exit and catch counter up top,
 * a storybook panel with the cast-power bar (sweet spot marked), a big "Hold to cast" button,
 * the spinning reel, and the fight meters while a fish is on.
 */
/** Smooth per-frame readings for the bars; the engine only publishes snapshots on phase changes. */
function useLive(engine,on){
  const [live,setLive]=useState({power:0,progress:0,tension:0});
  useEffect(()=>{if(!on)return;let raf=0;const tick=()=>{const f=engine.current?.fishing;if(f)setLive(l=>{const n={power:f.phase==='charging'?f.power:0,progress:f.progress||0,tension:f.tension||0};return Math.abs(n.power-l.power)>.004||Math.abs(n.progress-l.progress)>.004||Math.abs(n.tension-l.tension)>.004?n:l;});raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);return ()=>cancelAnimationFrame(raf);},[engine,on]);
  return live;
}

export function FishingGame({engine,fishing}){
  const [holding,setHolding]=useState(false);
  useEffect(()=>{if(fishing?.phase!=='charging')setHolding(false);},[fishing?.phase]);
  const live=useLive(engine,!!fishing?.firstPerson);
  if(!fishing)return null;
  const f=fishing,fp=f.firstPerson;
  const canCast=f.phase==='cast'||f.phase==='charging',reelHot=f.phase==='bite'||(f.phase==='reel'&&!f.struggling),reelOn=f.phase==='bite'||f.phase==='reel';
  const power=live.power,progress=live.progress,tension=live.tension,inSweet=f.phase==='charging'&&power>=SWEET_SPOT[0]&&power<=SWEET_SPOT[1];
  const start=e=>{e.preventDefault();if(f.phase!=='cast')return;setHolding(true);engine.current?.fishing?.chargeStart();};
  const end=e=>{e.preventDefault();if(!holding)return;setHolding(false);engine.current?.fishing?.chargeEnd();};
  const castLabel=holding?(inSweet?'Let go!':'Let go'):canCast?'Hold to cast':f.phase==='wait'?'Watch…':f.phase==='flying'?'Casting':f.phase==='bite'?'Reel!':f.phase==='reel'?'Reel in':'—';
  return <div className={`fishing-layer ${fp?'in':''}`} aria-live="polite">
    <div className="fishing-fade" style={{opacity:f.fade}}/>
    {fp&&<>
      <div className="fishing-top">
        <button type="button" className="fishing-stop" onClick={()=>engine.current?.fishing?.quit()} aria-label="Exit fishing and go back"><b aria-hidden="true">✕</b><span>Exit</span></button>
        <div className="fishing-sign" aria-hidden="true"><i className="rope l"/><i className="rope r"/><span>Fishing Cove</span></div>
        <div className="fishing-score"><Icon type="rawfish" size={26}/><strong>{f.caught} / {f.target}</strong></div>
      </div>
      {f.message&&<p className={`fishing-message ${f.struggling?'warn':''} ${f.phase==='caught'?'win':''}`}>{f.message}</p>}
      {f.phase==='caught'&&<div className="fishing-caught"><Icon type="rawfish" size={54}/><strong>You caught a fish!</strong><small>{f.caught} of {f.target}</small></div>}
      <div className="fishing-panel" aria-label="Fishing controls">
        {f.phase==='reel'||f.phase==='bite'?<div className="fishing-meters">
          <div className="fishing-meter"><span>Fish</span><div className="fishing-track"><i className="progress" style={{height:`${(progress*100).toFixed(1)}%`}}/></div></div>
          <div className={`fishing-meter tension ${tension>.7?'danger':''}`}><span>{f.struggling?'Hold!':'Line'}</span><div className="fishing-track"><i className="tension" style={{height:`${(tension*100).toFixed(1)}%`}}/></div></div>
        </div>:<div className="fishing-power-wrap">
          <span className="fishing-power-label">Power</span>
          <div className={`fishing-power ${inSweet?'sweet':''}`}><i className="sweet-zone" style={{bottom:`${SWEET_SPOT[0]*100}%`,height:`${(SWEET_SPOT[1]-SWEET_SPOT[0])*100}%`}}/><i className="fill" style={{height:`${(power*100).toFixed(1)}%`}}/><i className="knob" style={{bottom:`${(power*100).toFixed(1)}%`}}/></div>
        </div>}
        <button type="button" className={`fishing-cast ${holding?'charging':''} ${inSweet&&holding?'sweet':''}`} disabled={!canCast} onPointerDown={start} onPointerUp={end} onPointerCancel={end} onPointerLeave={end} onContextMenu={e=>e.preventDefault()} aria-label={holding?'Let go to cast':'Hold to power up the cast'}>
          <RodIcon/><span>{castLabel}</span>
        </button>
        <Reel engine={engine} hot={reelHot} disabled={!reelOn}/>
      </div>
    </>}
  </div>;
}
