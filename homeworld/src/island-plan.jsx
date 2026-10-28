import React,{useState} from 'react';
import {Icon} from './ui.jsx';

/**
 * "Today on the island" card: the to-do list that pops up when My Home opens.
 * Every row is one tap away from sending a character off to do it. With more
 * than one friend on the island, Go asks who should take the job.
 */
export function IslandPlan({plan,crew=[],working,goal,onGo,onClose,onDropGoal}){
  const [choosing,setChoosing]=useState(null);
  if(!plan)return null;
  const many=crew.length>1,active=crew.find(c=>c.active)||crew[0],name=active?.name||'Your friend';
  const go=(item,id)=>{setChoosing(null);onGo(item.task,id);};
  return <div className="plan-shade" onClick={onClose}>
    <section className="plan-card panel" role="dialog" aria-modal="true" aria-labelledby="plan-title" onClick={e=>e.stopPropagation()}>
      <div className="plan-head">
        <div><div className="eyebrow">TODAY ON THE ISLAND</div><h2 id="plan-title">{!plan.length||!plan[0].task?'All caught up!':many?'What the crew could do':`What ${name} could do`}</h2></div>
        <button type="button" className="close" onClick={onClose} aria-label="Close the to-do list">Later</button>
      </div>
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
        {plan.map(item=><li key={item.id} className={`${item.task?'':'done'} ${choosing===item.id?'choosing':''}`}>
          <span className="plan-icon"><Icon type={item.icon} size={34}/></span>
          <div><strong>{item.title}</strong><small>{item.why}</small></div>
          {item.task?<button type="button" className="plan-go" aria-expanded={many?choosing===item.id:undefined} onClick={()=>many?setChoosing(choosing===item.id?null:item.id):go(item,active?.id)} aria-label={many?`${item.title}: choose who goes`:`${item.title}: send ${name}`}>Go</button>:<span className="plan-check" aria-hidden="true">✓</span>}
          {many&&choosing===item.id&&<div className="plan-who" role="group" aria-label="Who should do it?"><span>Who should do it?</span>{crew.map(c=><button key={c.id} type="button" onClick={()=>go(item,c.id)}>{c.imageUrl?<img src={c.imageUrl} alt=""/>:<i/>}{c.name}</button>)}</div>}
        </li>)}
      </ul>
      <p className="plan-foot">{many?'Friends can work at the same time. Pick who goes, or tap anyone on the island to give them a job.':'Tap a character any time to give them a different job, or ask them in chat.'}</p>
    </section>
  </div>;
}
