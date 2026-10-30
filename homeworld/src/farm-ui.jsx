import React from 'react';
import './farm-ui.css';

/**
 * Adam's farm card and speech bubble. The card is the one place the farm asks the kid for something:
 * animals cost gold coins, and only the kid (through the parent app) can spend them.
 *   view.farm.request → {id,kind,qty,price,text,name,emoji,paying,coins,short,inApp}
 */
export function FarmCard({farm,onRun}){
  const req=farm?.request;
  if(!req)return null;
  const short=req.short>0,adam=farm.adam;
  return <div className="farm-card" role="dialog" aria-label={`Adam asks: ${req.text}`}>
    <div className="farm-card-face" aria-hidden="true">{adam?.imageUrl?<img src={adam.imageUrl} alt=""/>:<span>🧑‍🌾</span>}</div>
    <div className="farm-card-body">
      <strong>{adam?.name||'Adam'} asks</strong>
      <p>{req.text}</p>
      <div className="farm-card-price"><span className="farm-card-emoji" aria-hidden="true">{req.emoji}</span><b>{req.price}</b> gold coins{req.coins!==null&&<small>· you have {req.coins}</small>}</div>
      {short&&<div className="farm-card-short">Need <b>{req.short}</b> more coins. Games and quizzes on the ship earn coins!</div>}
      <div className="farm-card-actions">
        {short&&req.inApp
          ? <button type="button" className="earn" onClick={()=>onRun(g=>g.farmer?.earn())}>Earn coins</button>
          : <button type="button" disabled={req.paying} onClick={()=>onRun(g=>g.farmer?.buy())}>{req.paying?'Paying…':'Buy'}</button>}
        <button type="button" className="plain" disabled={req.paying} onClick={()=>onRun(g=>g.farmer?.decline())}>Not now</button>
      </div>
    </div>
  </div>;
}

/** Adam thinking out loud above his head. */
export function FarmBubble({farm}){
  const b=farm?.bubble;
  if(!b)return null;
  return <div className="farm-bubble" style={{left:b.x,top:b.y}} role="status" aria-live="polite"><strong>{farm.adam?.name||'Adam'}</strong><p>{b.text}</p></div>;
}
