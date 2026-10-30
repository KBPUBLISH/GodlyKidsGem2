import React,{useState} from 'react';
import {Icon} from './ui.jsx';
import {StageIcon} from './stage-journey.jsx';

/** Settlement stage id (settlement.mjs) → journey icon (stage-journey.jsx). */
const STAGE_ICONS={camp:'camp',homestead:'homestead',village:'village',harbour_town:'harbor'};

const PICK_KEY='gk-plan-who';
const memory={};

function recalled(id,crew){
  let ids=memory[id];
  if(!ids){try{ids=JSON.parse(sessionStorage.getItem(PICK_KEY)||'{}')[id];}catch{ids=null;}}
  return (ids||[]).filter(x=>crew.some(c=>c.id===x));
}
function remember(id,ids){
  memory[id]=ids;
  try{const all=JSON.parse(sessionStorage.getItem(PICK_KEY)||'{}');all[id]=ids;sessionStorage.setItem(PICK_KEY,JSON.stringify(all));}catch{}
}
function joinNames(names){
  if(names.length<=1)return names[0]||'';
  if(names.length===2)return `${names[0]} and ${names[1]}`;
  return `${names.slice(0,-1).join(', ')} and ${names[names.length-1]}`;
}

/**
 * "Today on the island" card: the to-do list that pops up when My Home opens.
 * With more than one friend, the chips are a multi-select and Go sends the
 * same task to everyone who is on.
 */
/** The village strip: stage ladder, what the friends are raising next, and who has grown into which role. */
function VillageStrip({village,goal,onDropGoal}){
  if(!village)return null;
  const g=village.goal,stage=village.stage;
  const needLine=g&&!g.blocked?['wood','stone'].filter(r=>g.missing[r]>0).map(r=>`${g.missing[r]} more ${r}`).join(' and '):'';
  const status=!g?'Everything on the plan is built. The friends keep the island running.':g.blocked?g.blocked:g.underway?`${g.name}: the friends are on it.`:g.ready?`${g.name}: materials ready, waiting for a free builder.`:`${g.name}: the friends are gathering ${needLine||'what it needs'}.`;
  return <div className="plan-village">
    <div className="plan-village-head">
      <StageIcon id={STAGE_ICONS[stage.id]||'camp'} size={34} className="plan-village-icon"/>
      <div><small>OUR VILLAGE · {stage.name.toUpperCase()}</small><strong>{g?(g.focus?'Your pick: ':'Next: ')+g.name:'All built!'}</strong></div>
      <span className="plan-stage-dots" aria-label={`Stage ${stage.index+1} of ${stage.total}`}>{Array.from({length:stage.total},(_,i)=><i key={i} className={i<stage.index?'done':i===stage.index?'now':''}/>)}</span>
    </div>
    <p className="plan-village-status">{status}</p>
    <div className="plan-village-goals">{village.upcoming.map(u=><span key={u.kind} className={u.done?'done':''}>{u.done?'✓ ':''}{u.upgrade?`Upgrade to ${u.name}`:u.name}{u.count>1?` ${Math.min(u.have,u.count)}/${u.count}`:''}</span>)}</div>
    {village.roster.some(r=>r.role)&&<div className="plan-village-roles">{village.roster.filter(r=>r.role).map(r=><span key={r.id}>{r.name} · {r.role.levelName} {r.role.name.toLowerCase()}</span>)}</div>}
    {goal&&g?.focus&&<button type="button" className="plan-village-drop" onClick={onDropGoal}>Let the friends choose instead</button>}
  </div>;
}

