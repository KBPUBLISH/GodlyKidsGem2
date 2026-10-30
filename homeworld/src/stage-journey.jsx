import React,{useEffect,useRef} from 'react';
import './stage-journey.css';

/**
 * Island journey UI (stages.mjs + stage-tracker.js): the stage badge in the top bar, the ladder
 * panel it opens, and the confetti moment when a new stage is reached. Icons are small inline
 * SVGs (no emoji), one per stage: tent (Camp), cabin (Homestead), cluster of houses (Village) and a
 * ship at the quay (Harbour Town); the church-spire and market-stall marks are kept for later stages.
 */
const ART={
  camp:<><path fill="#d8e8c0" d="M2 38h40v3H2z"/><path fill="#5f9b4b" stroke="#365f2b" strokeWidth="1.8" d="M22 7 4 38h36Z"/><path fill="#2f4d26" d="M22 20 15 38h14Z"/><path fill="#f6c14a" d="M9 36c0-3 1-4 2-5l-1 3 2-1-1 3Z"/><path stroke="#ffb13b" strokeWidth="2.4" strokeLinecap="round" d="M33 35c0-4 3-6 3-9 1 3 3 4 3 7a3 3 0 0 1-6 2Z"/><circle fill="#ffe27a" cx="36" cy="33" r="1.6"/></>,
  homestead:<><path fill="#d8e8c0" d="M2 38h40v3H2z"/><path fill="#b8803f" stroke="#6b4a24" strokeWidth="1.8" d="M9 20h26v18H9z"/><path fill="#8a4d2a" stroke="#5a3218" strokeWidth="1.8" d="M6 21 22 7l16 14Z"/><path fill="#5b3a1b" d="M19 38V28h6v10Z"/><path fill="#ffe9a8" stroke="#6b4a24" strokeWidth="1.2" d="M12 25h5v5h-5zm15 0h5v5h-5z"/><path fill="#6a8f3d" d="M3 36c2-3 5-3 7 0zm31 0c2-3 5-3 7 0z"/><path fill="#7a4a2a" d="M30 9h3v6h-3z"/></>,
  village:<><path fill="#d8e8c0" d="M2 38h40v3H2z"/><path fill="#c69a5c" stroke="#6b4a24" strokeWidth="1.6" d="M3 24h13v14H3z"/><path fill="#8a4d2a" stroke="#5a3218" strokeWidth="1.6" d="M1.5 25 9.5 17l8 8Z"/><path fill="#e3c07e" stroke="#6b4a24" strokeWidth="1.6" d="M28 24h13v14H28z"/><path fill="#8a4d2a" stroke="#5a3218" strokeWidth="1.6" d="M26.5 25l8-8 8 8Z"/><path fill="#f3dca3" stroke="#6b4a24" strokeWidth="1.6" d="M14 20h16v18H14z"/><path fill="#b23f33" stroke="#6b2a21" strokeWidth="1.6" d="M12 21 22 10l10 11Z"/><path fill="#5b3a1b" d="M20 38v-8h4v8z"/><path fill="#ffe9a8" d="M6 28h4v4H6zm28 0h4v4h-4z"/></>,
  town:<><path fill="#d8e8c0" d="M2 38h40v3H2z"/><path fill="#e8dcc3" stroke="#6b5a40" strokeWidth="1.6" d="M16 18h12v20H16z"/><path fill="#b23f33" stroke="#6b2a21" strokeWidth="1.6" d="M14 19 22 11l8 8Z"/><path fill="#f2e9d6" stroke="#6b5a40" strokeWidth="1.6" d="M19 10h6v9h-6z"/><path fill="#8d4a2e" d="M17 9 22 3l5 6Z"/><path stroke="#f6c14a" strokeWidth="1.8" strokeLinecap="round" d="M22 1v3m-1.5 1.5h3"/><path fill="#7d4d30" d="M20 38v-7h4v7z"/><path fill="#c69a5c" stroke="#6b4a24" strokeWidth="1.5" d="M3 26h11v12H3z"/><path fill="#8a4d2a" d="M1.5 27 8.5 20l7 7Z"/><path fill="#e3c07e" stroke="#6b4a24" strokeWidth="1.5" d="M30 26h11v12H30z"/><path fill="#8a4d2a" d="M28.5 27l7-7 7 7Z"/><path fill="#ffe9a8" d="M6 30h4v3H6zm27 0h4v3h-4zm-12-6h4v4h-4z"/></>,
  market:<><path fill="#d8e8c0" d="M2 38h40v3H2z"/><path fill="#7a4a2a" d="M6 20h2.4v18H6zm29.6 0H38v18h-2.4z"/><path fill="#c69a5c" stroke="#6b4a24" strokeWidth="1.5" d="M5 27h34v4H5z"/><path fill="#f2f2ee" stroke="#6b3a2a" strokeWidth="1.5" d="M3 20 8 11h28l5 9Z"/><path fill="#d9433a" d="M8.5 11.5h4.6L10 19.5H5.6Zm9.2 0h4.6l-2.3 8h-4.6Zm9.2 0h4.6l-1.4 8h-4.6Zm9.2 0h-4.6l1 8h4.6Z" opacity=".9"/><path fill="#d9433a" d="M3 20h40c0 2-1.5 3-3 3H6c-1.5 0-3-1-3-3Z"/><path fill="#fff" d="M9 20h5l-1 3h-4zm10 0h5l-.3 3h-5zm10 0h5l.5 3h-5z"/><path fill="#e0a248" stroke="#8a5a1a" strokeWidth="1.2" d="M10 31h7v7h-7z"/><path fill="#8dbb5a" d="M11.5 29.5a2 2 0 1 1 4 0Z"/><path fill="#e9c58a" stroke="#8a5a1a" strokeWidth="1.2" d="M26 32h9v6h-9z"/><circle fill="#f07a3a" cx="28.5" cy="31.5" r="1.6"/><circle fill="#f07a3a" cx="32" cy="31.5" r="1.6"/><circle fill="#f0c23a" cx="30.3" cy="29.6" r="1.6"/><path fill="#6e4a24" d="M19 31h5v7h-5z"/></>,
  harbor:<><path fill="#79b8d8" d="M2 34h40v7H2z"/><path fill="#5a3a1c" stroke="#3a2410" strokeWidth="1.5" d="M6 30h32l-4 7H10Z"/><path fill="#3a2410" d="M22 10h1.8v20H22z"/><path fill="#f4efe0" stroke="#8a7a5a" strokeWidth="1.4" d="M24 11c8 3 11 9 11 17H24Zm-2 2c-7 3-9 8-9 15h9Z"/><path fill="#d9433a" d="M22 9h7l-7 3Z"/><path fill="#a8d8ee" d="M2 36c4-2 8 2 12 0s8-2 12 0 8 2 12 0v2c-4 2-8-2-12 0s-8 2-12 0-8-2-12 0Z"/></>,
};
export function StageIcon({id,size=28,className=''}){
  return <svg className={`stage-icon ${className}`} viewBox="0 0 44 44" width={size} height={size} aria-hidden="true" focusable="false" strokeLinejoin="round" strokeLinecap="round">{ART[id]||ART.camp}</svg>;
}

