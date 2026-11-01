import React from 'react';
import {ItemIcon} from './ui.jsx';
import {Coins} from './living-farm-ui.jsx';
import './market-sell.css';

/** Shared by the island shop and the built market stall. Keep each sale explicit. */
export function MarketSell({items,onSell}){
 const available=items.filter(item=>item.have>0);
 return <section className="market-sell" aria-label="Sell from your bag">
  <div className="market-sell-heading"><span aria-hidden="true">🧺</span><div><h2>Turn extras into coins</h2><p>Choose something from your bag. Keep what you need!</p></div></div>
  {available.length?<div className="market-sell-grid">{available.map(item=><article className="market-sell-card" key={item.id}>
   <div className="market-sell-picture">{item.emoji?<span aria-hidden="true">{item.emoji}</span>:<ItemIcon id={item.id} size={64}/>}<span className="market-sell-count" aria-label={`${item.have} in your bag`}>×{item.have}</span></div>
   <h3>{item.name}</h3><span className="market-sell-value">You get <Coins value={item.price}/></span>
   <button type="button" aria-label={`Sell one ${item.name} for ${item.price} coins`} onClick={()=>onSell(item.id)}>Sell 1 <span aria-hidden="true">→</span></button>
  </article>)}</div>:<div className="market-sell-empty"><ItemIcon id="carrot" size={60}/><h3>Your basket is waiting</h3><p>Harvest vegetables, catch a fish, or collect eggs. Bring your extras here to earn coins.</p></div>}
 </section>;
}
