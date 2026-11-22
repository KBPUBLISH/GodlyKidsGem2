import React from 'react';
import {animalShop} from './animals.mjs';
import {ANIMALS} from './animals.mjs';

/** Farm-animal picker: prices, wild badges, and the gold-coin confirm. */
export function AnimalFarm({view,onRun}){
  const shop=view.animals||{},coins=shop.coins,confirming=shop.confirming;
  const total=view.state.animals?.length||0;
  return <div className="animal-farm">
    <h3 className="animal-farm-title">Farm animals <small>{total} on the island</small></h3>
    <div className="animal-grid" role="group" aria-label="Place a farm animal">{ANIMALS.map(a=>{
      const info=animalShop(a.id),here=view.state.animals?.filter(x=>x.kind===a.id).length||0;
      const short=!info.wild&&typeof coins==='number'&&coins<info.price;
      const price=info.wild?'Wild':short?`Need ${info.price-coins} coins`:info.herds?`${info.price} · herds ${info.herds}`:`${info.price} coins`;
      return <button key={a.id} type="button" disabled={info.wild||short} className={`animal-card ${info.wild?'wild':''} ${short?'short':''} ${shop.placing?.kind===a.id?'placing':''}`} aria-label={info.wild?`${a.name} is wild`:`Buy a ${a.name.toLowerCase()} for ${info.price} coins${here?`. ${here} on the island`:''}`} onClick={()=>onRun(g=>g.animals?.beginPlace(a.id))}>
        <span className="animal-emoji" aria-hidden="true">{a.emoji}</span>
        <span className="animal-name">{a.name}</span>
        <span className="animal-price">{price}</span>
        {here>0&&<i className="animal-count" aria-hidden="true">{here}</i>}
      </button>;
    })}</div>
    {confirming&&<div className="animal-confirm" role="dialog" aria-label={`Buy a ${confirming.name}`}>
      <p>Buy a {confirming.name.toLowerCase()} for <b>{confirming.price}</b> gold coins?</p>
      <div><button type="button" onClick={()=>onRun(g=>g.animals?.confirmBuy())}>Buy</button><button type="button" className="plain" onClick={()=>onRun(g=>g.animals?.cancelPlace())}>Not now</button></div>
    </div>}
    <p className="action-menu-tip">Fences keep a herd in. A scarecrow covers a 10×10 patch from crows. Sheep need a stable at night. After day 7, coyotes, crows and snakes show up.</p>
  </div>;
}
