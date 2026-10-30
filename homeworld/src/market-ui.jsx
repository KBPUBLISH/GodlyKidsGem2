import React from 'react';
import {ItemIcon} from './ui.jsx';

/** Sell card for the built market. Three groups, each row showing the bag count, the price, and Sell. */
export function MarketPanel({card, onSell}){
  if(!card) return <p>The market is gone. Build one from Build › Community.</p>;
  const coins = Number.isFinite(card.coins) ? card.coins : null;
  return <div className="sell-card">
    <div className="sell-purse"><span>Your coins</span><b>{coins === null ? '—' : coins}</b></div>
    <p className="catalogue-note">Sell extra fish, garden food, and diamonds. The coins are the same ones Adam uses to buy animals.</p>
    {card.groups.map(group => <section key={group.id} className="sell-group" aria-label={group.name}>
      <h2><span aria-hidden="true">{group.icon}</span> {group.name}</h2>
      {group.items.map(item => <article key={item.id} className="sell-row">
        <span className="sell-icon"><ItemIcon id={item.id} size={40}/></span>
        <div><strong>{item.name}</strong><small>{item.have} in the bag · {item.price} coin{item.price === 1 ? '' : 's'} each</small></div>
        <button type="button" disabled={!item.have} aria-label={item.have ? `Sell one ${item.name} for ${item.price} coins` : `No ${item.name} to sell`} onClick={() => onSell(item.id)}>{item.have ? `Sell · +${item.price}` : 'None'}</button>
      </article>)}
    </section>)}
  </div>;
}
