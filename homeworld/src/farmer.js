/**
 * Adam's farm brain — the runtime (farm-rules.mjs holds the pure rules).
 *
 * Adam is a story friend like any other (residents.js moves him); this class only decides *what farm
 * work he does* and carries it out when he arrives:
 *   · plans a paddock around the stable, puts a water trough and a feed pile inside it, then fences
 *     the ring piece by piece (gate last) through the ordinary place_building reducer — paid in wood
 *     and energy like anyone else, never starving the village plan;
 *   · a daily routine: morning feed + water (eggs, milk and wool are gathered then), a midday fence
 *     check (mends coyote damage), dusk head-count (loose livestock are walked into the stable);
 *   · raises the one thing he cannot do alone: animals cost the kid gold coins. The island shows his
 *     card (farm-ui.jsx); Buy posts gk-buy-animal to the parent app, which owns the balance and
 *     replies gk-animal-purchased (approved, nothing spent yet) / gk-animal-denied. New animals land at
 *     the dock, Adam walks over and names them, and they are herded into the stable. Coins are spent
 *     only when the island confirms receipt (gk-animal-received {qty}); if the boat could not land
 *     anything the approval is dropped (gk-animal-refund) and nothing is charged.
 *
 * Hooks: residents.pickChore pulls `chores()`; residents.finishChore hands `kind:'farm'` chores to
 * `finish()`; world.js ticks `update()` and reads `snapshot()`.
 */
import {gameTime,timeLabel,buildSiteStatus,strokePlacementStatus,terrainType,animalPlacementStatus,dist,cellFromKey} from './core.mjs';
import {footprint,activeBuildings,workPoint,buildingById,woodTotal,BUILD_ENERGY,pointInBounds} from './building.mjs';
import {energyFor} from './nutrition.mjs';
import {skillFor} from './character-skills.mjs';
import {enclosureMap,regionAt,nearStable} from './fencing.mjs';
import {animalById} from './animals.mjs';
import {noteEvent} from './island-feed.mjs';
import {checkIn,speakRefusal} from './foreman-check.mjs';
import * as R from './farm-rules.mjs';

const SCAN_MS=2500,PAY_TIMEOUT_MS=20000,BUBBLE_MS=5200,ROUNDUP='farmer:adam';
const STABLE_DEF={wood:20,stone:8};

export class Farmer{
  constructor(game){
    this.g=game;
    this.lastScan=0;
    this.told=new Map();
    this.planRev=null;this.planCache=null;this.planSig='';
    this.statusRev=null;this.statusCache=null;
    this.bubble=null;
    this.foremanTold={};
    this.arrival=null;          // {requestId, ids:[animalId], stage:'dock'|'in', met:boolean}
    this.payingSince=0;
    this.coinsShort=null;       // last "need N more" from the parent, for the card
    this.onMessage=(event)=>{
      if(event.origin!==location.origin||!event.data?.type)return;
      if(event.data.type==='gk-animal-purchased')this.onPurchased(event.data);
      if(event.data.type==='gk-animal-denied')this.onDenied(event.data);
    };
    window.addEventListener('message',this.onMessage);
  }

  /* ---------------- who and where ---------------- */
  /** Adam's actor (the friend with the farmer skill), or null when he is not ashore. */
  adam(){
    for(const [,actor] of this.g.residents?.models||[]){if(skillFor(actor.userData?.name)?.id==='farmer')return actor;}
    const s=this.state(),me=s?.characters?.[s.activeCharacter];
    if(me&&skillFor(me.name)?.id==='farmer'&&this.g.actor)return this.g.actor;
    return null;
  }
  isAdam(home){return !!home&&skillFor(home.name)?.id==='farmer';}
  active(){const g=this.g,s=g.store?.state;return !!(s&&g.loaded&&g.playersOnly&&!g.ambient&&!g.store.locked);}
  state(){return this.g.store?.state;}
  ranch(s=this.state()){return R.ensureRanch(s?.farm);}
  day(s=this.state()){return timeLabel(gameTime(s)).day;}
  stables(s){return R.completeOf(s,R.STABLE_KIND);}

