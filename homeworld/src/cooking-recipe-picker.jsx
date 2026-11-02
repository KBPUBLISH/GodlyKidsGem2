import React from 'react';
import {COOKING_RECIPES,canStartCooking,cookingCount,cookingRecipe} from './cooking.mjs';
import {CookingArt} from './cooking-art.jsx';
import {ItemIcon} from './ui.jsx';

export function CookingRecipePicker({state,ovenId,selected,onSelect,onStart,onExplore}){
 const choice=cookingRecipe(selected)||cookingRecipe('fish_chips');
 const recipes=['fish_chips','pumpkin_stew','garden_omelette'].map(cookingRecipe);
 return <>
  <div className="recipe-book-heading"><span>A LITTLE GARDEN. A LITTLE MAGIC.</span><h2>What would you like to cook?</h2><p>Choose a recipe to make in your kitchen.</p></div>
  <div className="recipe-book-cards" role="group" aria-label="Choose a recipe">{recipes.map(r=>{
   const available=canStartCooking(state,r,ovenId);return <button key={r.id} type="button" aria-pressed={choice.id===r.id} onClick={()=>onSelect(r.id)} className={`recipe-book-card ${available?'is-available':'is-missing'} ${choice.id===r.id?'is-selected':''}`}>
    <span className="recipe-book-check" aria-hidden="true">{choice.id===r.id?'✓':'+'}</span><CookingArt id={r.id} size={180}/><strong>{r.name}</strong><span className="recipe-book-availability">{available?'Ready to cook':'Gather ingredients'}</span>
    <span className="recipe-book-ingredients">{Object.entries(r.ingredients).map(([id,n])=><span key={id} className={cookingCount(state,id)>=n?'have':'need'}><ItemIcon id={id} size={24}/><span>{cookingCount(state,id)}/{n}</span><span className="recipe-ingredient-name">{id}</span></span>)}</span>
   </button>;
  })}</div>
  <button className="cooking-gold recipe-book-start" disabled={!canStartCooking(state,choice,ovenId)} onClick={()=>onStart(choice)}>{canStartCooking(state,choice,ovenId)?'Let’s cook!  ❯':'Gather ingredients first'}</button>
  {!canStartCooking(state,choice,ovenId)&&<p className="recipe-book-missing" role="status">You need {Object.entries(choice.ingredients).filter(([id,n])=>cookingCount(state,id)<n).map(([id,n])=>`${n-cookingCount(state,id)} more ${id}`).join(' and ')}. Find them on your island.</p>}
  <button className="cooking-link recipe-book-explore" onClick={onExplore}>Explore my kitchen</button>
  <aside className="recipe-book-shelf" aria-label="My pantry"><span>MY PANTRY</span><div>{[...new Set(COOKING_RECIPES.flatMap(r=>Object.keys(r.ingredients)))].map(id=><span key={id} className={choice.ingredients[id]?'needed':''}><ItemIcon id={id} size={30}/><b>{cookingCount(state,id)}</b><small>{id}</small></span>)}</div></aside>
 </>;
}
