// Veggie and nut/seed snacks a cook puts in the island bag.
// Ingredient energy matches nutrition.mjs FOODS when that item is already food.
// Seeds and nuts are not snacks on their own; NIBBLE is what a plain bite would be worth,
// and every crafted dish restores more than both bites added together.
import {FOODS} from './nutrition.mjs';

/** A plain bite of something that is not already a snack in FOODS. */
export const NIBBLE={
  wheat:12,sunflower:12,
  wheat_seed:10,sunflower_seed:10,pumpkin_seed:10,carrot_seed:8,apple_seed:8,
  pine_seed:8,oak_acorn:12,coconut:14,maple_samara:8,
};

export const ITEM_NAMES={
  carrot:'carrot',pumpkin:'pumpkin',wheat:'wheat',sunflower:'sunflower',apple:'apple',
  wheat_seed:'wheat seed',sunflower_seed:'sunflower seed',pumpkin_seed:'pumpkin seed',carrot_seed:'carrot seed',
  pine_seed:'pine seed',oak_acorn:'acorn',coconut:'coconut',maple_samara:'maple seed',apple_seed:'apple seed',
};

/** Energy a kid would get from one of this item today (a real snack, or a nibble of a seed or nut). */
export const partEnergy=id=>(FOODS[id]?.energy??0)||(NIBBLE[id]??0);

/**
 * Each dish uses two things the island already keeps in the bag.
 * `energy` is what eating the finished snack restores — more than both ingredients together.
 */
export const RECIPES=[
  {id:'garden_salad',name:'Garden salad',needs:{carrot:1,pumpkin:1},makes:{garden_salad:1},energy:72,says:'Two garden friends in one bowl!'},
  {id:'seed_crackers',name:'Seed crackers',needs:{wheat_seed:1,sunflower_seed:1},makes:{seed_crackers:1},energy:48,says:'Crunchy seeds, stuck together!'},
  {id:'nut_butter_greens',name:'Nut butter on greens',needs:{oak_acorn:1,sunflower:1},makes:{nut_butter_greens:1},energy:56,says:'Nut butter on garden greens!'},
  {id:'roasted_seeds',name:'Roasted seeds',needs:{pumpkin_seed:1,pine_seed:1},makes:{roasted_seeds:1},energy:44,says:'Warm seeds from the pan!'},
  {id:'veggie_stew',name:'Veggie stew',needs:{carrot:1,wheat:1},makes:{veggie_stew:1},energy:58,says:'Carrot and grain, bubbling!'},
  {id:'pumpkin_coconut',name:'Pumpkin coconut',needs:{pumpkin:1,coconut:1},makes:{pumpkin_coconut:1},energy:68,says:'Pumpkin and coconut, so sweet!'},
  {id:'apple_nut',name:'Apple nut bite',needs:{apple:1,oak_acorn:1},makes:{apple_nut:1},energy:46,says:'Apple and a nut, one bite!'},
  {id:'carrot_bites',name:'Carrot seed bites',needs:{carrot:1,sunflower_seed:1},makes:{carrot_bites:1},energy:52,says:'Carrot coins on little seeds!'},
];

export const recipeById=id=>RECIPES.find(r=>r.id===id)||null;
export const itemName=id=>ITEM_NAMES[id]||String(id||'').replace(/_/g,' ');
export const needsLine=recipe=>Object.keys(recipe.needs).map(itemName).join(', ');

export const canMake=(stocks,recipe)=>!!recipe&&Object.entries(recipe.needs).every(([id,n])=>(stocks?.[id]||0)>=n);

/** The best snack we can cook from what is on hand (highest energy, then book order). */
export function pickRecipe(stocks){
  return RECIPES.filter(r=>canMake(stocks,r)).sort((a,b)=>b.energy-a.energy||RECIPES.indexOf(a)-RECIPES.indexOf(b))[0]||null;
}

export function sameStocks(a,b){
  const keys=new Set([...(a?Object.keys(a):[]),...(b?Object.keys(b):[])]);
  for(const id of keys)if((a?.[id]||0)!==(b?.[id]||0))return false;
  return true;
}

/**
 * Spend a recipe's two ingredients and add the finished snack.
 * Pure: `stocks` is never changed. Unknown or short recipes return a copy with the same counts.
 */
export function combine(stocks,recipeId){
  const recipe=recipeById(recipeId);
  const next={...(stocks||{})};
  if(!recipe||!canMake(next,recipe))return next;
  for(const [id,n] of Object.entries(recipe.needs)){
    const left=(next[id]||0)-n;
    if(left>0)next[id]=left;else delete next[id];
  }
  for(const [id,n] of Object.entries(recipe.makes))next[id]=(next[id]||0)+n;
  return next;
}

/** Island day number, matching timeLabel (day 1 starts at minute 0). */
export const recipeDay=minutes=>Math.floor((minutes||0)/1440)+1;

/** True when this recipe already got its one feed notice today. */
export function noticed(state,recipeId,day){
  const book=state?.recipeNotices;
  return book?.day===day&&Array.isArray(book.ids)&&book.ids.includes(recipeId);
}
