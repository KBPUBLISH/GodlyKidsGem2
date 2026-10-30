import React,{useState} from 'react';
import {animalName} from './living-farm-rules.mjs';
export function FarmPurchase({farm,onConfirm,onCancel}){
 const [name,setName]=useState('');const offer=farm.pending,coop=offer.kind==='coop',enough=farm.coins>=offer.price;
 return <><p>{coop?`Make room for ${offer.capacity} chickens.`:`Welcome a ${offer.kind} to your island. What will you name it?`}</p>
 {!coop&&<label className="farm-name">Animal’s name<input value={name} onChange={e=>setName(e.target.value)} maxLength={24} placeholder={offer.kind==='chicken'?'Sunny':'Daisy'} autoComplete="off"/></label>}
 <p className="farm-price">Costs {offer.price} coins · You have {farm.coins}</p><p>{enough?`You’ll have ${farm.coins-offer.price} coins left.`:'Pick ripe vegetables for 2 coins each, or sell eggs and milk.'}</p>
 {offer.reason&&<p>{offer.reason}</p>}{farm.error&&<p role="alert">{farm.error}</p>}
 <div className="food-actions"><button disabled={!enough||!!offer.reason||(!coop&&!animalName(name))} onClick={()=>onConfirm(name)}>{coop?'Build this coop':`Buy ${name.trim()||'this '+offer.kind}`} · {offer.price} coins</button><button onClick={onCancel}>Not now</button></div></>;
}
export function FarmPanel({farm,garden,onGarden,onBuy,onWalk}){
 return <><p><strong>{farm.coins} coins</strong> · Room for {2+farm.coop*2} chickens</p><p>{garden?.small&&'Pick ripe vegetables for 2 coins each. '}Collect eggs and milk to eat or sell.</p>
 {garden?.small&&<div className="food-actions"><button disabled={garden.busy||!garden.readyCount} onClick={onGarden}>{garden.readyCount?'Pick vegetables · +2 coins':'Vegetables are growing…'}</button></div>}
 {farm.animals.map(a=><article className="living-bag-row farm-animal" key={a.id}><span className="farm-emoji" aria-hidden="true">{a.kind==='chicken'?'🐔':'🐄'}</span><div><strong>{a.name}</strong><small>{a.ready?`${a.ready} ${a.kind==='chicken'?'egg'+(a.ready>1?'s':''):'milk'} ready`:`${a.kind==='chicken'?'Next egg':'More milk'} in about ${Math.max(1,Math.ceil(a.seconds/60))} min`}</small></div><button onClick={()=>onWalk(a.id)}>{a.ready?'Collect':'Visit'}</button></article>)}
 <div className="food-actions farm-shop">{farm.offers.filter(o=>farm.animals.length||o.kind==='chicken').map(o=><button key={o.kind} disabled={!!o.reason||farm.coins<o.price} onClick={()=>onBuy(o.kind)}><span>{o.kind==='coop'?(farm.coop?'Bigger coop':'Build a coop'):`Buy a ${o.kind}`}<small>{o.reason||(farm.coins<o.price?`${o.price} coins · need ${o.price-farm.coins} more`:`${o.price} coins`)}</small></span></button>)}</div>
 <p className="farm-note">The first egg comes soon. After that, animals make more about every 3 minutes. Up to 3 wait for you while you’re away.</p>{farm.error&&<p role="alert">{farm.error}</p>}</>;
}
export function FarmFood({farm,onUse}){
 return <>{['egg','milk'].filter(k=>farm.bag[k]>0).map(k=><article className="farm-food" key={k}><strong>{k==='egg'?'🥚 Eggs':'🥛 Milk'} · {farm.bag[k]}</strong><div className="food-actions"><button onClick={()=>onUse(k,'eat')}>{k==='egg'?'Eat 1 egg':'Drink 1 milk'}</button><button onClick={()=>onUse(k,'sell')}>Sell 1 · +{k==='egg'?5:10} coins</button></div></article>)}</>;
}
