import React,{useState} from 'react';
import {StageIcon} from './stage-journey.jsx';

/**
 * "Today on the island": the stage the island is growing through, one large goal for each
 * friend ashore, and the two jobs only the kid can do. The chores those goals create
 * (a fence, a log, the grill, the hut) stay off this card — the friends keep doing them.
 */
function Face({friend}){
  return <span className="plan-face">{friend.imageUrl?<img src={friend.imageUrl} alt=""/>:friend.name.slice(0,1)}</span>;
}

function Meter({meter}){
  if(!meter)return null;
  const max=Math.max(1,meter.total||1),now=meter.met||0;
  return <div className="plan-meter">
    <div className="plan-meter-ends">
      <span className="plan-meter-end"><StageIcon id={meter.current.icon} size={28}/><b>{meter.current.name}</b></span>
      {meter.next&&<span className="plan-meter-end next"><b>{meter.next.name}</b><StageIcon id={meter.next.icon} size={28}/></span>}
    </div>
    <div className="plan-meter-bar" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={now} aria-label={meter.line}>
      <i style={{width:`${Math.round((meter.pct||0)*100)}%`}}/>
    </div>
    <ul className="plan-tracks">
      {meter.tracks.map(t=><li key={t.id} className={t.met?'met':''}><span>{t.label}</span><b>{t.value}</b></li>)}
    </ul>
    <p className="plan-meter-line">{meter.line}</p>
  </div>;
}

function FriendRow({friend,open,onToggle,onAssign}){
  const g=friend.goal;
  const live=!!friend.working&&!g.dismissed;
  const line=g.dismissed?g.title:live?g.title:(friend.asleep?'Sleeping':'Resting');
  return <li className={`${open?'open':''} ${g.dismissed?'waiting':''} ${g.yours?'yours':''} ${live?'busy':'idle'}`}>
    <Face friend={friend}/>
    <div className="plan-friend-body">
      <span className="plan-friend-name"><i className={live?'plan-dot live':'plan-dot'} aria-hidden="true"/>{friend.name}</span>
      <strong className="plan-friend-goal">{line}</strong>
      {g.yours&&live&&<small>Your pick for today</small>}
    </div>
    <button type="button" className="plan-x" aria-expanded={open} aria-label={open?`Close ${friend.name}'s goals`:`Change ${friend.name}'s goal`} onClick={onToggle}>✕</button>
    {open&&<div className="plan-picks" role="group" aria-label={`A new goal for ${friend.name}`}>
      {friend.options.map(o=><button key={o.title} type="button" onClick={()=>onAssign(friend.id,o)}>{o.title}</button>)}
      <button type="button" className="foreman" onClick={()=>onAssign(friend.id,{foreman:true})}>Let the foreman choose</button>
    </div>}
  </li>;
}

export function IslandPlan({today,village,stages,coins,onClose,onDismiss,onAssign,onAdd,onClearExtra}){
  const [openId,setOpenId]=useState(null);
  const [adding,setAdding]=useState(false);
  if(!today?.meter)return null;
  const meter=today.meter;
  const friends=today.friends||[];
  const many=friends.length>1;
  const name=friends[0]?.name||'your friend';
  const goldKnown=Number.isFinite(coins);
  const builds=(village?.upcoming||[]);
  const left=builds.filter(u=>!u.done).length;
  const toggle=friend=>{
    setAdding(false);
    if(openId===friend.id){setOpenId(null);return;}
    setOpenId(friend.id);
    if(!friend.goal.dismissed)onDismiss(friend.id);
  };
  return <div className="plan-shade" onClick={onClose}>
    <section className="plan-card panel" role="dialog" aria-modal="true" aria-labelledby="plan-title" onClick={e=>e.stopPropagation()}>
      <div className="plan-head">
        <div><div className="eyebrow">TODAY ON THE ISLAND</div><h2 id="plan-title">{many?'What the crew could\u00a0do':friends.length?`What ${name} could\u00a0do`:'What the island could\u00a0do'}</h2></div>
        <button type="button" className="close" onClick={onClose} aria-label="Close today's goals">Later</button>
      </div>
      <Meter meter={meter}/>
      <div className="eyebrow plan-kicker">THE CREW</div>
      {friends.length?<ul className="plan-friends">
        {friends.map(f=><FriendRow key={f.id} friend={f} open={openId===f.id} onToggle={()=>toggle(f)} onAssign={(id,choice)=>{setOpenId(null);onAssign(id,choice);}}/>)}
      </ul>:<p className="plan-empty">No friends ashore yet. Drop one off and the foreman will give them a goal.</p>}
      {today.extra&&<p className="plan-extra"><span>Today's extra: <b>{today.extra.title}</b></span><button type="button" className="plan-x" onClick={onClearExtra} aria-label="Take today's extra goal off">✕</button></p>}
      <div className="eyebrow plan-kicker">FOR YOU</div>
      <ul className="plan-you">
        {meter.gap>0&&<li>
          <span className="plan-you-mark" aria-hidden="true">+</span>
          <div><strong>{`Collect ${meter.gap} more friend${meter.gap===1?'':'s'}`}</strong><small>{`${meter.people} of ${meter.need} are ashore`}</small></div>
        </li>}
        {meter.full&&<li className="done">
          <span className="plan-you-mark" aria-hidden="true">✓</span>
          <div><strong>Harbour Town has its people</strong><small>{meter.people} ashore</small></div>
        </li>}
        <li>
          <span className="plan-coin" aria-hidden="true"/>
          <div><strong>Collect gold</strong><small>{goldKnown?`You have ${coins} gold coin${coins===1?'':'s'}`:'Gold coins from the ship'}</small></div>
        </li>
      </ul>
      {adding?<div className="plan-picks plan-add-list" role="group" aria-label="Add a goal for today">
        {(today.choices||[]).map(c=><button key={c.title} type="button" onClick={()=>{setAdding(false);onAdd(c);}}>{c.title}</button>)}
        {today.extra&&<button type="button" className="foreman" onClick={()=>{setAdding(false);onClearExtra();}}>Take today's extra off</button>}
        <button type="button" className="foreman" onClick={()=>setAdding(false)}>Not now</button>
      </div>:<button type="button" className="plan-add" onClick={()=>{setOpenId(null);setAdding(true);}}>{today.extra?'Change today\'s goal':'Add a goal for today'}</button>}
      {builds.length>0&&<details className="plan-village-more"><summary>Other things we could build ({left})</summary>
        <div className="plan-village-goals">{builds.map(u=><span key={`${u.kind}:${u.upgrade||''}`} className={u.done?'done':''}>{u.done?'✓ ':''}{u.upgrade?`Upgrade to ${u.name}`:u.name}{u.count>1?` ${Math.min(u.have,u.count)}/${u.count}`:''}</span>)}</div>
      </details>}
    </section>
  </div>;
}