  /** The paddock plan for the current stables (cached per save revision; recomputed when the stables change). */
  plan(s=this.state()){
    if(!s)return null;
    const kid=s.farm?.ranch?.kidFence;
    if(kid?.stable?.key){
      const drawn={side:'down',ring:kid.ring||[],gate:kid.gate||null,inside:kid.inside||[],ok:true,sig:'kid'};
      if(drawn.ring.length){drawn.blocked=this.blockedCells(s,drawn);drawn.ok=drawn.blocked.length===0;}
      else drawn.blocked=[];
      return drawn;
    }
    const stables=this.stables(s);
    const sig=stables.map(b=>`${b.id}@${b.key}/${b.rotation}`).join('|');
    if(sig===this.planSig&&this.planCache!==undefined&&this.planRev===s.revision)return this.planCache;
    this.planRev=s.revision;
    if(!stables.length){this.planSig=sig;this.planCache=null;return null;}
    // A plan already chosen for these stables stays put (so the ring never flips sides mid-build); only its blocked cells are re-checked.
    const saved=this.ranch(s).paddock;
    if(saved&&saved.sig===sig){this.planSig=sig;this.planCache={...saved,blocked:this.blockedCells(s,saved),ok:true};this.planCache.ok=this.planCache.blocked.length===0;return this.planCache;}
    const world=this.g.world,min=gameTime(s);
    const fps=stables.map(b=>footprint(world,b)).filter(Boolean);
    const capacity=Math.max(R.STABLE_CAPACITY*stables.length,R.herdCount(s));
    const centre=this.g.village?.centre?.(s)||s.player;
    const toward={col:centre.x-world.grid.origin[0],row:centre.y-world.grid.origin[1]};
    const plan=R.paddockPlan(fps,capacity,{cellOk:k=>this.cellOk(s,k),ringOk:k=>this.ringOk(s,k,min),toward});
    this.planSig=sig;this.planCache=plan?{...plan,sig}:null;
    if(plan)this.mutate(n=>{n.farm.ranch.paddock={sig,side:plan.side,interior:plan.interior,ring:plan.ring,gate:plan.gate,inside:plan.inside};},false);
    return this.planCache;
  }
  blockedCells(s,plan){
    const min=gameTime(s);
    return [...plan.inside.filter(k=>!this.cellOk(s,k)).map(k=>({key:k,where:'inside'})),...plan.ring.filter(k=>!this.ringOk(s,k,min)).map(k=>({key:k,where:'ring'}))];
  }
  /** Grass a paddock may cover: dry grass, no garden, no building other than stables and fences. */
  cellOk(s,k){
    const world=this.g.world,p=cellFromKey(world,k);
    if(terrainType(world,p.x,p.y)!==2||s.cells?.[k]?.soil||world.gardenSlots?.some(g=>g.key===k))return false;
    for(const b of activeBuildings(s)){
      if(b.kind===R.STABLE_KIND||R.FENCE_KINDS.has(b.kind)||b.kind===R.TROUGH_KIND||b.kind===R.FEED_KIND)continue;
      const fp=footprint(world,b);if(fp&&pointInBounds(p,fp.bounds,.02))return false;
    }
    return true;
  }
  /** A fence may stand here (or already does). The kid standing on the cell is not counted as a block. */
  ringOk(s,k,min){
    if((s.buildings||[]).some(b=>b.status==='complete'&&R.FENCE_KINDS.has(b.kind)&&b.key===k))return true;
    return buildSiteStatus(this.g.world,{...s,player:{x:-9999,y:-9999}},{kind:R.FENCE_KIND,key:k,rotation:0},min).ok;
  }
  status(s=this.state()){
    if(!s)return null;
    if(this.statusRev===s.revision&&this.statusCache)return this.statusCache;
    this.statusRev=s.revision;this.statusCache=R.farmStatus(s,this.plan(s));
    return this.statusCache;
  }
  /** Centre of a grid cell. */
  at(k){return cellFromKey(this.g.world,k);}
  /** The cell just outside the gate, where Adam stands to count everyone in and where new animals wait. */
  gateOut(plan){
    if(!plan)return null;
    const [c,r]=R.parseKey(plan.gate),d={down:[0,1],up:[0,-1],right:[1,0],left:[-1,0]}[plan.side]||[0,1];
    const p=this.at(R.key(c+d[0],r+d[1]));
    return this.g.nav?.nearest?.(p,2)||p;
  }
  /** Where boats land: the harbour dock, else the fishing shore, else outside the gate. */
  dockPoint(s,plan){
    const world=this.g.world,dock=R.completeOf(s,'dock')[0];
    if(dock){const w=workPoint(world,dock);return this.g.nav?.nearest?.(w,3)||w;}
    const spot=world.fishingSpots?.[0];
    if(spot)return {x:spot.position[0],y:spot.position[1]};
    return this.gateOut(plan)||{...s.player};
  }
  /** Spread stall spots inside a stable for `n` animals. */
  stalls(s,n){
    const fps=this.stables(s).map(b=>footprint(this.g.world,b)).filter(Boolean);
    if(!fps.length)return [];
    const out=[];
    for(let i=0;i<n;i++){const fp=fps[i%fps.length],j=Math.floor(i/fps.length),u=(j%3)/2,v=Math.floor(j/3)%2;out.push({x:fp.x+.55+u*Math.max(0,fp.w-1.1),y:fp.y+.45+v*Math.max(0,fp.h-.9)});}
    return out;
  }
  /** Points to put the new animals on: dry land around the landing spot, clear of buildings. */
  arrivalSpots(s,plan,n){
    const world=this.g.world,anchor=this.dockPoint(s,plan),out=[];
    for(let ring=0;ring<4&&out.length<n;ring++){
      const r=1+ring*.9;
      for(let i=0;i<8&&out.length<n;i++){
        const a=i/8*Math.PI*2+ring*.4,p={x:anchor.x+Math.cos(a)*r,y:anchor.y+Math.sin(a)*r};
        if(terrainType(world,p.x,p.y)===0||!animalPlacementStatus(world,s,{kind:'chicken',x:p.x,y:p.y}).ok)continue;
        if(out.some(q=>dist(q,p)<.8))continue;
        out.push(p);
      }
    }
    return out;
  }
  /** A 2×1 (trough) or 1×1 (feed pile) spot inside the paddock, on the gate side so Adam can reach over the fence. */
  spotInside(s,plan,kind){
    const min=gameTime(s),[gc,gr]=R.parseKey(plan.gate),cells=[...plan.inside].sort((a,b)=>{const [ac,ar]=R.parseKey(a),[bc,br]=R.parseKey(b);return Math.hypot(ac-gc,ar-gr)-Math.hypot(bc-gc,br-gr);});
    const rotations=kind===R.TROUGH_KIND?[0,1]:[0];
    const inside=new Set(plan.inside);
    for(const k of cells)for(const rotation of rotations){
      const fp=footprint(this.g.world,{kind,key:k,rotation});
      if(!fp||!fp.keys.every(x=>inside.has(x)))continue;
      if(buildSiteStatus(this.g.world,{...s,player:{x:-9999,y:-9999}},{kind,key:k,rotation},min).ok)return {key:k,rotation,center:fp.center};
    }
    return null;
  }
  /** Reach a building from outside the fence. */
  reachPoint(s,kind){const b=R.completeOf(s,kind)[0];return b?footprint(this.g.world,b)?.center||null:null;}

