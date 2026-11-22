/** Announce a catch only after inventory and statistics were saved together. */
export function bankFishingCatch(fishing){
 const g=fishing.g,a=fishing.a;let banked=false;
 try{
  const before=g.store.state;
  g.store.commit({type:'fish',spotId:fishing.spot.id,actionId:crypto.randomUUID()});
  if(g.store.state===before)throw Error('That fish could not be saved at the dock.');
  fishing.caught++;g.toast(`Caught a fish! ${fishing.caught} of ${fishing.target}`);
  g.status='Caught 1 fish · grill it on a campfire';if(a)a.caughtAny=true;banked=true;
 }catch(e){g.toast(e.message);}
 g.notify();return banked;
}
