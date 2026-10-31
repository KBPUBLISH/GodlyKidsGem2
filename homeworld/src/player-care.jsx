import React from 'react';
import {FOODS,energyFor,hungerFor,mealGain,restGain} from './nutrition.mjs';
import './player-care.css';

export function PlayerCare({view,name,dialogRef,onClose,onEat,onRest,onSleep,onGather}){
  const s=view.state,energy=Math.round(energyFor(s)),hunger=Math.round(hungerFor(s,view.minutes));
  const foods=Object.entries(FOODS).flatMap(([id,food])=>['inventory','farm'].flatMap(source=>{
    const count=(source==='farm'?s.livingFarm?.bag:s.inventory)?.[id]||0;
    return count>0?[{id,food,count,source}]:[];
  }));
  // Opened on canvas pointerup: its following click must not dismiss the tray.
  return <div className="player-care-shade" onPointerDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section ref={dialogRef} tabIndex={-1} className="player-care" role="dialog" aria-modal="true" aria-label="Food and energy" onClick={e=>e.stopPropagation()}>
      <header><strong>{name||'You'}</strong><button data-dialog-close aria-label="Back to island" onClick={onClose}>×</button></header>
      <div className="player-care-meters">
        <label>🍎 Tummy <b>{hunger}%</b><progress aria-label="Tummy" value={hunger} max="100"/></label>
        <label>⚡ Energy <b>{energy}%</b><progress aria-label="Energy" value={energy} max="100"/></label>
      </div>
      <div className="player-care-foods">{foods.map(({id,food,count,source})=><button key={`${source}-${id}`} disabled={view.busy||mealGain(s,id,view.minutes).total<=0} aria-label={`${id==='milk'?'Drink':'Eat'} ${food.name.toLowerCase()}${source==='farm'?' from farm':''}`} onClick={()=>onEat(id,source)}><span aria-hidden="true">{food.icon}</span><strong>{food.name} × {count}</strong><small>{energy===100&&hunger===100?'Full':id==='milk'?'Drink':'Eat'}</small></button>)}</div>
      {!foods.length&&<button className="player-care-gather" disabled={view.busy} onClick={onGather}>🥕 Find a snack</button>}
      <footer><button disabled={view.busy||restGain(s)<=0} onClick={onRest}>🌿 Take a breather</button>{view.nutrition?.homes?.length>0&&<button disabled={view.busy} onClick={onSleep}>🌙 Rest at home</button>}</footer>
      {view.busy&&<small role="status">Finishing up…</small>}
    </section>
  </div>;
}