  /* ---------------- save helpers ---------------- */
  mutate(fn,notify=true){
    const store=this.g.store;if(!store||store.locked)return false;
    const next=structuredClone(store.state);
    next.farm={integrity:{},pendingToasts:[],...(next.farm||{})};
    next.farm.ranch=R.ensureRanch(next.farm);
    next.village=next.village||{};
    const out=fn(next);
    if(out===false)return false;
    try{store.save(next);}catch(e){this.g.toast(e.message);return false;}
    if(notify)this.g.notify?.();
    return true;
  }
  tellOnce(key,text,ms=4200){const now=performance.now();if((this.told.get(key)||0)>now-60000)return;this.told.set(key,now);this.g.toast(text,ms);}
  say(text,ms=BUBBLE_MS){this.bubble={text,until:performance.now()+ms};this.g.notify?.();}
  feed(kind,text){try{noteEvent(kind,text,{who:'Adam'});}catch{/* best effort */}}
  post(msg){if(window.parent&&window.parent!==window)window.parent.postMessage(msg,location.origin);}

  /* ---------------- tick ---------------- */
  update(){
    if(!this.active())return;
    const now=performance.now();
    if(now-this.lastScan<SCAN_MS)return;
    this.lastScan=now;
    const s=this.state();
    if(s.night)return;
    const adam=this.adam();
    this.settleArrival(s);
    this.tickRequest(s,adam);
    this.maybeStable(s,adam);
    if(this.bubble&&now>this.bubble.until){this.bubble=null;this.g.notify?.();}
  }

  /**
   * The stable's row slot. The foreman already said yes; this only turns that spot into a place to walk.
   * It does not search the grass around camp.
   */
  farmSite(s,spot){
    if(!spot?.key)return null;
    const world=this.g.world;
    const plan={kind:R.STABLE_KIND,key:spot.key,rotation:spot.rotation??0};
    const fp=footprint(world,plan);
    if(!fp||!buildSiteStatus(world,s,plan,gameTime(s)).ok)return null;
    return {key:plan.key,rotation:plan.rotation,center:fp.center,work:workPoint(world,plan)};
  }
  /** No stable yet: the one thing that blocks the whole farm. Says so (once a minute) when the materials are short. */
  maybeStable(s,adam){
    if(!adam||this.stables(s).length)return;
    if(woodTotal(s)<STABLE_DEF.wood||(s.inventory.stone||0)<STABLE_DEF.stone)this.tellOnce('stable:materials',`Adam wants to build a stable for the animals: ${STABLE_DEF.wood} wood and ${STABLE_DEF.stone} stone. He is gathering what he can.`,4600);
  }

  /** Keep the open request honest: raise one when the farm is ready, drop it when it stops being ready, time out a payment that never answered. */
  tickRequest(s,adam){
    const ranch=this.ranch(s),st=this.status(s),min=gameTime(s),req=ranch.request;
    if(req){
      if(req.status==='paying'&&performance.now()-this.payingSince>PAY_TIMEOUT_MS){
        this.mutate(n=>{n.farm.ranch.request={...req,status:'open'};});
        this.g.toast('The coins did not go through. You can try again.');
        return;
      }
      if(req.status==='arriving'&&!this.arrival){this.arrival={requestId:req.id,ids:req.animalIds||[],stage:'in',met:true};this.herdIn(s,this.arrival.ids);}
      if(req.status==='open'&&(!R.canAsk(st)||R.allowedQty(s,req.qty)<req.qty)){
        const qty=R.allowedQty(s,req.qty);
        if(R.canAsk(st)&&qty>0)this.mutate(n=>{n.farm.ranch.request={...req,qty,price:R.bundlePrice(req.kind,qty),text:R.requestLine(req.kind,qty,st)};});
        else this.mutate(n=>{n.farm.ranch.request=null;n.village=R.closeRequest(n.village,req.id,'declined');});
      }
      return;
    }
    if(!adam||!R.canAsk(st)||min<ranch.askAgainAt)return;
    const next=R.nextRequest(s);if(!next)return;
    const text=R.requestLine(next.kind,next.qty,st),id=`farm:animals:${Date.now().toString(36)}`;
    this.mutate(n=>{
      n.farm.ranch.request={id,...next,status:'open',createdAt:Date.now(),text};
      n.village=R.upsertRequest(n.village,{id,kind:'animals',from:'adam',to:'player',text,data:next});
    });
    this.say(text);
    this.feed('farm',`Adam asks: ${text}`);
  }

  /* ---------------- the kid's answer ---------------- */
  /** Buy button: ask the parent app to spend the coins. The island never touches the balance itself. */
  buy(){
    const s=this.state(),req=this.ranch(s).request;
    if(!req||req.status!=='open')return false;
    if(!window.parent||window.parent===window){this.g.toast('Gold coins live in the app. Open the island from My Home to buy animals.');return false;}
    const coins=this.g.coins;
    if(Number.isFinite(coins)&&coins<req.price){this.coinsShort=req.price-coins;this.g.toast(`Need ${req.price-coins} more coins. Play games on the ship to earn some!`);this.g.notify?.();return false;}
    this.payingSince=performance.now();
    this.mutate(n=>{n.farm.ranch.request={...req,status:'paying'};});
    this.post({type:'gk-buy-animal',requestId:req.id,kind:req.kind,qty:req.qty,price:req.price});
    return true;
  }
  /** Not now: Adam asks again next island morning. */
  decline(){
    const s=this.state(),req=this.ranch(s).request;
    if(!req)return;
    this.mutate(n=>{n.farm.ranch.request=null;n.farm.ranch.askAgainAt=R.nextMorning(gameTime(s));n.village=R.closeRequest(n.village,req.id,'declined');});
    this.coinsShort=null;
    this.say('That is all right! I will keep the paddock tidy until then.');
  }
  /** Earn-coins link: the parent app opens the games page. */
  earn(){this.post({type:'gk-earn-coins'});}

