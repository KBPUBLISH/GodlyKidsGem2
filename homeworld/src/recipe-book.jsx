import React from 'react';
import {ItemIcon} from './ui.jsx';
import {RECIPES,canMake,needsLine} from './recipes.mjs';
import './recipe-book.css';

/** Known snacks are lit. Locked ones stay grey and name the two ingredients. */
export function RecipeBook({inventory}){
  const stocks=inventory||{};
  return <section className="recipe-book" aria-label="Recipe book">
    <h2>Recipe book</h2>
    <div className="recipe-cards">
      {RECIPES.map(recipe=>{
        const known=canMake(stocks,recipe);
        const made=Object.keys(recipe.makes)[0];
        return <article key={recipe.id} className={`recipe-card ${known?'known':'locked'}`}>
          <span className="recipe-icons" aria-hidden="true">{Object.keys(recipe.needs).map(id=><ItemIcon key={id} id={id} size={32}/>)}<i>→</i><ItemIcon id={made} size={32}/></span>
          <strong>{recipe.name}</strong>
          <small>{known?`+${recipe.energy} energy`:`Needs: ${needsLine(recipe)}`}</small>
        </article>;
      })}
    </div>
  </section>;
}

/** One short line above the island when a cook finishes a snack. */
export function RecipeBubble({bubble}){
  if(!bubble?.text)return null;
  return <div className="recipe-bubble" role="status" aria-live="polite"><strong>{bubble.name}</strong><p>{bubble.text}</p></div>;
}