/** Top-bar badge: current stage icon + name, with the one requirement furthest from the next stage as a hint. Pulses while a celebration is on. */
export function StageBadge({stages,onOpen}){
  if(!stages)return null;
  const s=stages.stage,next=stages.next,pending=next?next.requirements.filter(r=>!r.done).length:0,lag=stages.lagging;
  const hint=lag?`${lag.short} ${lag.have}/${lag.need}`:null;
  return <button type="button" className={`stage-badge ${stages.celebration?'cheer':''}`} aria-label={`Island journey. Your island is a ${s.name}.${hint?` Next: ${lag.label} ${lag.have} of ${lag.need}.`:''} Open the journey`} aria-expanded={!!stages.open} onClick={onOpen}>
    <StageIcon id={s.icon} size={34}/>
    <span><small>{hint?<>NEXT · {hint.toUpperCase()}</>:'OUR ISLAND'}</small><strong>{s.name}</strong></span>
    {pending>0&&<i className="stage-badge-dot" aria-hidden="true">{pending}</i>}
  </button>;
}

function Requirement({r}){
  return <li className={`stage-req ${r.done?'done':''}`}>
    <span className="stage-req-mark" aria-hidden="true">{r.done?'✓':''}</span>
    <span className="stage-req-body"><strong>{r.label}{r.need>1?<b> {r.have}/{r.need}</b>:null}</strong>{!r.done&&r.hint?<small>{r.hint}</small>:null}</span>
    {r.need>1&&<span className="stage-req-bar"><i style={{width:`${Math.round(r.have/r.need*100)}%`}}/></span>}
  </li>;
}