export function IslandPlan({plan,crew=[],working,goal,village,onGo,onClose,onDropGoal}){
  const [choosing,setChoosing]=useState(null);
  const [picked,setPicked]=useState({});
  if(!plan)return null;
  const many=crew.length>1,active=crew.find(c=>c.active)||crew[0],name=active?.name||'Your friend';
  const selectedIds=id=>(picked[id]||[]).filter(x=>crew.some(c=>c.id===x));
  const openChoose=item=>{
    setChoosing(item.id);
    setPicked(prev=>{
      if(Object.prototype.hasOwnProperty.call(prev,item.id))return prev;
      const saved=recalled(item.id,crew);
      return {...prev,[item.id]:saved.length?saved:(active?.id?[active.id]:[])};
    });
  };
  const toggle=(item,id)=>setPicked(prev=>{
    const cur=prev[item.id]||[];
    return {...prev,[item.id]:cur.includes(id)?cur.filter(x=>x!==id):[...cur,id]};
  });
  const go=(item,ids)=>{
    const unique=[...new Set(ids)].filter(id=>crew.some(c=>c.id===id));
    if(!unique.length)return;
    remember(item.id,unique);setChoosing(null);onGo(item.task,unique);
  };
  return <div className="plan-shade" onClick={onClose}>
    <section className="plan-card panel" role="dialog" aria-modal="true" aria-labelledby="plan-title" onClick={e=>e.stopPropagation()}>
      <div className="plan-head">
        <div><div className="eyebrow">TODAY ON THE ISLAND</div><h2 id="plan-title">{!plan.length||!plan[0].task?'All caught up!':many?'What the crew could do':`What ${name} could do`}</h2></div>
        <button type="button" className="close" onClick={onClose} aria-label="Close the to-do list">Later</button>
      </div>
      <VillageStrip village={village} goal={goal} onDropGoal={onDropGoal}/>
      {goal&&<div className="plan-goal">
        <img src={`/assets/build_${goal.kind}.png`} alt=""/>
        <div className="plan-goal-body">
          <small>OUR GOAL</small>
          <strong>Build a {goal.name}</strong>
          <div className="plan-goal-needs">
            {['wood','stone'].filter(r=>goal.need[r]>0).map(r=>{const have=Math.min(goal.have[r],goal.need[r]),full=have>=goal.need[r];return <div key={r} className={`plan-need ${full?'full':''}`}><Icon type={r} size={22}/><span className="plan-need-bar"><i style={{width:`${Math.round(have/goal.need[r]*100)}%`}}/></span><b>{have}/{goal.need[r]}</b></div>;})}
          </div>
        </div>
        <button type="button" className="plan-goal-drop" onClick={onDropGoal} aria-label="Drop this goal">✕</button>
      </div>}
      {working&&!many&&<p className="plan-working"><Icon type="energy" size={20}/> {name} is already {working.toLowerCase()}. Picking a new job swaps it.</p>}
      <ul className="plan-list">
        {plan.map(item=>{
          const ids=selectedIds(item.id);
          const names=joinNames(crew.filter(c=>ids.includes(c.id)).map(c=>c.name));
          const open=many&&choosing===item.id;
          return <li key={item.id} className={`${item.task?'':'done'} ${open?'choosing':''}`}>
            <span className="plan-icon"><Icon type={item.icon} size={34}/></span>
            <div><strong>{item.title}</strong><small>{item.why}</small></div>
            {item.task?<button type="button" className="plan-go" aria-expanded={many?open:undefined} disabled={open&&!ids.length} onClick={()=>{if(!many){go(item,[active?.id]);return;}if(!open){openChoose(item);return;}go(item,ids);}} aria-label={open?(names?`${item.title}: send ${names}`:`${item.title}: choose who goes`):many?`${item.title}: choose who goes`:`${item.title}: send ${name}`}>Go</button>:<span className="plan-check" aria-hidden="true">✓</span>}
            {open&&<div className="plan-who" role="group" aria-label="Who should do it?"><span>Who should do it?</span>{crew.map(c=>{const on=ids.includes(c.id);return <button key={c.id} type="button" aria-pressed={on} onClick={()=>toggle(item,c.id)}>{c.imageUrl?<img src={c.imageUrl} alt=""/>:<i/>}{c.name}{on&&<b className="plan-who-check" aria-hidden="true">✓</b>}</button>;})}{names&&<p className="plan-who-names">{names}</p>}</div>}
          </li>;
        })}
      </ul>
      <p className="plan-foot">{many?'Friends can work at the same time. Tap who should go, then press Go.':'Tap a character any time to give them a different job, or ask them in chat.'}</p>
    </section>
  </div>;
}
