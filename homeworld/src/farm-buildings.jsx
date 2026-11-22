import React from 'react';
import {Coins} from './living-farm-ui.jsx';
import {coopCapacity} from './living-farm-rules.mjs';
import './farm-shop.css';
export function CoopBuildings({farm,onBuild}){
 if(!farm)return null;
 return <section className="farm-homes" aria-label="Chicken coops"><div className="farm-section-title"><div><small>HAPPY HOMES</small><h2>Room for your chickens</h2></div><Coins value={farm.coins}/></div><div className="farm-home-grid">{[{level:1,name:'Little coop',price:20,capacity:3},{level:2,name:'Big coop',price:40,capacity:6}].map(c=>{const owned=farm.coop>=c.level,next=farm.coop===c.level-1;return <article className={`farm-home-card ${owned?'owned':''}`} key={c.level}><div className={`coop-drawing size-${c.level}`} aria-hidden="true"><img src="/homeworld/assets/coop-homes.webp" alt="" loading="lazy" decoding="async"/></div><strong>{c.name}</strong><span>Room for {c.capacity} chickens</span><small>{owned?'✓ Built':next?(c.level===2?'Upgrade your little coop':'Your first chicken home'):'Build the little coop first'}</small>{!owned&&<Coins value={c.price}/>}<button type="button" disabled={owned||!next} onClick={()=>onBuild?.('coop')}>{owned?'Built':!next?'Build little coop first':c.level===1?'Build coop':'Upgrade coop'}</button></article>;})}</div><p className="farm-home-note">{farm.coop?`${farm.animals.filter(a=>a.kind==='chicken').length} of ${coopCapacity(farm.coop)} chicken spaces filled. Buy chickens at the Market.`:'Build a coop, then visit the Market to choose chickens.'}</p></section>;
}