/** The Island journey panel plus the celebration overlay. Reads `view.stages` (stage-tracker.js snapshot). */
export function StageJourney({engine,stages,enabled}){
  const closeButton=useRef(null);
  const open=!!(enabled&&stages?.open);
  const close=()=>engine.current?.stages?.hide();
  useEffect(()=>{
    if(!open)return;
    closeButton.current?.focus({preventScroll:true});
    const key=e=>{if(e.key==='Escape'){e.preventDefault();close();}};
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[open]);
  if(!stages||!enabled)return null;
  const c=stages.celebration;
  const travellers=stages.travellers;
  return <>
    {c&&<Celebration key={c.at} c={c} onDismiss={()=>engine.current?.stages?.dismissCelebration()}/>}
    {open&&<div className="journey-shade" onPointerDown={e=>e.stopPropagation()} onClick={close}>
      <section className="journey-card panel" role="dialog" aria-modal="true" aria-labelledby="journey-title" onClick={e=>e.stopPropagation()}>
        <div className="journey-head">
          <StageIcon id={stages.stage.icon} size={54} className="journey-head-icon"/>
          <div><div className="eyebrow">ISLAND JOURNEY</div><h2 id="journey-title">Our island is a {stages.stage.name}</h2><p>{stages.stage.blurb}</p></div>
          <button ref={closeButton} type="button" className="close" onClick={close} aria-label="Close the island journey">Done</button>
        </div>
        <ol className="journey-ladder">
          {stages.stages.map(s=>{
            const showReqs=stages.next&&s.id===stages.next.id;
            const status=s.done?(s.reachedDay?`Reached on day ${s.reachedDay}`:'Reached'):s.current?'We are here':showReqs?'Next':'Later';
            return <li key={s.id} className={`journey-step ${s.done?'done':''} ${s.current?'current':''} ${showReqs?'next':''}`}>
              <span className="journey-step-icon"><StageIcon id={s.icon} size={36}/>{s.done&&<b className="journey-check" aria-hidden="true">✓</b>}</span>
              <div className="journey-step-body">
                <div className="journey-step-title"><strong>{s.name}</strong><small>{status}</small></div>
                <p>{s.blurb}</p>
                {showReqs&&<ul className="stage-reqs" aria-label={`What ${s.name} still needs`}>{s.requirements.map(r=><Requirement key={r.id} r={r}/>)}</ul>}
              </div>
            </li>;
          })}
        </ol>
        {stages.island&&<div className="journey-island" aria-label="Island totals">
          <span><b>{stages.island.people}</b><small>People · {stages.island.beds} bed{stages.island.beds===1?'':'s'}</small></span>
          <span><b>{stages.island.food}</b><small>Food produced</small></span>
          <span><b>{stages.island.animals}</b><small>Animals</small></span>
        </div>}
        <p className="journey-foot">More of the journey is coming later. Every new friend who settles here counts!</p>
        {travellers&&<div className="journey-visitors">
          <div className="eyebrow">VISITORS</div>
          <div className="journey-visitor-stats">
            <span><b>{travellers.welcomed}</b><small>Travellers welcomed</small></span>
            <span><b>{travellers.friends}</b><small>Friends of the island</small></span>
            {travellers.gifts>0&&<span><b>{travellers.gifts}</b><small>Gifts received</small></span>}
          </div>
          <p>{travellers.note}</p>
        </div>}
      </section>
    </div>}
  </>;
}

const CONFETTI=Array.from({length:26},(_,i)=>({i,left:(i*37)%100,delay:(i%7)*.12,hue:[46,8,120,200,330,28][i%6],spin:(i%2?1:-1)*(240+(i*53)%300),fall:3.6+(i%5)*.35}));
function Celebration({c,onDismiss}){
  return <div className="stage-cheer" role="status" aria-live="polite" onClick={onDismiss}>
    <div className="stage-confetti" aria-hidden="true">{CONFETTI.map(p=><i key={p.i} style={{left:`${p.left}%`,'--d':`${p.delay}s`,'--h':p.hue,'--spin':`${p.spin}deg`,'--fall':`${p.fall}s`}}/>)}</div>
    <div className="stage-cheer-card">
      <span className="stage-cheer-icon"><StageIcon id={c.icon} size={64}/></span>
      <div className="eyebrow">NEW STAGE</div>
      <strong>Your island is now a {c.name}!</strong>
      <small>Everyone cheers · tap to keep playing</small>
    </div>
  </div>;
}
