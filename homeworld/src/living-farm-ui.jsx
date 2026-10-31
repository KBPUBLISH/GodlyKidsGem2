import React,{useState} from 'react';
import {Icon} from './ui.jsx';
import {animalName} from './living-farm-rules.mjs';

export function Coins({value}){
 return <span className="living-coins"><i aria-hidden="true"/><b>{value}</b><span className="living-sr-only"> coins</span></span>;
}
export function FarmPurchase({farm,onConfirm,onCancel}){
 const [name,setName]=useState('');
 const offer=farm.pending,coop=offer.kind==='coop',enough=farm.coins>=offer.price;
 return <>
  <div className="farm-purchase-hero"><span className="living-emoji" aria-hidden="true">{coop?'🏡':offer.kind==='chicken'?'🐔':'🐄'}</span>
   {coop?<strong aria-label={`Room for ${offer.capacity} chickens`}>🐔 × {offer.capacity}</strong>:<label className="farm-name">Name<input aria-label="Animal’s name" value={name} onChange={e=>setName(e.target.value)} maxLength={24} placeholder={offer.kind==='chicken'?'Sunny':'Daisy'} autoComplete="off"/></label>}
  </div>
  <div className="farm-price"><span>Have <Coins value={farm.coins}/></span>{enough?<span>Left <Coins value={farm.coins-offer.price}/></span>:<span>Need <Coins value={offer.price-farm.coins}/></span>}</div>
  {offer.reason&&<p className="living-error">{offer.reason}</p>}{farm.error&&<p role="alert" className="living-error">{farm.error}</p>}
  <div className="food-actions"><button aria-label={coop?`Build this coop · ${offer.price} coins`:`Buy ${name.trim()||'this '+offer.kind} · ${offer.price} coins`} disabled={!enough||!!offer.reason||(!coop&&!animalName(name))} onClick={()=>onConfirm(name)}>{coop?'Build':'Buy'} <Coins value={offer.price}/></button><button aria-label="Not now" onClick={onCancel}>Later</button></div>
 </>;
}
export function FarmPanel({farm,garden,onGarden,onBuy,onWalk}){
 return <>
  <div className="farm-wallet" aria-label={`You have ${farm.coins} coins. Room for ${2+farm.coop*2} chickens.`}><Coins value={farm.coins}/><span>🐔 {farm.animals.filter(a=>a.kind==='chicken').length} / {2+farm.coop*2}</span></div>
  {garden?.small&&<div className="food-actions"><button aria-label={garden.phase==='harvest'?'Pick vegetables · +2 coins':garden.phase==='water'?'Water vegetables':garden.label} disabled={garden.busy||garden.phase==='wait'} onClick={onGarden}><Icon type={garden.phase==='water'?'water':garden.phase==='plant'?'plant':'harvest'} size={30}/>{garden.phase==='harvest'?<>Pick <Coins value="+2"/></>:garden.phase==='water'?'Water':garden.phase==='plant'?'Plant':`Growing · ${garden.timer}`}</button></div>}
  {farm.animals.map(a=><article className="living-bag-row farm-animal" key={a.id}><span className="farm-emoji" aria-hidden="true">{a.kind==='chicken'?'🐔':'🐄'}</span><div><strong>{a.name}</strong><small>{a.ready?<>{a.kind==='chicken'?'🥚':'🥛'} × {a.ready}</>:<>⏳ {Math.max(1,Math.ceil(a.seconds/60))} min</>}</small></div><button onClick={()=>onWalk(a.id)}>{a.ready?'Collect':'Visit'}</button></article>)}
  <div className="food-actions farm-shop">{farm.offers.filter(o=>farm.animals.length||o.kind==='chicken').map(o=><button key={o.kind} aria-label={`${o.kind==='coop'?(farm.coop?'Bigger coop':'Build a coop'):`Buy a ${o.kind}`} · ${o.price} coins${o.reason?'. '+o.reason:''}`} disabled={!!o.reason||farm.coins<o.price} onClick={()=>onBuy(o.kind)}><span className="farm-emoji" aria-hidden="true">{o.kind==='coop'?'🏡':o.kind==='chicken'?'🐔':'🐄'}</span><span>{o.kind==='coop'?'Coop':o.kind==='chicken'?'Chicken':'Cow'}<small>{o.reason?(o.kind==='cow'?'Coop first':o.kind==='chicken'?'Bigger coop':'Full'):<Coins value={o.price}/>}</small></span></button>)}</div>
  {farm.error&&<p role="alert" className="living-error">{farm.error}</p>}
 </>;
}
export function FarmFood({farm,onUse}){
 return <>{['egg','milk'].filter(k=>farm.bag[k]>0).map(k=><article className="farm-food" key={k}><strong aria-label={`${farm.bag[k]} ${k==='egg'?'eggs':'milk'}`}><span className="farm-emoji" aria-hidden="true">{k==='egg'?'🥚':'🥛'}</span> × {farm.bag[k]}</strong><div className="food-actions"><button aria-label={k==='egg'?'Eat 1 egg':'Drink 1 milk'} onClick={()=>onUse(k,'eat')}><Icon type="food" size={28}/>{k==='egg'?'Eat':'Drink'}</button><button aria-label={`Sell 1 · +${k==='egg'?5:10} coins`} onClick={()=>onUse(k,'sell')}>Sell <Coins value={k==='egg'?'+5':'+10'}/></button></div></article>)}</>;
}
