import React,{useState} from 'react';
import {ItemIcon} from './ui.jsx';
import {Coins} from './living-farm-ui.jsx';
import {MARKET_SEEDS,marketSellItems} from './living-market-rules.mjs';
import {MARKET_ANIMALS} from './living-farm-rules.mjs';
import './farm-shop.css';
import {MarketSell} from './market-sell.jsx';
export function LivingMarket({view,onBuy,onTrade,onUse,onBuild,onBuyAnimal}){
 const [tab,setTab]=useState('seeds'),farm=view.livingTest.farm,inventory=view.state.inventory;
 const animals=[...farm.offers.filter(o=>o.kind!=='coop').map(o=>({...o,id:o.kind,name:o.kind==='chicken'?'Chicken':'Cow',emoji:o.kind==='chicken'?'🐔':'🐄',local:true})),...MARKET_ANIMALS];
 const sell=[...['egg','milk'].map(id=>({id,name:id==='egg'?'Egg':'Milk',emoji:id==='egg'?'🥚':'🥛',price:id==='egg'?5:10,have:farm.bag[id]||0})),...marketSellItems(inventory).map(r=>({...r,have:inventory[r.id]||0}))];
 const priceHint=price=>farm.coins<price?`Need ${price-farm.coins} more coins`:null;
 return <div className="friendly-market"><div className="market-welcome"><span aria-hidden="true">🌻</span><div><small>YOUR ISLAND MARKET</small><h2>{tab==='sell'?'What will you sell today?':'What will you bring home?'}</h2><p>Grow a little. Share a little.</p></div><Coins value={farm.coins}/></div>
 <div className="market-nav" role="group" aria-label="Market sections">{[{id:'seeds',label:'Seeds',icon:'🌱'},{id:'animals',label:'Animals',icon:'🐔'},{id:'sell',label:'Sell',icon:'🧺'}].map(t=><button key={t.id} aria-pressed={tab===t.id} onClick={()=>setTab(t.id)}><span aria-hidden="true">{t.icon}</span>{t.label}</button>)}</div>
 {tab==='seeds'?<><p className="market-section-hint">Pick a packet. Every packet has 3 seeds.</p><div className="market-item-grid">{MARKET_SEEDS.map(s=><article className="market-item" key={s.id}><div className="market-item-art"><ItemIcon id={s.id}/></div><h3>{s.name}</h3><small>3 seeds · {inventory[s.id]||0} in your bag</small><Coins value={s.price}/><button disabled={farm.coins<s.price} aria-label={`Buy 3 ${s.name.toLowerCase()} seeds for ${s.price} coins`} onClick={()=>onTrade('buy',s.id)}>Buy seeds</button>{priceHint(s.price)&&<small>{priceHint(s.price)}</small>}</article>)}</div></>:tab==='animals'?<><button className="market-build-link" onClick={onBuild}><span aria-hidden="true">🏡</span><span><strong>Make room for new friends</strong><small>Coops & stables are in Build → Farm</small></span><b>→</b></button><div className="market-item-grid">{animals.map(a=><article className="market-item" key={a.id}><div className="market-item-art" aria-hidden="true">{a.emoji}</div><h3>{a.name}</h3><small>{a.id==='chicken'?`${farm.animals.filter(x=>x.kind==='chicken').length} chickens at home`:a.local?'Fresh milk for your island':'A new island friend'}</small><Coins value={a.price}/>{a.reason?<button disabled={!!farm.coop&&(a.id==='cow'||farm.coop>=2)} onClick={onBuild}>{farm.coop&&(a.id==='cow'||farm.coop>=2)?'All spaces filled':a.id==='chicken'?(farm.coop?'Upgrade coop →':'Build a coop →'):'Build a coop first →'}</button>:<button disabled={farm.coins<a.price} aria-label={`Buy a ${a.name.toLowerCase()} for ${a.price} coins`} onClick={()=>a.local?onBuy(a.kind):onBuyAnimal(a.id)}>Welcome home</button>}<small>{a.reason||priceHint(a.price)}</small></article>)}</div></>:<MarketSell items={sell} onSell={id=>id==='egg'||id==='milk'?onUse(id,'sell'):onTrade('sell',id)}/>}
 {farm.error&&<p role="alert" className="living-error">{farm.error}</p>}</div>;
}
export {LivingFriends} from './living-friends.jsx';
