import React,{useEffect,useRef,useState} from 'react';
import {Icon} from './ui.jsx';

/**
 * "Welcome ashore!" profile card (arrival-profile.js). Slides up from the bottom when a friend is
 * dropped off, or opens from About on their card. Arrival cards dismiss themselves after
 * `card.autoDismissMs`; a tap on the button, the shade or Escape closes either kind.
 */
export function ArrivalProfile({engine,card,enabled}){
  const [visible,setVisible]=useState(false);
  const button=useRef(null);
  const key=card?`${card.id}:${card.mode}:${card.at}`:'';
  const close=()=>{engine.current?.arrivals?.dismiss();};
  // Hold the card back until its `at` time (the friend is still being placed) and while the UI is busy.
  useEffect(()=>{
    setVisible(false);
    if(!card||!enabled)return;
    const wait=Math.max(0,card.at-Date.now());
    const t=setTimeout(()=>setVisible(true),wait);
    return()=>clearTimeout(t);
  },[key,enabled]);
  useEffect(()=>{
    if(!visible)return;
    button.current?.focus({preventScroll:true});
    const esc=e=>{if(e.key==='Escape'){e.preventDefault();close();}};
    window.addEventListener('keydown',esc);
    const t=card?.autoDismissMs?setTimeout(close,card.autoDismissMs):null;
    return()=>{window.removeEventListener('keydown',esc);if(t)clearTimeout(t);};
  },[visible,key]);
  if(!card||!enabled||!visible)return null;
  const p=card.profile,arrival=card.mode==='arrival';
  const plural=list=>list.length>1;
  return <div className="arrival-shade" onPointerDown={e=>e.stopPropagation()} onClick={close}>
    <section className="arrival-card panel" role="dialog" aria-modal="true" aria-labelledby="arrival-title" onClick={e=>e.stopPropagation()} style={card.autoDismissMs?{'--arrival-life':`${card.autoDismissMs}ms`}:undefined}>
      <div className="arrival-head">
        <span className="arrival-face">{card.imageUrl?<img src={card.imageUrl} alt=""/>:p.name[0]}</span>
        <div>
          <div className="eyebrow">{arrival?'WELCOME ASHORE':'FRIEND PROFILE'}</div>
          <h2 id="arrival-title">{p.name}</h2>
          <span className="arrival-role"><Icon type={p.role.icon} size={20}/>{p.role.levelName?`${p.role.levelName} ${p.role.name.toLowerCase()}`:p.role.name}</span>
        </div>
      </div>
      <dl className="arrival-traits">
        <div className="arrival-trait great"><dt>{plural(p.strengths)?'Strengths':'Strength'}</dt><dd>{p.strengths.map(s=><span key={s} className="arrival-chip">{s}</span>)}</dd></div>
        {p.weaknesses?.length>0&&<div className="arrival-trait learning"><dt>{plural(p.weaknesses)?'Weaknesses':'Weakness'}</dt><dd>{p.weaknesses.map(s=><span key={s} className="arrival-chip">{s}</span>)}</dd></div>}
        <div className="arrival-trait tasks"><dt>Tasks</dt><dd>{p.tasks.map((t,i)=><span key={t.text} className={`arrival-task ${t.silly?'silly':''}`}><Icon type={t.icon} size={22}/>{t.text}{i<p.tasks.length-1?<i aria-hidden="true">,</i>:null}</span>)}</dd></div>
      </dl>
      {p.story&&<p className="arrival-note arrival-story">{p.story}{p.bibleRef?<small> · {p.bibleRef}</small>:null}</p>}
      <p className="arrival-note">{p.foreman}</p>
      <button ref={button} type="button" className="arrival-ok" onClick={close}>{arrival?'Welcome ashore!':'Got it'}{arrival?<i className="arrival-timer" aria-hidden="true"/>:null}</button>
    </section>
  </div>;
}
