/** Durable cooking transactions. Saved atomically with inventory by GameStore.
 * A monotonically increasing sequence rejects stale starts, even after cancellation.
 * Each step carries its expected index. Escrow remembers the original bag for refunds.
 */
export const COOKING_RECIPES = [
 {id:'pumpkin_stew',name:'Pumpkin Stew',ingredients:{pumpkin:1,carrot:1},steps:[{action:'slice',station:'prep',prompt:'Slide the knife down the glowing line',count:3},{action:'add',station:'pot',prompt:'Drag into the pot',count:1},{action:'stir',station:'pot',prompt:'Stir!',count:1}],seconds:5,meal:'pumpkin_stew',energy:55,minLevel:1},
 {id:'garden_omelette',name:'Garden Omelette',ingredients:{egg:2,carrot:1},steps:[{action:'crack',station:'prep',prompt:'Tap each egg to crack it',count:2},{action:'stir',station:'pot',prompt:'Mix in circles!',count:1},{action:'add',station:'pot',prompt:'Pour into the pan',count:1}],seconds:5,meal:'garden_omelette',energy:45,minLevel:1},
 {id:'fish_chips',name:'Fish and Chips',ingredients:{fish:1,potato:2},steps:[{action:'slice',station:'prep',label:'Cut fries',prompt:'Cut the potato lengthwise into fries',count:3},{action:'prepare',station:'prep',label:'Coat fish',prompt:'Coat both sides of the fish in batter',count:2},{action:'bake',station:'oven',label:'Bake',prompt:'Put the tray on the oven shelf',count:1}],seconds:6,meal:'fish_chips',energy:60,minLevel:1},
];
export const cookingRecipe=id=>COOKING_RECIPES.find(r=>r.id===id);
export const cookingCount=(state,id)=>(state.inventory?.[id]||0)+(id==='egg'?(state.livingFarm?.bag?.egg||0):0);
export const cookingOven=(state,id)=>state.buildings?.find(b=>b.id===id&&b.kind==='oven'&&b.status==='complete');
export const ovenLevel=oven=>Math.max(1,Math.min(5,Math.floor(oven?.cookingLevel||1)));
export const cookingSeconds=(recipe,oven)=>Math.max(2,recipe.seconds*(1-.12*(ovenLevel(oven)-1)));
export function canStartCooking(state,recipe,ovenId){return !!recipe&&!!cookingOven(state,ovenId)&&ovenLevel(cookingOven(state,ovenId))>=recipe.minLevel&&Object.entries(recipe.ingredients).every(([id,n])=>cookingCount(state,id)>=n);}
export function applyCooking(state,a,wall=Date.now()){
 const ledger=state.cooking||{sequence:0,session:null},session=ledger.session;
 if(a.type==='cooking_start'){
  const recipe=cookingRecipe(a.recipe),oven=cookingOven(state,a.ovenId);
  if(a.sequence!==ledger.sequence||session||!canStartCooking(state,recipe,a.ovenId))return state;
  const next=structuredClone(state),escrow=[];
  for(const [id,n]of Object.entries(recipe.ingredients)){
   const take=Math.min(next.inventory[id]||0,n);next.inventory[id]=(next.inventory[id]||0)-take;if(take)escrow.push({id,n:take,bag:'inventory'});
   if(n>take){next.livingFarm.bag[id]-=n-take;escrow.push({id,n:n-take,bag:'farm'});}
  }
  const sequence=ledger.sequence+1;
  next.cooking={sequence,session:{id:sequence,recipe:recipe.id,ovenId:a.ovenId,phase:'prep',step:0,escrow,seconds:cookingSeconds(recipe,oven)}};
  return next;
 }
 if(!session||a.sessionId!==session.id)return state;
 const recipe=cookingRecipe(session.recipe);if(!recipe)return state;
 if(a.type==='cooking_step'){
  if(session.phase!=='prep'||a.step!==session.step)return state;
  const next=structuredClone(state),s=next.cooking.session;s.step++;
  if(s.step>=recipe.steps.length){s.phase='cooking';s.readyAt=wall+s.seconds*1000;}
  return next;
 }
 if(a.type==='cooking_collect'){
  if(session.phase!=='cooking'||wall<session.readyAt)return state;
  const next=structuredClone(state);next.inventory[recipe.meal]=(next.inventory[recipe.meal]||0)+1;
  next.cooking.session.phase='collected';next.cooking.session.escrow=[];
  next.stats??={};next.stats.foodPrepared=(next.stats.foodPrepared||0)+1;
  return next;
 }
 if(a.type==='cooking_cancel'){
  if(session.phase==='collected')return state;
  const next=structuredClone(state);
  for(const e of session.escrow){if(e.bag==='farm'){next.livingFarm??={};next.livingFarm.bag??={};}const bag=e.bag==='farm'?next.livingFarm.bag:next.inventory;bag[e.id]=(bag[e.id]||0)+e.n;}
  next.cooking.session=null;return next;
 }
 if(a.type==='cooking_done'&&session.phase==='collected'){const next=structuredClone(state);next.cooking.session=null;return next;}
 return state;
}
