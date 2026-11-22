import {SELL_ITEMS} from './sell-prices.mjs';
export const MARKET_SEEDS=[{id:'potato_seed',name:'Potato',price:2,quantity:3},{id:'carrot_seed',name:'Carrot',price:2,quantity:3},{id:'pumpkin_seed',name:'Pumpkin',price:3,quantity:3},{id:'wheat_seed',name:'Wheat',price:2,quantity:3},{id:'sunflower_seed',name:'Sunflower',price:2,quantity:3}];
export function marketSellItems(inventory){return [...SELL_ITEMS,...Object.keys(inventory).filter(id=>id.endsWith('_wood')).map(id=>({id,name:id.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase()),price:1,group:'materials'})),{id:'stone',name:'Stone',price:1,group:'materials'}];}
/** Pure inventory/coin change; LivingFarm commits it through the shared app wallet. */
export function marketTrade(farm,inventory,kind,id){
 const row=kind==='buy'?MARKET_SEEDS.find(r=>r.id===id):kind==='sell'?marketSellItems(inventory).find(r=>r.id===id):null;
 if(!row||!Number.isSafeInteger(farm.coins)||farm.coins<0)return null;
 const have=inventory[id]||0;if(!Number.isSafeInteger(have)||have<0)return null;
 if(kind==='buy')return farm.coins<row.price?null:{farm:{...farm,coins:farm.coins-row.price},inventory:{...inventory,[id]:have+row.quantity}};
 return have<1?null:{farm:{...farm,coins:farm.coins+row.price},inventory:{...inventory,[id]:have-1}};
}