  onDenied(msg){
    const s=this.state(),req=this.ranch(s).request;
    if(!req||msg.requestId!==req.id)return;
    if(Number.isFinite(msg.balance))this.g.coins=msg.balance;
    this.coinsShort=Number.isFinite(msg.short)&&msg.short>0?msg.short:null;
    this.mutate(n=>{n.farm.ranch.request={...req,status:'open'};});
    this.g.toast(msg.reason||'Not enough gold coins yet.');
  }

  /** The parent approved the price (nothing spent yet): land the animals, name them, then confirm receipt so the coins are taken for what actually arrived. */
  onPurchased(msg){
    const s=this.state(),ranch=this.ranch(s),req=ranch.request,adam=this.adam();
    if(!req||msg.requestId!==req.id){this.post({type:'gk-animal-refund',requestId:msg.requestId,qty:msg.qty});return;}
    if(req.status==='arriving'||req.status==='done')return;
    const qty=Math.max(0,Math.min(req.qty,Number(msg.qty)||req.qty)),plan=this.plan(s);
    const spots=this.arrivalSpots(s,plan,qty),placed=[];
    const who=adam?.userData||{id:s.activeCharacter,name:'Adam',x:s.player.x,y:s.player.y};
    for(let i=0;i<Math.min(qty,spots.length);i++){
      const id=`farm:${req.kind}:${req.id.split(':').pop()}:${i}`,p=spots[i],before=this.g.store.state;
      try{this.g.store.commitAs(who.id,who.name,{x:who.x,y:who.y},{type:'place_animal',kind:req.kind,x:p.x,y:p.y,id,actionId:`farm:place:${id}`});}catch{/* reported below */}
      if(this.g.store.state!==before)placed.push(id);
    }
    if(!placed.length){
      this.post({type:'gk-animal-refund',requestId:req.id,qty});
      this.mutate(n=>{n.farm.ranch.request={...req,status:'open'};});
      this.g.toast('The boat could not find a place to land the animals today. No coins were spent.');
      return;
    }
    const taken=Object.values(ranch.names),names=R.pickNames(req.kind,placed.length,taken,Date.now());
    const line=R.arrivalLine(req.kind,names);
    this.mutate(n=>{
      for(let i=0;i<placed.length;i++)n.farm.ranch.names[placed[i]]=names[i];
      n.farm.ranch.purchases=[...(n.farm.ranch.purchases||[]),{id:req.id,kind:req.kind,qty:placed.length,price:R.bundlePrice(req.kind,placed.length),at:Date.now()}].slice(-40);
      n.farm.ranch.request={...req,status:'arriving',animalIds:placed,names,qty:placed.length};
      n.village=R.closeRequest(n.village,req.id,'done');
    });
    this.post({type:'gk-animal-received',requestId:req.id,qty:placed.length,price:R.bundlePrice(req.kind,placed.length)});
    if(Number.isFinite(msg.balance))this.g.coins=msg.balance-R.bundlePrice(req.kind,placed.length);
    this.coinsShort=null;
    this.g.animals?.sync?.();
    this.arrival={requestId:req.id,ids:placed,stage:'dock',met:false,names,kind:req.kind};
    const gate=this.gateOut(plan);
    if(gate&&this.g.animals)this.walkAnimals(placed,placed.map(()=>gate),'Adam is bringing the new animals home.');
    const emoji=animalById(req.kind)?.emoji||'';
    this.g.toast(`${emoji} A boat brought ${R.describeBundle(req.kind,placed.length)} to the dock! Adam is on his way to meet them.`,5200);
    this.feed('farm',line);
    this.g.residents?.lastChoreScan&&(this.g.residents.lastChoreScan=0);
    this.g.notify?.();
  }

  /** Reuse the animals' manual round-up so livestock walk somewhere and remember the spot when they get there. */
  walkAnimals(ids,targets,line){
    const animals=this.g.animals;if(!animals?.roundups)return;
    const jobs=ids.map((animalId,i)=>({animalId,x:targets[i%targets.length].x,y:targets[i%targets.length].y}));
    animals.roundups.set(ROUNDUP,{line,jobs});
    animals.refreshHerd?.();
  }
  herdIn(s,ids){const stalls=this.stalls(s,ids.length);if(stalls.length)this.walkAnimals(ids,stalls,'Adam is walking the animals into the stable.');}
  /** Arrivals: wait at the gate, then into the stable; when the last one is inside the request is done. */
  settleArrival(s){
    const a=this.arrival;if(!a)return;
    const running=this.g.animals?.roundups?.has(ROUNDUP);
    if(a.stage==='dock'&&!running&&a.met){a.stage='in';this.herdIn(s,a.ids);return;}
    if(a.stage==='in'&&!running){
      this.arrival=null;
      const req=this.ranch(s).request;
      if(req&&req.id===a.requestId)this.mutate(n=>{n.farm.ranch.request=null;n.farm.ranch.askAgainAt=R.nextMorning(gameTime(s));});
      this.g.animals?.sync?.();
    }
  }

