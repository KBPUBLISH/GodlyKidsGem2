import React from 'react';
import {MarketSell} from './market-sell.jsx';
import {Coins} from './living-farm-ui.jsx';

export function MarketPanel({card,onSell}){
 if(!card)return <p>The market is gone. Build one from Build › Community.</p>;
 return <div className="friendly-market"><div className="market-sell-wallet"><span>Your island coins</span><Coins value={Number.isFinite(card.coins)?card.coins:'—'}/></div><MarketSell items={card.groups.flatMap(group=>group.items)} onSell={onSell}/></div>;
}
