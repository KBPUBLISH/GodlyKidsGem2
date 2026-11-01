import React from 'react';
import {ItemIcon} from './ui.jsx';
import {RECIPES,canMake,missingLine} from './recipes.mjs';
import './recipe-book.css';

/** Available recipes craft on tap. Locked ones stay grey and name what is missing. */
export function RecipeBook({inventory,onCraft}){
  const stocks=inventory||{};
  return <section className="recipe-book" aria-label="Recipe book">
    <h2>Recipe book</h2>
    <div className="recipe-cards">
      {RECIPES.map(recipe=>{
        const known=canMake(stocks,recipe);
        const made=Object.keys(recipe.makes)[0];
        const missing=missingLine(stocks,recipe);
        return <button type="button" key={recipe.id} className={`recipe-card ${known?'known':'locked'}`} disabled={!known||!onCraft} onClick={()=>onCraft(recipe.id)} aria-label={known?`Make ${recipe.name}`:`${recipe.name}. Missing ${missing}`}>
          <span className="recipe-result" aria-hidden="true"><ItemIcon id={made} size={64}/></span>
          <span className="recipe-icons" aria-hidden="true">{Object.keys(recipe.needs).map(id=><ItemIcon key={id} id={id} size={32}/>)}<i>→</i><ItemIcon id={made} size={32}/></span>
          <strong>{recipe.name}</strong>
          <small>{known?`Tap to make · +${recipe.energy} energy`:`Missing: ${missing}`}</small>
        </button>;
      })}
    </div>
  </section>;
}

/** One short line above the island when a cook finishes a snack. */
export function RecipeBubble({bubble}){
  if(!bubble?.text)return null;
  return <div className="recipe-bubble" role="status" aria-live="polite"><strong>{bubble.name}</strong><p>{bubble.text}</p></div>;
}