  /* ---------------- chores (pulled by residents.pickChore for Adam) ---------------- */
  chores(home,s,min,here){
    if(!this.isAdam(home)||!this.active()||s.night)return [];
    const hands=checkIn(s,{who:home.id,brain:'farmer',intent:{action:'tend',maintenance:true}});
    if(!hands.ok){speakRefusal(this.g,this.foremanTold,home.id,home.name,hands);return [];}
    const ranch=this.ranch(s),st=this.status(s),plan=this.plan(s),{hour,day}=timeLabel(min),options=[];
    const push=(farm,target,o)=>{if(target)options.push({kind:'farm',farm,key:`farm:${farm}`,target,reach:1.2,dwell:1.6,...o});};
    if(this.arrival&&!this.arrival.met)push('collect',this.dockPoint(s,plan),{rank:0,label:'Welcoming the new animals',reach:1.8,dwell:2.2});
    if(hour>=20.3&&ranch.herdedDay!==day&&R.herdCount(s)>0&&st.stables)push('herd',this.gateOut(plan)||this.reachPoint(s,R.STABLE_KIND),{rank:0,label:'Counting the animals in',reach:1.6,dwell:2});
    const herd=R.herdCount(s),energy=energyFor(s,home.id),underway=activeBuildings(s).some(b=>b.status!=='complete'&&!b.project);
    // No stable yet. The foreman picks the flock slot before anyone walks. Squares the kid already tapped stay theirs.
    if(!this.stables(s).length){
      if(underway||energy<BUILD_ENERGY+2||woodTotal(s)<STABLE_DEF.wood||(s.inventory.stone||0)<STABLE_DEF.stone)return options;
      const gate=checkIn(s,{who:home.id,brain:'farmer',intent:{action:'paddock',kind:R.STABLE_KIND},world:this.g.world});
      const noRoom=!gate.ok&&(gate.reason==='No room in the row yet'||gate.instead==='No room in the row yet');
      if(!gate.ok&&!noRoom){speakRefusal(this.g,this.foremanTold,home.id,home.name,gate);return options;}
      const kid=s.farm?.ranch?.kidFence;
      if(kid?.stable?.key){
        const hit=this.obstacle(s,kid.stable.keys||[kid.stable.key]);
        if(hit){options.push(hit);return options;}
        const drawn=this.farmSite(s,kid.stable);
        if(!drawn){this.tellOnce('stable:spot','Adam cannot put the stable on those squares yet.');return options;}
        push('stable',drawn.work,{rank:0.3,label:'Building a stable',reach:1.0,dwell:2.2,cellKey:drawn.key,rotation:drawn.rotation});
        return options;
      }
      if(!gate.ok){speakRefusal(this.g,this.foremanTold,home.id,home.name,gate);return options;}
      const site=this.farmSite(s,gate.site);
      if(!site){speakRefusal(this.g,this.foremanTold,home.id,home.name,{ok:false,reason:'No room in the row yet',instead:'No room in the row yet'});return options;}
      push('stable',site.work,{rank:0.3,label:'Building a stable',reach:1.0,dwell:2.2,cellKey:site.key,rotation:site.rotation});
      return options;
    }
    if(hour>=6.5&&hour<12){
      if(st.trough&&ranch.wateredDay!==day){
        const well=R.completeOf(s,'well')[0];
        if(!(s.inventory.water>0)&&well&&energy>=6)push('fetch',workPoint(this.g.world,well),{rank:1,label:'Fetching water for the trough',reach:1.2,dwell:1.5});
        else push('water',this.reachPoint(s,R.TROUGH_KIND),{rank:1,label:'Filling the water trough',reach:2.4,dwell:2});
      }
      if(st.feedPile&&ranch.fedDay!==day)push('feed',this.reachPoint(s,R.FEED_KIND),{rank:1,label:herd?'Feeding the animals':'Topping up the feed pile',reach:2.4,dwell:2});
    }
    if(!underway&&energy>=BUILD_ENERGY+2&&!st.fenced){
      const wood=woodTotal(s),nextFence=R.nextFenceKey(plan,s.buildings);
      const wantsTrough=!st.trough&&wood>=4&&(s.inventory.stone||0)>=2;
      const wantsFeed=!st.feedPile&&wood>=2;
      const wantsFence=!!nextFence&&wood>=2;
      const pad=(wantsTrough||wantsFeed||wantsFence)?checkIn(s,{who:home.id,brain:'farmer',intent:{action:'paddock',kind:wantsTrough?R.TROUGH_KIND:wantsFeed?R.FEED_KIND:R.FENCE_KIND}}):{ok:true};
      if(!pad.ok)speakRefusal(this.g,this.foremanTold,home.id,home.name,pad);
      else{
        // The paddock comes before the next house: fence pieces go up as soon as there is wood for them, the trough and feed pile
        // slot in (inside the ring, gate side) whenever their materials are there. The gate is left for last so Adam can still walk in.
        if(wantsTrough){const spot=this.spotInside(s,plan,R.TROUGH_KIND);if(spot)push('trough',spot.center,{rank:0.35,label:'Building a water trough',reach:1.6,dwell:1.8,cellKey:spot.key,rotation:spot.rotation});}
        else if(wantsFeed){const spot=this.spotInside(s,plan,R.FEED_KIND);if(spot)push('feedpile',spot.center,{rank:0.35,label:'Making a feed pile',reach:1.4,dwell:1.8,cellKey:spot.key,rotation:spot.rotation});}
        if(wantsFence&&(nextFence!==plan.gate||(st.trough&&st.feedPile))){
          const blocked=plan.blocked.find(b=>b.key===nextFence);
          if(!blocked)push('fence',this.at(nextFence),{rank:0.4,label:'Fencing the paddock',cellKey:nextFence,reach:1.3,dwell:1.4,key:`farm:fence:${nextFence}`});
          else{const clear=this.clearChore(s,nextFence);if(clear)options.push({...clear,rank:0.4});}
        }
        // Something growing or lying inside the paddock-to-be: clear it so the animals have the whole yard.
        const b=plan.blocked.find(x=>x.where==='inside');if(b){const clear=this.clearChore(s,b.key);if(clear)options.push(clear);}
      }
    }
    const drawn=s.farm?.ranch?.kidFence;
    if(drawn?.ring?.length&&st.fenced)this.g.buildAsk?.requestFence(home);
    // Midday: walk the fence line and mend what the coyotes chewed.
    if(hour>=12&&hour<16.5&&ranch.checkedDay!==day&&st.ring>0){
      const damaged=(s.buildings||[]).find(b=>b.status==='complete'&&R.FENCE_KINDS.has(b.kind)&&plan.ring.includes(b.key)&&(s.farm?.integrity?.[b.id]??1)<1);
      if(damaged&&woodTotal(s)>=1)push('repair',this.at(damaged.key),{rank:2,label:'Mending the fence',reach:1.25,dwell:1.8,buildingId:damaged.id});
      else push('check',this.gateOut(plan),{rank:4,label:'Checking the fences',reach:1.6,dwell:1.5});
    }
    return options;
  }
  /** A tree or rock on the stable footprint the kid chose. No toast when the square is already clear. */
  obstacle(s,keys){
    const g=this.g;
    for(const k of keys||[]){
      const p=this.at(k);
      const tree=(g.trees||[]).find(t=>!s.removedTrees?.includes(t.id)&&Math.hypot(t.position[0]-p.x,t.position[1]-p.y)<(t.radius||.4)+1.1&&!t.cell);
      if(tree&&!g.residents?.claims.has(`tree:${tree.id}`))return {kind:'chop',key:`tree:${tree.id}`,treeId:tree.id,target:{x:tree.position[0],y:tree.position[1]},reach:1.18+(tree.radius||0)*.2,dwell:1,label:'Clearing a tree for the stable',rank:0.2};
      const rock=(g.world.boulders||[]).find(r=>!(s.removedRocks||[]).includes(r.id)&&Math.hypot(r.position[0]-p.x,r.position[1]-p.y)<(r.radius||.6)+1);
      if(rock&&!g.residents?.claims.has(`rock:${rock.id}`))return {kind:'mine',key:`rock:${rock.id}`,rockId:rock.id,target:{x:rock.position[0],y:rock.position[1]},reach:(rock.radius||.6)+.85,dwell:1,label:'Breaking a rock for the stable',rank:0.2};
    }
    return null;
  }
  /** A tree or rock standing where a fence piece must go: chop or break it (the ordinary chore kinds). */
  clearChore(s,k){
    const p=this.at(k),g=this.g;
    const tree=(g.trees||[]).find(t=>Math.hypot(t.position[0]-p.x,t.position[1]-p.y)<(t.radius||.4)+1.1&&!t.cell);
    if(tree&&!g.residents?.claims.has(`tree:${tree.id}`))return {kind:'chop',key:`tree:${tree.id}`,treeId:tree.id,target:{x:tree.position[0],y:tree.position[1]},reach:1.18+(tree.radius||0)*.2,dwell:1,label:'Clearing a tree for the fence',rank:2.6};
    const rocks=g.world.boulders.filter(r=>!(s.removedRocks||[]).includes(r.id));
    const rock=rocks.find(r=>Math.hypot(r.position[0]-p.x,r.position[1]-p.y)<(r.radius||.6)+1);
    if(rock&&!g.residents?.claims.has(`rock:${rock.id}`))return {kind:'mine',key:`rock:${rock.id}`,rockId:rock.id,target:{x:rock.position[0],y:rock.position[1]},reach:(rock.radius||.6)+.85,dwell:1,label:'Breaking a rock for the fence',rank:2.6};
    this.tellOnce(`blocked:${k}`,'Adam cannot fence one corner of the paddock: something is in the way there.');
    return null;
  }

