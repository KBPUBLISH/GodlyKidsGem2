import React from 'react';
import {Icon} from './ui.jsx';
import {HomeUpgrades} from './building-ui.jsx';
import {SLEEP_SECONDS} from './nutrition.mjs';

export function SleepPanel({view,selectedHomeId,onSleep,onBuild,onWake,onRetry,onUpgrade}){
  const n=view.nutrition,homes=[...n.homes].sort((a,b)=>(b.id===selectedHomeId)-(a.id===selectedHomeId));
  return <>
    <div className="sleep-intro"><Icon type="rest" size={64}/><div><strong>{n.sleep?'Sweet dreams…':n.lowEnergy?`${n.name} needs energy`:'A cozy place to recharge'}</strong><p>Resting at home fills energy to 100.</p></div></div>
    <div className="sleep-summary"><span>{n.name} · {n.energy} / 100 energy</span><b>{n.stateLabel}</b></div>
    {n.sleep?<div className="home-sleep-progress"><strong>Sleeping in {n.sleep.homeName}</strong><progress value={n.sleep.progress} max="1" aria-label="Sleep progress"/><p>{n.sleep.saveError?'Your sleep is saved. Try waking again to finish.':`${n.sleep.remaining} seconds left`}</p><button onClick={n.sleep.saveError?onRetry:onWake}>{n.sleep.saveError?'Try waking again':'Wake up early'}</button></div>:homes.length?<>
      <button className="sleep-main" disabled={view.busy||!n.canSleep} onClick={()=>onSleep(selectedHomeId)}><Icon type="moon" size={30}/>{n.canSleep?'Rest at home':'Full energy!'}</button>
      <p>Choose a finished home. Walking there is free, even with no energy.</p>
      <div className="sleep-home-list">{homes.map((h,i)=><button key={h.id} className={h.id===selectedHomeId?'chosen-home':''} disabled={view.busy||!n.canSleep} aria-label={`Sleep in ${h.name} ${i+1}`} onClick={()=>onSleep(h.id)}><img src={`/assets/build_${h.kind}.png`} alt=""/><span><strong>{h.name}</strong><small>Sleep here →</small></span></button>)}</div>
    </>:<div className="sleep-no-home"><Icon type="build" size={48}/><strong>A home makes a cozy bed!</strong><p>Build a Small Hut or Prayer Tent first. A short breather and food can help you gather the materials.</p><button onClick={onBuild}>Build a home</button></div>}
    {!n.sleep&&<HomeUpgrades view={view} onUpgrade={onUpgrade}/>}
    <p className="sleep-explanation">A daytime nap takes {SLEEP_SECONDS} seconds and leaves the island clock running normally. At 10 PM everyone rests together, and morning arrives after 10 seconds. Food and rest refill energy. You can always walk home.</p>
  </>;
}

export function SleepBubble({sleep,onWake,onRetry}){
  if(!sleep?.screen)return null;
  return <section className="sleep-bubble" style={{left:sleep.screen.x,top:sleep.screen.y}} aria-label="Sleeping at home">
    <span className="sleep-zzz" aria-hidden="true">Z z z</span><strong>{sleep.saveError?'Ready to wake':'Sleeping…'}</strong><small>{sleep.homeName} · {sleep.remaining}s</small>
    <progress value={sleep.progress} max="1" aria-label="Sleep progress"/>
    <button onClick={sleep.saveError?onRetry:onWake}>{sleep.saveError?'Try waking again':'Wake up early'}</button>
  </section>;
}
