// The built Market stall. Tapping it opens a Sell card. Coins go to the same purse
// Adam's animal purchase spends: the parent app's useUser().addCoins (gk-sell), which
// writes godly_kids_data_v6. There is no island wallet. A standalone island (the dev
// page, no parent) writes that same save so the number on the card still moves.
import {activeBuildings} from './building.mjs';
import {sellCard, quoteSell} from './sell-prices.mjs';
import {creditShipCoins} from './today-goals.mjs';

export class Stall {
  constructor(game){this.g = game;}

  card(){
    const g = this.g, menu = g.building?.openMenu;
    if(menu?.id !== 'market' || !g.store) return null;
    const stall = activeBuildings(g.store.state).find(b => b.id === menu.stallId && b.kind === 'market' && b.status === 'complete');
    if(!stall) return null;
    return {stallId:stall.id, coins:g.coinBalance(), groups:sellCard(g.store.state.inventory)};
  }

  /** Sell `qty` of one catalog item (default 1). Removes them from the bag, then credits the ship purse. */
  sell(item, qty = 1){
    const g = this.g, menu = g.building?.openMenu, stallId = menu?.stallId;
    const quote = quoteSell(item, qty);
    if(!quote){g.toast('The stall does not buy that.');return false;}
    const have = g.store?.state?.inventory?.[quote.id] || 0;
    if(have < quote.qty){g.toast(`No ${quote.name.toLowerCase()} in the bag.`);return false;}
    const before = g.store.state;
    try{
      g.store.commit({type:'sell', item:quote.id, qty:quote.qty, stallId, actionId:`sell:${quote.id}:${Date.now()}`});
    }catch(e){g.toast(e.message);return false;}
    if(g.store.state === before){g.toast('The market has to be built before it can buy anything.');return false;}
    this.pay(quote);
    g.toast(`Sold ${quote.qty} ${quote.name.toLowerCase()} for ${quote.coins} coin${quote.coins === 1 ? '' : 's'}.`);
    g.notify();
    return true;
  }

  pay(quote){
    const g = this.g;
    const embedded = typeof window !== 'undefined' && window.parent && window.parent !== window;
    if(embedded){
      const base = Number.isFinite(g.coinBalance()) ? g.coinBalance() : 0;
      g.coins = base + quote.coins;
      window.parent.postMessage({type:'gk-sell', item:quote.id, qty:quote.qty, coins:quote.coins, name:quote.name}, location.origin);
      return;
    }
    const next = creditShipCoins(quote.coins);
    g.coins = Number.isFinite(next) ? next : (Number.isFinite(g.coins) ? g.coins : 0) + quote.coins;
  }
}