  /** Adam arrived at a farm chore: do the thing. Called by residents.finishChore for kind 'farm'. */
  finish(actor,c){
    const g=this.g,home=actor.userData,s=g.store.state;
    if(!s||s.night)return;
    const min=gameTime(s),day=timeLabel(min).day,who=home.name||'Adam';
    // Fence pieces are placed from arm's length: if Adam stopped on the cell itself, he reaches over from a step back.
    const stand=c.farm==='fence'?this.standOff(home,c.target):{x:home.x,y:home.y};
    const commit=(action)=>{const before=g.store.state;try{g.store.commitAs(home.id,home.name,stand,{...action,actionId:`farm:${home.id}:${c.farm}:${Date.now()}`});}catch(e){g.toast(e.message);return false;}return g.store.state!==before;};
    const tired=()=>{if(energyFor(g.store.state,home.id)<BUILD_ENERGY){g.toast(`${who} is too tired to keep building.`);return true;}return false;};
    if(c.farm==='fence'){
      const plan=this.plan(s),status=strokePlacementStatus(g.world,{...s,player:stand,activeCharacter:home.id,characters:s.characters?.[home.id]?s.characters:{...s.characters,[home.id]:{name:who,energy:100}}},{kind:R.FENCE_KIND,key:c.cellKey,rotation:0,stroke:true},min);
      if(!status.ok){if(!tired())this.tellOnce(`fence:${status.reason}`,`Adam cannot put a fence there: ${status.reason}`);return;}
      if(!commit({type:'place_building',id:`farm:fence:${c.cellKey}:${Date.now().toString(36)}`,kind:R.FENCE_KIND,key:c.cellKey,rotation:0,stroke:true})){tired();return;}
      g.music?.sfx?.play('chop');g.burst?.(c.target,'wood',.5);g.refreshDynamic?.();
      const left=R.fenceGaps(plan,g.store.state.buildings).length,total=plan?.ring.length||0;
      if(left===0){g.toast(`${who} closed the paddock gate. "There — snug as anything. Thank You, God, for good fences!"`,5200);this.feed('farm',`${who} finished the paddock fence around the stable.`);this.say('All the way round! Now we only need some animals to put in it.');this.mutate(n=>{n.village=R.closeRequest(n.village,'farm:paddock','done');},false);}
      else{if((total-left)%5===0||total-left===1)g.toast(`${who} put up a fence piece for the paddock (${total-left} of ${total}).`);this.mutate(n=>{n.village=R.upsertRequest(n.village,{id:'farm:paddock',kind:'fence',from:'adam',to:'adam',text:'Fence a paddock all the way round the stable',data:{done:total-left,total}});},false);}
      g.residents?.reelEvent?.(actor);
    }else if(c.farm==='stable'){
      if(!commit({type:'place_building',id:`farm:stable:${Date.now().toString(36)}`,kind:R.STABLE_KIND,key:c.cellKey,rotation:c.rotation||0})){if(!tired())this.tellOnce('place:stable','No room in the row yet');return;}
      g.music?.sfx?.play('chop');g.burst?.(c.target,'wood',.8);g.refreshDynamic?.();
      g.toast(`${who} put up a stable for the animals. "Now the coyotes can keep their distance!"`,5000);
      this.feed('farm',`${who} built a stable for the animals.`);
      this.say('A stable! Now for a fence all the way round. Thank You, God, for good wood.');
      this.mutate(n=>{n.village=R.upsertRequest(n.village,{id:'farm:paddock',kind:'fence',from:'adam',to:'adam',text:'Fence a paddock all the way round the stable',data:{done:0,total:0}});},false);
      g.residents?.reelEvent?.(actor);
    }else if(c.farm==='trough'||c.farm==='feedpile'){
      const kind=c.farm==='trough'?R.TROUGH_KIND:R.FEED_KIND,def=buildingById(kind);
      if(!commit({type:'place_building',id:`farm:${kind}:${Date.now().toString(36)}`,kind,key:c.cellKey,rotation:c.rotation||0})){if(!tired())this.tellOnce(`place:${kind}`,`${who} could not put the ${def?.name?.toLowerCase()||kind} down there.`);return;}
      g.music?.sfx?.play('chop');g.burst?.(c.target,'wood',.5);g.refreshDynamic?.();
      g.toast(kind===R.TROUGH_KIND?`${who} built a water trough in the paddock. "Fresh water for everyone — God thought of that first!"`:`${who} heaped up a feed pile in the paddock.`,4800);
      this.feed('farm',kind===R.TROUGH_KIND?`${who} built a water trough for the animals.`:`${who} made a feed pile for the animals.`);
      g.residents?.reelEvent?.(actor);
    }else if(c.farm==='fetch'){
      const well=R.completeOf(s,'well')[0];if(!well)return;
      if(commit({type:'fetch_water',wellId:well.id}))g.burst?.(c.target,'water',.4);
    }else if(c.farm==='water'){
      const herd=R.herdCount(s),useBag=(s.inventory.water||0)>0;
      this.mutate(n=>{const r=n.farm.ranch;r.water=Math.max(0,r.water-herd*R.WATER_PER_ANIMAL)+R.WATER_PER_FILL+(useBag?2:0);r.wateredDay=day;if(useBag)n.inventory.water=Math.max(0,(n.inventory.water||0)-1);});
      g.burst?.(c.target,'water',.4);
      g.toast(herd?`${who} filled the trough for the animals.`:`${who} filled the water trough. "Ready for whoever comes to live here!"`);
      this.feed('farm',`${who} filled the water trough.`);
    }else if(c.farm==='feed'){
      const herd=R.herdCount(s),useWheat=(s.inventory.wheat||0)>0,produce=R.dailyProduce(s,day);
      this.mutate(n=>{
        const r=n.farm.ranch;r.feed=Math.max(0,r.feed-herd*R.FEED_PER_ANIMAL)+R.FEED_PER_RESTOCK+(useWheat?R.FEED_PER_WHEAT:0);r.fedDay=day;
        if(useWheat)n.inventory.wheat=Math.max(0,(n.inventory.wheat||0)-1);
        for(const [item,k] of Object.entries(produce.items)){n.inventory[item]=(n.inventory[item]||0)+k;r.gathered[item]=(r.gathered[item]||0)+k;}
        if(produce.food){n.stats.farmProduce=(n.stats.farmProduce||0)+produce.food;}
        r.producedDay=produce.lines.length?day:r.producedDay;
      });
      g.burst?.(c.target,'seed',.4);
      const gathered=produce.lines.length?` and gathered ${produce.lines.join(' and ')}`:'';
      const line=herd?`${who} fed the animals${gathered}.`:`${who} topped up the feed pile.`;
      g.toast(`${line}${produce.lines.length?' "Thank You, God, for breakfast!"':''}`,4600);
      this.feed('farm',line);
      if(produce.lines.length)this.say(`Look what ${this.someName(s)} gave us today! Thank You, God.`);
    }else if(c.farm==='repair'){
      const b=(s.buildings||[]).find(x=>x.id===c.buildingId);if(!b)return;
      const log=Object.entries(s.inventory).filter(([id,n])=>id.endsWith('_wood')&&n>0).sort((a,b)=>b[1]-a[1])[0];
      this.mutate(n=>{n.farm.integrity={...(n.farm.integrity||{}),[b.id]:1};n.farm.ranch.checkedDay=day;if(log)n.inventory[log[0]]=Math.max(0,n.inventory[log[0]]-1);});
      g.music?.sfx?.play('chop');g.burst?.(c.target,'wood',.4);
      g.toast(`${who} mended the fence where a coyote chewed it.`);this.feed('farm',`${who} mended the paddock fence.`);
    }else if(c.farm==='check'){
      this.mutate(n=>{n.farm.ranch.checkedDay=day;},false);
      this.say('Every post still standing. Good fence!');
    }else if(c.farm==='herd'){
      const world=g.world,map=enclosureMap(world,s.buildings),loose=R.farmAnimals(s).filter(a=>!regionAt(map,world,a.x,a.y)&&!nearStable(world,s,a.x,a.y)).map(a=>a.id);
      this.mutate(n=>{n.farm.ranch.herdedDay=day;},false);
      if(loose.length)this.herdIn(s,loose);
      const names=R.farmAnimals(s).map(a=>this.ranch(s).names[a.id]).filter(Boolean);
      g.toast(loose.length?`${who} is walking ${loose.length===1?'a stray':`${loose.length} strays`} into the stable for the night.`:`${who} counted everyone in for the night${names.length?` — ${R.joinNames(names.slice(0,3))}${names.length>3?' and the rest':''}`:''}.`,4600);
      this.say('Everyone is in. Good night, little ones — God keeps watch.');
      this.feed('farm',`${who} counted the animals in for the night.`);
      g.residents?.reelEvent?.(actor);
    }else if(c.farm==='collect'){
      const a=this.arrival;if(!a)return;
      a.met=true;
      const names=a.names||[];
      this.say(`Welcome, little ones! I will call you ${R.joinNames(names)}. Thank You, God, for new friends.`,6500);
      g.toast(`${who} met the new ${names.length===1?'arrival':'arrivals'} at the dock and named ${names.length===1?'it':'them'} ${R.joinNames(names)}.`,5200);
      g.residents?.reelEvent?.(actor);
      const gate=this.gateOut(this.plan(s));
      if(gate)this.walkAnimals(a.ids,a.ids.map(()=>gate),'Adam is bringing the new animals home.');
    }
    g.notify?.();
  }
  /** A point at least one cell away from `target`, on Adam's side of it. */
  standOff(home,target){
    const dx=home.x-target.x,dy=home.y-target.y,d=Math.hypot(dx,dy);
    if(Math.abs(dx)>.95&&Math.abs(dy)>.95||d>=1.35)return {x:home.x,y:home.y};
    const ux=d>1e-3?dx/d:1,uy=d>1e-3?dy/d:0;
    return {x:target.x+ux*1.35,y:target.y+uy*1.35};
  }
  someName(s){const names=Object.values(this.ranch(s).names);return names.length?names[Math.floor(Math.random()*names.length)]:'the animals';}

  /* ---------------- UI ---------------- */
  snapshot(){
    const g=this.g,s=this.state();
    if(!s||!this.active())return null;
    const ranch=this.ranch(s),st=this.status(s),req=ranch.request,adam=this.adam();
    const coins=Number.isFinite(g.coins)?g.coins:null;
    const def=req?animalById(req.kind):null;
    const bubble=this.bubble&&adam?this.project(adam,this.bubble.text):null;
    return {
      ready:st.ready,steps:st.steps,herd:st.herd,capacity:st.capacity,feed:st.feed,water:st.water,fenced:st.fenced,gaps:st.gaps,ring:st.ring,
      adam:adam?{name:adam.userData.name||'Adam',imageUrl:adam.userData.imageUrl||''}:null,
      request:req&&(req.status==='open'||req.status==='paying')&&!s.night?{id:req.id,kind:req.kind,qty:req.qty,price:req.price,text:req.text,name:def?.name||req.kind,emoji:def?.emoji||'',paying:req.status==='paying',coins,short:coins===null?null:Math.max(0,req.price-coins),inApp:!!(window.parent&&window.parent!==window)}:null,
      arriving:req?.status==='arriving'?{kind:req.kind,names:req.names||[]}:null,
      names:ranch.names,bubble,
    };
  }
  /** Compact farm state for the Gemini foreman (mirrors gardenKeeper.foremanContext). */
  foremanContext(){
    const s=this.state();if(!s)return null;
    const ranch=this.ranch(s),st=this.status(s),day=this.day(s);
    const marked=s.farm?.ranch?.kidFence;
    return {ready:st.ready,waitingFor:st.waiting?.label||null,herd:st.herd,capacity:st.capacity,feed:st.feed,water:st.water,fencePieces:st.ring?`${st.ring-st.gaps}/${st.ring}`:null,fedToday:ranch.fedDay===day,wateredToday:ranch.wateredDay===day,
      markedPaddock:marked?.stable?.key?{stable:marked.stable.key,fence:marked.ring||[],gate:marked.gate||null}:null,
      request:ranch.request?{kind:ranch.request.kind,qty:ranch.request.qty,price:ranch.request.price,status:ranch.request.status}:null,prices:R.FARM_PRICES,names:Object.values(ranch.names),gathered:ranch.gathered};
  }
  /** Screen position above Adam's head for his speech bubble. */
  project(actor,text){
    const g=this.g,rect=g.renderer?.domElement?.getBoundingClientRect?.();
    if(!rect?.width||!rect?.height||g.overview||g.mapOnly)return null;
    g.camera.updateMatrixWorld(true);
    const v=actor.getWorldPosition(new actor.position.constructor());v.y+=2.3;v.project(g.camera);
    if(v.z<-1||v.z>1||Math.abs(v.x)>1.1||Math.abs(v.y)>1.1)return null;
    return {text,x:(v.x+1)*rect.width/2,y:(1-v.y)*rect.height/2};
  }
  dispose(){window.removeEventListener('message',this.onMessage);}
}
