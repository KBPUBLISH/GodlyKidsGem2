import {NightRest,MorningNote} from './night-ui.jsx';
import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {HomeWorld} from './world.js';
import {SEEDS,realDuration,label,waterWindow} from './core.mjs';
import {yearClockLabel} from './calendar.mjs';
import {MINERALS,TOOL_TIERS,upgradeStatus,toolTier,forgeProgress,forgeTimeLeft,forgeEstimate} from './mining.mjs';
import {SHOVEL_TIERS,shovelStatus,shovelTier,haveOf,hasWell} from './digging.mjs';
import {FOODS,FOOD_RECIPES,MAX_ENERGY,MAX_HUNGER,energyFor,hungerFor,mealGain,canCook,restGain,energyCost} from './nutrition.mjs';
import {completedFires,litFires,completedOvens,hotOvens,BUILDINGS} from './building.mjs';
import {ANIMALS} from './animals.mjs';
import {Icon,ItemIcon,ActionButton,TOOLS,useDialogFocus} from './ui.jsx';
import {BuildMenu,PlacementControls,StrokeBar} from './building-ui.jsx';
import {ActionMenu,QUICK_TOOLS} from './action-menu.jsx';
import {SleepPanel,SleepBubble} from './sleep-ui.jsx';
import {BagPanel} from './bag-ui.jsx';
import {RecipeBook,RecipeBubble} from './recipe-book.jsx';
import {CommunityPanel} from './community-ui.jsx';
import {ReturnReportPanel} from './project-ui.jsx';
import {ResourceHealth} from './resource-health.jsx';
import {CharacterPicker} from './character-picker.jsx';
import {CharacterVitals,ResidentGreeting,EnergyFx,PlantPeek,BuildPeeks} from './character-vitals.jsx';
import {MealAsk,SiteAsk} from './resident-line.jsx';
// The ship art lives in the parent app's public folder, not under /homeworld.
// Built as a concatenation so the publish step's /assets/ -> /homeworld/assets/ rewrite leaves it alone.
const FriendsIcon=()=><img className="picture-icon" src="/icons/higgsfield/friends.png?v=2" width={32} height={32} alt="" aria-hidden="true" draggable={false} decoding="async" style={{imageRendering:'auto'}}/>;
const SHIP_ICON=['', 'assets', 'images', 'sail-tab-ship.png'].join('/');
/** Hide "Walking to build" for a Prayer Tent once one is already finished. */
function buildProgressItems(items){
  const list=items||[],tentStanding=list.some(b=>b.kind==='tent'&&b.status==='complete');
  let tentShown=false;
  return list.filter(b=>{
    if(b.status==='complete'||b.project)return false;
    if(b.kind==='tent'&&(tentStanding||tentShown))return false;
    if(b.kind==='tent')tentShown=true;
    return true;
  });
}
import {FishingGame} from './fishing-ui.jsx';
import {skillFor} from './character-skills.mjs';
import {IslandPlan} from './island-plan.jsx';
import {IslandTour,onboardingPending} from './onboarding.jsx';
import {ArrivalProfile} from './arrival-profile.jsx';
import {StageBadge,StageJourney} from './stage-journey.jsx';
import {GardenPanel} from './garden-ui.jsx';
import {FarmCard,FarmBubble} from './farm-ui.jsx';
import {MarketPanel} from './market-ui.jsx';
import LoadingTips from './loading-tips.jsx';
import './style.css';
import {LIVING_TEST} from './storage-scope.mjs';
import {LivingTestUI} from './living-test-ui.jsx';

/** Kid profile name from the parent app (`?player=` or a `gk-player-name` message). */
function readPlayerName(value){
  return String(value||'').replace(/[\u0000-\u001f]/g,'').trim().slice(0,24);
}
function playerNameFromUrl(){
  try{return readPlayerName(new URLSearchParams(location.search).get('player'));}
  catch{return '';}
}

function FoodPanel({view,onEat,onCook,onFish,onRest,onHarvest,onSleep}){
  const s=view.state,energy=energyFor(s),inventory=s.inventory,name=view.nutrition?.name||'Adam',hunger=Math.round(hungerFor(s,view.minutes)),full=energy>=MAX_ENERGY&&hunger>=MAX_HUNGER;
  return <><p>Hungry? Pick vegetables or catch a fish. Food fills the tummy and gives energy; resting at home refills energy only. A hungry tummy makes chopping, digging and building slower · an empty one makes them very slow. Only running out of energy stops the work.</p><button className="food-sleep-link" onClick={onSleep}><Icon type="rest" size={36}/><span><strong>{view.nutrition.lowEnergy?'Low energy? Rest at home':'Rest at home'}</strong><small>Full energy and a fresh start →</small></span></button><div className="food-energy"><div><strong>{name}’s energy</strong><b>{energy} / {MAX_ENERGY}</b></div><progress value={energy} max={MAX_ENERGY} aria-label={`${name} energy`}/><small>{energy===MAX_ENERGY?'Your energy is full! Keep your snacks for later.':energy<15?'Low energy. Sleep at home for a full refill.':'A snack gives you energy to play and grow.'}</small></div><div className={`food-energy food-hunger ${hunger<=25?'low':''}`}><div><strong>{name}’s tummy</strong><b>{hunger}%</b></div><progress value={hunger} max={MAX_HUNGER} aria-label={`${name} hunger`}/><small>{hunger<=0?'Empty tummy · work is very slow until you eat.':hunger<=25?'Getting hungry · work is slower. Grow and eat food to stay strong.':hunger>=MAX_HUNGER?'A full tummy. Food can wait.':'The tummy empties slowly through the day. Only food fills it.'}</small></div>
    <h2>Pick a snack</h2><div className="food-cards">{Object.entries(FOODS).filter(([id])=>id!=='bread'||inventory.bread>0).map(([id,f])=>{const n=inventory[id]||0,meal=mealGain(s,id,view.minutes),gain=Math.round(meal.total);return <article className="food-card" key={id}><span className="food-icon"><ItemIcon id={id}/></span><div><strong>{f.name}</strong><small>{n} in your bag · +{f.energy} energy · +{Math.round(f.energy*1.5)} tummy</small><p>{f.source}</p></div><button disabled={!n||full||view.busy} aria-label={n===0?`Empty. No ${f.name.toLowerCase()} yet`:full?`Full. Save ${f.name.toLowerCase()} for later`:`Eat ${f.name.toLowerCase()}`} onClick={()=>onEat(id)}>{n===0?'Empty':full?'Full!':'Eat'}{n>0&&gain>0?<small>+{gain}</small>:null}</button></article>;})}</div>
    <h2>Let’s cook!</h2><div className="prepare-cards">{Object.entries(FOOD_RECIPES).map(([id,r])=>{const oven=r.station==='oven',lit=oven?hotOvens(s,view.minutes).length>0:litFires(s,view.minutes).length>0,built=oven?completedOvens(s).length>0:completedFires(s).length>0,warming=oven&&built&&!lit&&completedOvens(s).some(b=>b.fuelUntil>view.minutes),ready=canCook(s,id)&&lit,what=oven?'oven':'campfire';return <div key={id}><span><ItemIcon id={r.item}/></span><div><strong>{r.name}</strong><small>{Object.entries(r.ingredients).map(([item,n])=>`${inventory[item]||0} / ${n} ${item}`).join(' · ')} → 1 {FOODS[r.item].name.toLowerCase()}</small><small>{lit?`Make it beside your ${what}.`:warming?'The oven is heating up · almost ready.':built?`The ${what} is cold · tap it to add a log.`:oven?'Needs a clay oven · build one from Build › Decorations.':'Needs a lit campfire.'}</small></div><button disabled={view.busy||!ready} aria-label={!lit?(warming?`${r.name}. The oven is still heating up`:built?`${r.name}. Add a log to the ${what} first`:`${r.name}. Build a ${what} first`):r.name} onClick={()=>onCook(id)}>{!lit?(warming?'Heating up':built?(oven?'Oven is cold':'Fire is out'):(oven?'Needs an oven':'Needs a fire')):r.name}</button></div>;})}</div>
    <h2>Find more food</h2><div className="food-actions"><button disabled={view.busy||energy<4} onClick={onFish}><Icon type="rawfish"/><span>Catch a fish <small>Uses 4 energy</small></span></button><button disabled={view.busy} onClick={onHarvest}><Icon type="harvest"/><span>Pick garden food <small>Pick crops that are ready. No energy needed!</small></span></button><button disabled={view.busy||!restGain(s)} onClick={onRest}><Icon type="rest"/><span>Take a little rest <small>Rest for 8 seconds. Rest fills energy up to 25.</small></span></button></div>
    <p className="catalogue-note">Chopping costs {energyCost(s,'chop')}, digging {energyCost(s,'plow')}, planting 2, watering {energyCost(s,'water')}{hasWell(s)?' (free thanks to your well)':''}, each pickaxe swing {energyCost(s,'mine_hit')}, and building 5 energy. Rocks take more swings than trees. Stronger tools use fewer swings. Energy and meals save with your character.</p><div className="stats-row"><span>{s.stats.fishCaught||0} fish caught</span><span>{s.stats.mealsEaten||0} meals eaten</span></div></>;
}
function CampfirePanel({view,fireId,onGrill,onDryClay,onStoke,onEat,onFish}){
  const card=view.campfire;
  if(!card)return <p>The campfire is gone. Build a new one from Build › Decorations.</p>;
  const canGrill=card.lit&&card.rawFish>0&&!card.busy;
  return <>
    <div className={`campfire-status ${card.lit?'lit':'out'}`}><span className="campfire-flame" aria-hidden="true">{card.lit?'🔥':'💨'}</span><div><strong>{card.lit?(card.low?'Burning low':'Burning nicely'):'The fire is out'}</strong><small>{card.lit?`About ${Math.max(1,Math.round(card.minutesLeft/60*10)/10)} island hours of wood left`:'Add a log to light it again'}</small></div>{card.canStoke&&<button type="button" disabled={card.busy||!card.hasWood} onClick={onStoke} aria-label="Add a log to the campfire"><Icon type="wood" size={22}/> Add a log</button>}</div>
    {!card.hasWood&&card.canStoke&&!card.lit&&<p className="catalogue-note">No logs in the bag. Chop a tree first.</p>}
    <h2>On the grill</h2>
    <article className="grill-card"><span className="grill-icon"><ItemIcon id="fish" size={44}/><i aria-hidden="true">→</i><ItemIcon id="cooked_fish" size={44}/></span><div><strong>Grill a fish</strong><small>{card.rawFish} raw fish in the bag{card.cookedFish?` · ${card.cookedFish} grilled ready to eat`:''}</small><p>{card.lit?'Hold a fish over the flames for a few seconds.':'Light the fire first.'}</p></div><button type="button" disabled={!canGrill} onClick={onGrill} aria-label="Grill a fish">{card.rawFish?card.lit?'Grill':'Fire is out':'No fish'}</button></article>
    <h2>By the fire</h2>
    <article className="grill-card"><span className="grill-icon"><ItemIcon id="mud" size={44}/><i aria-hidden="true">→</i><ItemIcon id="clay" size={44}/></span><div><strong>Dry clay bricks</strong><small>{card.mud} / 2 mud · {card.water} / 1 water{card.clay?` · ${card.clay} bricks made`:''}</small><p>{card.lit?'Shape mud and water into a brick and dry it by the flames. Six bricks line a clay oven.':'Light the fire first.'}</p></div><button type="button" disabled={card.busy||!card.lit||!card.canDryClay} onClick={onDryClay} aria-label="Dry clay bricks">{!card.lit?'Fire is out':card.canDryClay?'Dry clay':card.mud<2?'Need mud':'Need water'}</button></article>
    <div className="food-actions">{card.cookedFish>0&&<button type="button" disabled={card.busy||card.gain<=0} onClick={()=>onEat('cooked_fish')}><ItemIcon id="cooked_fish"/><span>Eat a grilled fish <small>{card.gain>0?`+${card.gain}`:'Full for now'}</small></span></button>}{!card.rawFish&&<button type="button" disabled={card.busy} onClick={onFish}><Icon type="rawfish"/><span>Catch a fish <small>Head to the dock</small></span></button>}</div>
  </>;
}
function DiningPanel({view,onRing,onCook,onFish}){
  const card=view.diningCard;
  if(!card)return <><RecipeBook inventory={view.state?.inventory||{}}/><p>The hall is gone. Build a new one from Build › Community.</p></>;
  const ready=!card.inProgress&&!card.night&&card.servings>0;
  const hungryCount=card.hungry.filter(h=>h.hunger<MAX_HUNGER-10).length;
  return <>
    <RecipeBook inventory={view.state?.inventory||{}}/>
    <div className={`campfire-status ${ready?'lit':'out'}`}><span className="campfire-flame" aria-hidden="true">🔔</span><div><strong>{card.inProgress?'Mealtime is on!':card.night?'Everyone is asleep':card.empty?'The shelf is empty':card.everyoneFull?'Everyone is full':`${card.servings} helping${card.servings===1?'':'s'} ready to serve`}</strong><small>{card.inProgress?'Everyone is at the table.':card.empty?'Cook or gather some food first.':card.everyoneFull?'Save the food for later.':`Ring the bell and ${card.hungry.length} friend${card.hungry.length===1?'':'s'} come to eat: ${card.servedLabel}.`}</small></div><button type="button" disabled={!ready} onClick={onRing} aria-label="Ring the bell for a meal">Ring the bell</button></div>
    <p className="catalogue-note">Everyone sits down together. The meal is served from your bag, hungriest first, and anything not needed stays in the bag.{card.cook?` ${card.cook} rings the bell for breakfast, lunch and dinner at ${card.mealTimes}${card.griller?`, and ${card.griller} grills the catch beforehand`:''}.`:''}</p>
    <h2>Who is hungry</h2>
    <div className="friends-list">{card.hungry.map(h=><div key={h.id} className={`friend-row ${h.hunger<=25?'low':''}`}><span className="friend-face">{h.name.slice(0,1)}</span><span className="friend-body"><strong>{h.name}{h.player&&<i>You</i>}</strong><span className="friend-energy friend-hunger"><i style={{width:`${h.hunger}%`}}/></span><small>{h.hunger}% tummy{h.hunger>=MAX_HUNGER-10?' · full':h.hunger<=25?' · very hungry':''}</small></span></div>)}</div>
    {hungryCount===0&&<p className="catalogue-note">Nobody is hungry right now.</p>}
    <h2>On the shelf</h2>
    {card.shelf.length?<div className="food-actions">{card.shelf.map(f=><div key={f.id} className="shelf-item"><ItemIcon id={f.id}/><span>{f.name} <small>×{f.count}{card.served[f.id]?` · ${card.served[f.id]} to serve`:''}</small></span></div>)}</div>:<div className="food-actions"><button type="button" onClick={onFish}><Icon type="rawfish"/><span>Catch a fish <small>Head to the dock</small></span></button><button type="button" onClick={onCook}><ItemIcon id="cooked_fish"/><span>Grill at the campfire <small>Raw fish → grilled</small></span></button></div>}
    {card.lastMeal&&<p className="catalogue-note">Last meal: {card.lastMeal.diners.length} ate{card.lastMeal.cook?` · ${card.lastMeal.cook} cooked`:''}{card.lastMeal.hungry?.length?` · ${card.lastMeal.hungry.length} still a little hungry`:''}.</p>}
  </>;
}
function OvenPanel({view,onBake,onStoke,onEat,onWater,onHarvest}){
  const card=view.oven;
  if(!card)return <p>The oven is gone. Build a new one from Build › Decorations.</p>;
  const heat=card.hot?'hot':card.lit?'warming':'cold';
  return <>
    <div className={`campfire-status ${card.lit?'lit':'out'} oven-${heat}`}><span className="campfire-flame" aria-hidden="true">{card.hot?'🔥':card.lit?'♨️':'💨'}</span><div><strong>{card.hot?'Hot and ready to bake':card.lit?'Heating up…':'The oven is cold'}</strong><small>{card.hot?`Stays hot for about ${Math.max(1,Math.round(card.minutesLeft/60*10)/10)} island hours`:card.lit?`About ${card.warmSeconds} seconds until it is hot enough`:'Add a log to light it. A cold oven takes a little while to heat up.'}</small>{card.lit&&!card.hot&&<progress value={card.warmth} max={1} aria-label="Oven heat"/>}</div>{card.canStoke&&<button type="button" disabled={card.busy||!card.hasWood} onClick={onStoke} aria-label="Add a log to the oven"><Icon type="wood" size={22}/> Add a log</button>}</div>
    {!card.hasWood&&card.canStoke&&!card.lit&&<p className="catalogue-note">No logs in the bag. Chop a tree first.</p>}
    <h2>In the oven</h2>
    <article className="grill-card"><span className="grill-icon"><ItemIcon id="wheat" size={44}/><i aria-hidden="true">+</i><ItemIcon id="water" size={44}/><i aria-hidden="true">→</i><ItemIcon id="manna" size={44}/></span><div><strong>Bake manna</strong><small>{card.wheat} / 1 wheat · {card.water} / 1 water{card.manna?` · ${card.manna} manna ready to eat`:''}</small><p>{card.hot?'Mix wheat and water and slide it into the hot oven.':card.lit?'Wait for the oven to heat up.':'Light the oven first.'}</p></div><button type="button" disabled={card.busy||!card.hot||!card.canBake} onClick={onBake} aria-label="Bake manna">{!card.lit?'Oven is cold':!card.hot?'Heating up':card.canBake?'Bake':card.wheat<1?'Need wheat':'Need water'}</button></article>
    <div className="food-actions">{card.manna>0&&<button type="button" disabled={card.busy||card.gain<=0} onClick={()=>onEat('manna')}><ItemIcon id="manna"/><span>Eat manna <small>{card.gain>0?`+${card.gain}`:'Full for now'}</small></span></button>}{card.water<1&&<button type="button" disabled={card.busy||!card.hasWell} onClick={onWater}><ItemIcon id="water"/><span>Fetch water <small>{card.hasWell?'Fill a bucket at the well':'Build a water well first'}</small></span></button>}{card.wheat<1&&<button type="button" disabled={card.busy} onClick={onHarvest}><Icon type="wheat"/><span>Harvest wheat <small>Pick ripe wheat from the garden</small></span></button>}</div>
  </>;
}
function WellCard({engine,enabled}){
  const [pop,setPop]=useState(null);
  useEffect(()=>{
    if(!enabled){setPop(null);return;}
    let frame;const update=()=>{setPop(engine.current?.wellPopup?.()||null);frame=requestAnimationFrame(update);};
    frame=requestAnimationFrame(update);return()=>cancelAnimationFrame(frame);
  },[engine,enabled]);
  if(!enabled||!pop) return null;
  return <div className={`well-card ${pop.reason?'blocked':''}`} style={{left:pop.x,top:pop.y}} role="dialog" aria-label={pop.name} onPointerDown={e=>e.stopPropagation()}>
    <button type="button" className="well-card-close" aria-label="Close" onClick={()=>{const g=engine.current;if(g?.building) g.building.wellId=null;g?.notify();}}>×</button>
    <strong>{pop.name}</strong>
    <p>{pop.water} / {pop.max} water</p>
    <button type="button" disabled={!pop.canFetch} aria-label={pop.canFetch?'Fetch water':pop.reason||'Fetch water'} onClick={()=>{const g=engine.current;if(!g) return;g.nutrition.fetchWater(pop.id);g.building.wellId=null;g.notify();}}>Fetch water</button>
    <button type="button" disabled={pop.busy||!pop.canBrick} aria-label="Make a concrete brick" onClick={()=>{const g=engine.current;if(!g) return;g.nutrition.cook('concrete_brick');g.building.wellId=null;g.notify();}}>Make a brick</button>
    <small>2 stone + 1 clay = 1 concrete brick ({pop.stone||0} stone, {pop.clay||0} clay, {pop.bricks||0} bricks)</small>
    {pop.reason&&<small>{pop.reason}</small>}
  </div>;
}
function WellPanel({view,onFetch,onDig,onBrick}){
  const card=view.well;
  if(!card)return <p>The well is gone. Build a new one from Build › Gardens.</p>;
  const full=card.water>=card.max;
  return <>
    <div className="campfire-status lit"><span className="campfire-flame" aria-hidden="true">💧</span><div><strong>Fresh water</strong><small>Watering the garden is free with a well. Fill a bucket to make clay or bake manna.</small></div></div>
    <h2>Fill a bucket</h2>
    <article className="grill-card"><span className="grill-icon"><ItemIcon id="water" size={44}/></span><div><strong>Fetch water</strong><small>{card.water} / {card.max} buckets in the bag</small><p>{full?'The bag is full of water. Use some first.':'Lower the bucket and bring up fresh water. Uses 1 energy.'}</p></div><button type="button" disabled={card.busy||full} onClick={onFetch} aria-label="Fetch water">{full?'Bag is full':'Fetch'}</button></article>
    <h2>What water is for</h2>
    <div className="food-actions"><button type="button" disabled={card.busy} onClick={onDig}><ItemIcon id="mud"/><span>Dig mud at the beach <small>{card.mud} mud in the bag · 2 mud + 1 water = 1 clay brick by the campfire</small></span></button>{card.ovens>0&&<span className="catalogue-note">1 wheat + 1 water bakes one manna in the oven.</span>}<button type="button" disabled={card.busy||!card.canBrick} onClick={onBrick}><ItemIcon id="concrete_brick"/><span>Make a concrete brick <small>2 stone + 1 clay at the well · {card.bricks||0} bricks</small></span></button></div>
  </>;
}
function MetalToolCard({t,view,inventory,ownedTier,onCraft,onFind,onBuild}){
  const status=upgradeStatus(view.state,t.tier),unlocked=t.tier<=ownedTier;
  const job=forgeProgress(view.state,view.minutes??0);
  const forging=!!job&&job.kind!=='shovel'&&job.tier===t.tier&&!unlocked;
  const needsForge=!unlocked&&!forging&&!!status.needsForge;
  const blurb=['','mines iron','mines diamond','mines every vein'][t.tier];
  return <article className={`upgrade-card ${unlocked?'unlocked':''} ${forging?'forging':''}`} style={{'--mineral':t.color}}>
    <div className="upgrade-heading"><span className="upgrade-mark"><Icon type="mine"/></span><div><h2>{t.name} tools</h2><small>{t.power}× strength · {blurb} · {forgeEstimate(t.tier)}</small></div><span className="upgrade-level">{unlocked?'✓':forging?'…':t.tier}</span></div>
    <div className="recipe">{Object.entries(t.recipe).map(([id,n])=>{const have=inventory[id]||0,paid=forging;return <span key={id} className={paid||have>=n?'enough':''}><ItemIcon id={id} size={22}/> {paid?`${n} ${MINERALS[id].name.toLowerCase()} in the forge`:`${have} / ${n} ${MINERALS[id].name.toLowerCase()}`}</span>;})}</div>
    <p>{unlocked?'You made these! Your characters use their strongest tools.':forging?'In the forge. Your characters use these when the timer finishes.':needsForge?(status.forgeBuilding?'Your forge is still being built.':'Metal tools are made at a forge. Build one, then come back to start.'):status.reason}</p>
    {forging&&<div className="forge-progress" role="status"><progress value={job.progress} max="1" aria-label={`${t.name} tools forge progress`}/><small>{forgeTimeLeft(job.remaining)}</small></div>}
    <div className="upgrade-actions">
      {unlocked?<button disabled aria-label={`${t.name} tools are made`}>✓ Made!</button>
        :forging?<button disabled aria-label={`${t.name} tools are forging`}>Forging…</button>
        :needsForge&&status.forgeBuilding?<button disabled aria-label="The forge is still being built">Building the forge…</button>
        :needsForge?<button type="button" disabled={view.busy} onClick={()=>onBuild?.('forge')} aria-label="Build a forge">Build a forge</button>
        :<button disabled={!!status.busy||!status.canCraft||view.busy} onClick={()=>onCraft(t.tier)} aria-label={status.busy?'The forge is busy':`Forge ${t.name.toLowerCase()} tools`}>{status.busy?'Forge is busy':`Forge ${t.name.toLowerCase()} tools`}</button>}
      {!unlocked&&<button className="find-vein" disabled={ownedTier<t.tier-1||view.busy} onClick={()=>onFind(t.find)}>Find {t.find}</button>}
    </div>
  </article>;
}
function ShovelToolCard({t,view,onCraft,onBuild}){
  const owned=shovelTier(view.state).tier,status=shovelStatus(view.state,t.tier),unlocked=t.tier<=owned;
  const job=forgeProgress(view.state,view.minutes??0);
  const forging=!!job&&job.kind==='shovel'&&job.tier===t.tier&&!unlocked;
  const metal=t.tier>1,needsForge=metal&&!unlocked&&!forging&&!!status.needsForge;
  const nameOf=id=>id==='wood'?'wood':MINERALS[id].name.toLowerCase();
  return <article className={`upgrade-card ${unlocked?'unlocked':''} ${forging?'forging':''} ${!t.ready&&!unlocked?'soon':''}`} style={{'--mineral':t.color}}>
    <div className="upgrade-heading"><span className="upgrade-mark"><Icon type="shovel"/></span><div><h2>{t.name}</h2><small>{t.blurb}{metal&&t.forgeDays?` · ${t.forgeDays===.5?'half an island day (~5 min)':'1 island day (~10 min)'}`:''}</small></div><span className="upgrade-level">{unlocked?'✓':forging?'…':t.tier}</span></div>
    <div className="recipe">{Object.entries(t.recipe).map(([id,n])=>{const have=haveOf(view.state,id),paid=forging,label=nameOf(id);return <span key={id} className={paid||have>=n?'enough':''}><ItemIcon id={id} size={22}/> {paid?`${n} ${label} in the forge`:`${have} / ${n} ${label}`}</span>;})}</div>
    <p>{unlocked?(t.tier===1?'You made this! Dig a Water Well from Build › Gardens.':'You made this! Your characters use their strongest shovel.'):forging?'In the forge. Dig uses this shovel when the timer finishes.':needsForge?(status.forgeBuilding?'Your forge is still being built.':'Metal shovels are made at a forge. Build one, then come back to start.'):status.reason}</p>
    {forging&&<div className="forge-progress" role="status"><progress value={job.progress} max="1" aria-label={`${t.name} forge progress`}/><small>{forgeTimeLeft(job.remaining)}</small></div>}
    <div className="upgrade-actions">
      {unlocked?<button disabled aria-label={`${t.name} is made`}>✓ Made!</button>
        :forging?<button disabled aria-label={`${t.name} is forging`}>Forging…</button>
        :needsForge&&status.forgeBuilding?<button disabled aria-label="The forge is still being built">Building the forge…</button>
        :needsForge?<button type="button" disabled={view.busy} onClick={()=>onBuild?.('forge')} aria-label="Build a forge">Build a forge</button>
        :<button disabled={!!status.busy||!status.canCraft||view.busy} onClick={()=>onCraft(t.tier)} aria-label={status.busy?'The forge is busy':metal?`Forge ${t.name.toLowerCase()}`:`Make ${t.name.toLowerCase()}`}>{status.busy?'Forge is busy':!t.ready?'Coming soon':metal?`Forge ${t.short} shovel`:`Make ${t.short} shovel`}</button>}
    </div>
  </article>;
}
function Toolbench({view,onCraft,onCraftShovel,onFind,onBuild}){
  const tier=toolTier(view.state),inventory=view.state.inventory,shovel=shovelTier(view.state),wellBuilt=hasWell(view.state);
  return <><p>Rocks take more work than trees! Each pickaxe hit uses {energyCost(view.state,'mine_hit')} energy. Stone tools are ready right away. Copper, iron, and diamond tools need a forge and take a little while.</p>
    <div className="tool-current"><Icon type="mine"/><div><strong>Your {tier.name.toLowerCase()} tools</strong><small>{tier.power}× strength · axe and pickaxe</small></div></div>
    <div className="mineral-wallet">{Object.entries(MINERALS).map(([id,m])=><div key={id}><span><ItemIcon id={id}/></span><strong>{inventory[id]||0}</strong><small>{m.name}</small></div>)}</div>
    <div className="upgrade-cards">{TOOL_TIERS.slice(1).map(t=><MetalToolCard key={t.tier} t={t} view={view} inventory={inventory} ownedTier={tier.tier} onCraft={onCraft} onFind={onFind} onBuild={onBuild}/>)}</div>
    <h2 className="digging-heading">Digging tools</h2><p>The Dig tool uses your best finished shovel. A wooden shovel digs a Water Well. A copper shovel digs faster, and an iron shovel digs fastest. A shovel still in the forge does not count. Basic Dig still works with no forge.</p>
    <div className="tool-current digging"><Icon type="shovel"/><div><strong>{shovel.tier?`Your ${shovel.short} shovel`:'Basic Dig'}</strong><small>{shovel.tier>=3?'Digs fastest':shovel.tier>=2?'Digs faster':shovel.tier?(wellBuilt?'Your well is dug · watering costs no energy':'Ready to dig a Water Well'):'Dig still works. Make a shovel below to dig faster.'}</small></div>{shovel.tier>0&&!wellBuilt&&onBuild&&<button type="button" className="dig-now" disabled={view.busy} onClick={()=>onBuild('well')}>Dig a well →</button>}</div>
    <div className="upgrade-cards shovel-cards">{SHOVEL_TIERS.slice(1).map(t=><ShovelToolCard key={t.tier} t={t} view={view} onCraft={onCraftShovel} onBuild={onBuild}/>)}</div>
    <button className="find-stone" disabled={view.busy} onClick={()=>onFind('stone')}><Icon type="stone" size={28}/><span>Smash a stone rock</span></button><p className="catalogue-note">Coloured crystals mark mineral veins. Ordinary stone sometimes hides copper or a diamond. The forge makes one thing at a time — a tool set or a shovel. Tools you already made stay made. A shovel still in the forge is not ready yet.</p><div className="stats-row"><span>{view.state.stats.rocks||0} rocks broken</span><span>{view.state.stats.gems||0} diamonds found</span></div></>;
}
const TOAST_BUILDINGS=[...BUILDINGS].sort((a,b)=>b.name.length-a.name.length);
const TOAST_ANIMALS=[...ANIMALS].sort((a,b)=>b.name.length-a.name.length);
/** Icon for a toast line. Uses a kind when one is passed; otherwise reads the words. */
function toastArt(text,kind){
  const t=String(text||'').toLowerCase();
  if(kind==='chop'||kind==='wood'||kind==='fire') return {icon:kind==='chop'&&!/\blog|wood|campfire/.test(t)?'axe':'wood'};
  if(kind==='meal'||kind==='food') return {icon:'food'};
  if(kind==='garden') return {icon:'plant'};
  if(kind==='fence') return {poster:'fence'};
  if(kind==='build') return {icon:'build'};
  if(kind==='animal'){const named=TOAST_ANIMALS.find(a=>t.includes(a.name.toLowerCase()));return {emoji:named?.emoji||'🐑'};}
  const logFire=/\blog\b/.test(t)&&/\b(campfire|oven|fire)\b/.test(t);
  if(/\b(put a log|log added|logs? in the bag|wood put away|wood space|extra logs)\b/.test(t)||/\+\d+[^\n]{0,48}\bwood\b/.test(t)||logFire) return {icon:'wood'};
  if(/\b(felled|chopped|chop)\b/.test(t)) return {icon:'axe'};
  const named=TOAST_BUILDINGS.find(b=>t.includes(b.name.toLowerCase()));
  const placing=/\b(finished|built|put up|started on|heaped up|build a|build the)\b/.test(t);
  if(placing&&named) return {poster:named.poster||named.id};
  if(/\b(fence|paddock|gate)\b/.test(t)) return {poster:'fence'};
  if(placing) return {icon:'build'};
  if(/cooked fish|grilled fish/.test(t)) return {icon:'cookedfish'};
  if(/raw fish/.test(t)) return {icon:'rawfish'};
  if(/\bmanna\b/.test(t)) return {icon:'manna'};
  if(/\bbread\b/.test(t)) return {icon:'bread'};
  if(/\bapples?\b/.test(t)) return {icon:'apple_seed'};
  if(/\bcarrots?\b/.test(t)&&!/\bwater/.test(t)) return {icon:'carrot'};
  if(/\bpumpkins?\b/.test(t)&&!/\bwater/.test(t)) return {icon:'pumpkin'};
  if(/\bwheat\b/.test(t)&&!/\bwater/.test(t)) return {icon:'wheat'};
  if(/\b(salad|meal|snack|snacks|breakfast|eaten|food|hungry|tummy|yum)\b/.test(t)||/\bfish\b/.test(t)) return {icon:'food'};
  if(/\bcampfire\b/.test(t)) return {icon:'wood'};
  if(/\b(weed|weeds|planted|planting|garden|plot|sprout|seeds?)\b/.test(t)) return {icon:'plant'};
  if(/\b(picked|harvest|crops)\b/.test(t)) return {icon:'harvest'};
  if(/\b(water|watered|trough|thirsty|bucket|well)\b/.test(t)) return {icon:'water'};
  const animal=TOAST_ANIMALS.find(a=>t.includes(a.name.toLowerCase()));
  if(animal) return {emoji:animal.emoji};
  if(/\b(animals?|herd|strays?|arrivals?)\b/.test(t)) return {emoji:'🐑'};
  if(/\b(smash|pickaxe|rocks?|diamond|copper|iron)\b/.test(t)) return {icon:'mine'};
  if(/\bstone\b/.test(t)) return {icon:'stone'};
  if(/\b(shovel|dig|mud)\b/.test(t)) return {icon:'shovel'};
  if(/\b(sleep|rest|tired|energy|wake|awake)\b/.test(t)) return {icon:'rest'};
  if(/\bpray/.test(t)||/\bamen\b/.test(t)) return {icon:'pray'};
  return {star:true};
}
function ToastMark({text,kind}){
  const art=toastArt(text,kind);
  if(art.poster) return <img className="toast-icon" src={`/assets/build_${art.poster}.png`} width={28} height={28} alt="" aria-hidden="true" draggable={false} decoding="async"/>;
  if(art.emoji) return <span className="toast-emoji" aria-hidden="true">{art.emoji}</span>;
  if(art.star||!art.icon) return <svg className="toast-icon toast-star" viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" focusable="false"><path fill="#e2b04a" stroke="#a67c2d" strokeWidth="1.2" strokeLinejoin="round" d="M14 3.2 16.8 9.6 23.8 10.2 18.5 14.8 20.1 21.7 14 18.1 7.9 21.7 9.5 14.8 4.2 10.2 11.2 9.6Z"/></svg>;
  return <Icon type={art.icon} size={28}/>;
}
function ToastLine({text,kind,className,style}){
  const art=toastArt(text,kind);
  const mark=art.poster?`poster:${art.poster}`:art.emoji?'animal':art.star||!art.icon?'star':art.icon;
  return <div className={className} style={style} role="status" data-toast-icon={mark}><ToastMark text={text} kind={kind}/><span className="toast-text">{text}</span></div>;
}
function pinBuildGoal(g,kind){
  const def=BUILDINGS.find(b=>b.id===kind);if(!def||!g)return;
  g.addTodayGoal({id:'raise',title:`Raising the ${def.name}`,kind});
  const ask=g.buildAsk;
  if(typeof ask?.requestBuilding==='function'){
    const noah=ask.bySkill?.('woodcutter');
    ask.requestBuilding(noah?.userData||null,kind,def.name);
  }
}
function App(){
  const host=useRef(null),engine=useRef(null);const [view,setView]=useState({loaded:false,status:'Loading your island…'}),[panel,setPanel]=useState(null),[showTime,setShowTime]=useState(false),[toast,setToast]=useState(''),[toastLife,setToastLife]=useState(0),[confirmReset,setConfirmReset]=useState(false);
  const [playerName,setPlayerName]=useState(playerNameFromUrl);
  useEffect(()=>{
    const onMessage=e=>{
      if(e.origin!==location.origin||!e.data||e.data.type!=='gk-player-name')return;
      setPlayerName(readPlayerName(e.data.name));
    };
    window.addEventListener('message',onMessage);
    return()=>window.removeEventListener('message',onMessage);
  },[]);
  const drawer=useRef(null),timeDialog=useRef(null),mapButton=useRef(null),backToPlay=useRef(null),previousOverview=useRef(false);
  const [mapOnly,setMapOnly]=useState(false),[actionsOpen,setActionsOpen]=useState(false),[actionsTab,setActionsTab]=useState('actions'),[friendsOpen,setFriendsOpen]=useState(false);
  const actionsButton=useRef(null);
  const [sleepHomeId,setSleepHomeId]=useState(null);
  // Island to-do list: pops up once the Players World has settled, reopenable from the side buttons.
  const [plan,setPlan]=useState(null),planShown=useRef(false);
  const openPlan=()=>{const g=engine.current;if(!g?.loaded)return;setActionsOpen(false);setPanel(null);try{if(window.parent&&window.parent!==window)window.parent.postMessage({type:'gk-coins-please'},location.origin);}catch{/* standalone island */}setPlan({today:g.todayCard(),village:g.village?.plan()||null,coins:g.coinBalance()});};
  const refreshPlan=()=>{const g=engine.current;if(!g?.loaded)return;setPlan(p=>p?{today:g.todayCard(),village:g.village?.plan()||null,coins:g.coinBalance()}:p);};
  const planOpen=!!plan;
  useEffect(()=>{if(!planOpen)return;const t=setInterval(refreshPlan,1000);return()=>clearInterval(t);},[planOpen]);
  useEffect(()=>{if(view.ui?.openPlan)openPlan();},[view.ui?.openPlan]);
  useEffect(()=>{if(!view.sitePicking)return;setPanel(null);setShowTime(false);setActionsOpen(false);setFriendsOpen(false);setPlan(null);},[view.sitePicking]);
  // First-visit tour (onboarding.jsx): while it is pending the to-do sheet waits; the tour's "Homes" step opens it by hand.
  const [tourActive,setTourActive]=useState(false);
  useEffect(()=>{if(!view.loaded||!view.playersOnly||view.ambient||planShown.current||onboardingPending())return;planShown.current=true;const t=setTimeout(openPlan,1400);return()=>clearTimeout(t);},[view.loaded,view.playersOnly,view.ambient]);
  useDialogFocus(panel,drawer,()=>close());
  useDialogFocus(showTime,timeDialog,()=>setShowTime(false));
  useEffect(()=>{if(panel&&drawer.current)drawer.current.scrollTop=0;},[panel]);
  useEffect(()=>{const game=new HomeWorld(host.current,setView);engine.current=game;window.__hw=game;return()=>{if(window.__hw===game)delete window.__hw;game.dispose();};},[]);
  const lastToast=view.toasts?.[0];useEffect(()=>{if(!lastToast){setToast('');setToastLife(0);return;}setToast(lastToast.text);setToastLife(lastToast.ms||0);const timer=setTimeout(()=>{setToast('');setToastLife(0);},lastToast.ms||6000);return()=>clearTimeout(timer);},[lastToast?.id]);
  const game=()=>engine.current,inventory=view.state?.inventory||{},busy=view.busy,stats=view.state?.stats||{};
  const invoke=(fn)=>{try{fn(game());}catch(e){setToast(e.message);}};
  const zoomTouchAt=useRef(0);
  // pointerup fires on iPad where click often does not; the click path is kept for keyboards and
  // ignored for 700 ms after a pointer tap so one tap never zooms twice.
  const onZoom=event=>{
    if(event.type==='pointerup'){
      if(event.pointerType==='mouse'&&event.button!==0)return;
      event.preventDefault();event.stopPropagation();
      zoomTouchAt.current=performance.now();
      invoke(g=>g.cycleZoom());
      return;
    }
    if(performance.now()-zoomTouchAt.current<700)return;
    invoke(g=>g.cycleZoom());
  };
  // Same dual path as Zoom. The old pointerup-only handler also dropped any 'mouse' pointer whose
  // button was not 0 — an iPad trackpad tap reports pointerType 'mouse' with button -1 on pointerup,
  // so Back To Ship did nothing there. Only real secondary buttons are ignored now, click covers
  // keyboards and shells where pointerup is swallowed, and a 700 ms guard keeps one tap from firing twice.
  const shipTapAt=useRef(0);
  const onBackToShip=event=>{
    if(event.type==='pointerup'){
      if(event.pointerType==='mouse'&&event.button>0)return;
      event.stopPropagation();
      shipTapAt.current=performance.now();
    }else if(performance.now()-shipTapAt.current<700)return;
    const g=engine.current;
    if(g?.interior){g.building.leaveHome();return;}
    window.parent?.postMessage({type:'gk-back-to-ship'},location.origin);
  };
  const [campfireId,setCampfireId]=useState(null);
  const [ovenId,setOvenId]=useState(null);
  const [wellId,setWellId]=useState(null);
  useEffect(()=>{const menu=view.building?.openMenu;if(!menu||menu.id==='well')return;setActionsOpen(false);setSleepHomeId(menu.homeId||null);setCampfireId(menu.fireId||null);setOvenId(menu.ovenId||null);setWellId(menu.wellId||null);setPanel(menu.id);},[view.building?.openMenu?.nonce]);
  useEffect(()=>{
    if(!view.inside) return;
    const key=e=>{if(e.key!=='Escape') return;e.preventDefault();e.stopPropagation();engine.current?.building?.leaveHome();};
    window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);
  },[view.inside]);
  const close=()=>{if(panel==='report'&&(view.unreadReport||view.report))invoke(g=>g.store.commit({type:'read_report',id:(view.unreadReport||view.report).id,actionId:crypto.randomUUID()}));setPanel(null);};
  useEffect(()=>{if(view.playersOnly)return;if(view.unreadReport&&!view.busy&&!view.building?.preview){setActionsOpen(false);setShowTime(false);setPanel('report');}},[view.playersOnly,view.unreadReport?.id,view.busy,!!view.building?.preview]);
  const openPanel=id=>{if(id==='sleep')setSleepHomeId(null);setActionsOpen(false);if(engine.current?.building?.clearPlan)engine.current.building.clearPlan=null;if(engine.current?.building?.preview)engine.current.building.cancelPreview();setShowTime(false);setPanel(id);};
  const runAction=fn=>{setActionsOpen(false);invoke(fn);};
  const toggleActions=()=>{
    if(actionsOpen){setActionsOpen(false);return;}
    if(game()?.building?.preview)game().building.cancelPreview();
    setPanel(null);setShowTime(false);setActionsOpen(true);
  };
  useEffect(()=>{
    if(!actionsOpen)return;
    const key=e=>{if(e.key==='Escape'){e.preventDefault();setActionsOpen(false);actionsButton.current?.focus();}};
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[actionsOpen]);
  const showFullMap=()=>{
    const g=game();if(!g?.loaded||g.building?.preview)return;
    previousOverview.current=g.overview;g.keys.clear();g.mapGesture.cancel();g.mapOnly=true;
    if(!g.overview)g.toggleMap();
    setPanel(null);setShowTime(false);setActionsOpen(false);setMapOnly(true);
  };
  const returnToPlay=()=>{
    const g=game();if(g){g.mapGesture.cancel();g.mapOnly=false;if(g.overview!==previousOverview.current)g.toggleMap();}
    setMapOnly(false);
  };
  useEffect(()=>{
    if(!mapOnly)return;
    backToPlay.current?.focus();
    const key=e=>{if(e.key==='Escape'){e.preventDefault();returnToPlay();}};
    window.addEventListener('keydown',key);
    return()=>{window.removeEventListener('keydown',key);mapButton.current?.focus();};
  },[mapOnly]);
  const activeTool=TOOLS.find(t=>t.id===view.tool);
  const showRecent=view.loaded&&!view.ambient&&!panel&&!actionsOpen&&!view.fishing&&!view.night?.sleeping&&!mapOnly&&view.recentTools?.length>0&&!view.building?.preview;
  const seed=SEEDS.find(s=>s.id===view.seed)||SEEDS[0];
  if(LIVING_TEST)return <LivingTestUI host={host} engine={engine} view={view}/>;
  return <main className={`game-shell ${mapOnly?'map-only':''}${view.sitePicking?' site-view':''}`} onPointerDownCapture={()=>{engine.current?.music?.unlock();engine.current?.community?.activity();}} onKeyDownCapture={()=>{engine.current?.music?.unlock();engine.current?.community?.activity();}} onWheelCapture={()=>engine.current?.community?.activity()}>
    <div ref={host} className="world" onPointerDown={()=>setActionsOpen(false)}/>
    <div className="game-controls" hidden={mapOnly||view.night?.sleeping||!!view.fishing?.firstPerson} inert={mapOnly||view.night?.sleeping||!!view.fishing?.firstPerson}>
    <header className="topbar">
      {view.loaded&&!view.playersOnly&&<button className="selected-character" aria-label={`Choose character. Playing as ${view.state.characters[view.state.activeCharacter].name}`} onClick={()=>openPanel('characters')}><span className={`community-avatar ${view.state.activeCharacter}`} aria-hidden="true">{view.state.characters[view.state.activeCharacter].name[0]}</span><span><small>Playing as</small><strong>{view.state.characters[view.state.activeCharacter].name} ⌄</strong></span></button>}
      <div className="top-actions">
        <button type="button" className={`sound-button ${view.music===false?'off':''}`} aria-pressed={view.music!==false} aria-label={view.music===false?'Sound is off. Turn music on':'Sound is on. Turn music off'} onClick={()=>invoke(g=>g.setMusic(g.music?.on===false))}><span className="sound-mark" aria-hidden="true">{view.music===false?'🔇':'🔊'}</span><span>{view.music===false?'Off':'Sound'}</span></button>
        <button className="clock-button" onClick={()=>{setActionsOpen(false);setPanel(null);setShowTime(!showTime);}} aria-label={playerName?`Day and time. Playing as ${playerName}`:'Day and time'} aria-expanded={showTime}><Icon type={view.night?.dusk||view.night?.night?"moon":"sun"}/><span className="clock-readout"><strong>{yearClockLabel(view.clock?.day||1)} · {view.clock?.text||'8:00 AM'}</strong><small>{playerName?<b className="clock-player">{playerName}</b>:null}<span className="clock-bedtime">{view.state?.clock.paused?'Time is paused':view.night?.dusk?'Bedtime soon':'Bedtime at 10 PM'}</span></small></span><span className="chevron">⌄</span></button>
      </div>
    </header>
    {view.loaded&&activeTool&&!panel&&!showTime&&!view.building?.preview&&!showRecent&&<div className="equipped-tool-chip" role="group" aria-label="Equipped tool"><Icon type={activeTool.id} size={32}/><span>{activeTool.name}<small>Tool ready</small></span><button aria-label={`Put away ${activeTool.name} tool`} title="Put tool away. Walk normally." onClick={()=>runAction(g=>{g.unequipTool();g.renderer.domElement.focus({preventScroll:true});})}><b aria-hidden="true">×</b><small>Put away</small></button></div>}
    <ResourceHealth engine={engine} enabled={view.loaded&&!mapOnly&&!view.overview&&!panel&&!showTime&&!actionsOpen&&!view.building?.preview}/>
    <CharacterVitals engine={engine} onInspect={()=>setActionsOpen(false)} enabled={view.loaded&&!view.playersOnly&&!mapOnly&&!view.overview&&!panel&&!showTime&&!view.building?.preview}/>
    <ResidentGreeting engine={engine} enabled={view.loaded&&view.playersOnly&&!mapOnly&&!view.overview&&!panel&&!showTime&&!view.building?.preview&&!view.fishing}/>
    <MealAsk engine={engine} enabled={view.loaded&&view.playersOnly&&!mapOnly&&!view.fishing}/>
    <div className="site-ask"><SiteAsk engine={engine} enabled={view.loaded&&view.playersOnly&&!mapOnly&&!view.fishing}/></div>
    <PlantPeek engine={engine} enabled={view.loaded&&!mapOnly&&!view.overview&&!panel&&!showTime&&!view.building?.preview&&!view.fishing}/>
    <BuildPeeks engine={engine} enabled={view.loaded&&!mapOnly&&!view.overview&&!panel&&!showTime&&!view.building?.preview&&!view.fishing&&!plan}/>
    {showTime&&<div className="time-shade" onClick={()=>setShowTime(false)}><section ref={timeDialog} tabIndex={-1} className="time-panel panel" role="dialog" aria-modal="true" aria-label="Day and time" onClick={e=>e.stopPropagation()}><div className="panel-title"><strong><Icon type="sun" size={28}/> Day & night</strong><button data-dialog-close className="close" onClick={()=>setShowTime(false)} aria-label="Back to island">← Back</button></div><p>A full island day takes 10 minutes. Dusk arrives in the last minute before 10 PM bedtime. Everyone rests through a 10-second night, then wakes at 7 AM. Homes give a full energy refill. Plants keep growing overnight.</p><details className="grownup-tools"><summary>Grown-up test tools</summary><p>These buttons change time or restart this local game.</p><div className="time-buttons"><button disabled={!view.loaded} onClick={()=>invoke(g=>g.clockChange(0,!view.state.clock.paused))}>{view.state?.clock.paused?'▶ Start time':'Ⅱ Pause time'}</button><button onClick={()=>invoke(g=>g.previewTime('dusk'))}>Preview dusk</button><button onClick={()=>{setShowTime(false);invoke(g=>g.previewTime('bedtime'));}}>Preview bedtime</button><button onClick={()=>invoke(g=>g.clockChange(360))}>Skip 6 hours</button><button onClick={()=>invoke(g=>g.clockChange(1440))}>Skip 1 day</button></div><label className="slow"><input type="checkbox" checked={view.animationRate<1} onChange={e=>invoke(g=>g.setAnimationRate(e.target.checked?.35:1))}/>Slow down tool moves</label><div className="reset-row"><button disabled={busy} onClick={()=>setConfirmReset(true)}>Start a new test</button><button disabled={busy} onClick={()=>invoke(g=>g.reset(true))}>Bring back previous test</button></div>{confirmReset&&<div className="reset-question" role="group" aria-label="Start a new test?"><p>Start again? We’ll keep your current game as the previous test.</p><button onClick={()=>{invoke(g=>g.reset());setConfirmReset(false);}}>Start new test</button><button onClick={()=>setConfirmReset(false)}>Keep playing</button></div>}</details></section></div>}

    {view.inside&&<div className="home-outside-bar"><button type="button" className="home-outside" onClick={()=>invoke(g=>g.building.leaveHome())}>Outside</button><span className="home-inside-status" role="status">Inside the {view.inside.name}</span></div>}
    {view.playersOnly&&!panel&&!actionsOpen&&!view.fishing&&<button type="button" className="ship-button" aria-label="Back to the ship" onPointerUp={onBackToShip} onClick={onBackToShip}><img src={SHIP_ICON} alt="" draggable={false}/><span>Back To Ship</span></button>}
    <nav className="side-buttons" aria-label="Explore your island">
      {view.playersOnly&&<button aria-label="Open the island to-do list" disabled={!view.loaded||view.ambient} onClick={openPlan}><Icon type="book"/><span>To-do</span></button>}
      <button aria-label="Open my bag" onClick={()=>openPanel('inventory')}><Icon type="bag"/><span>My bag</span></button>
      <button ref={mapButton} aria-label="Show full island map" onClick={showFullMap} disabled={!view.loaded||!!view.building?.preview}><Icon type="map"/><span>Map</span></button>
      <button type="button" aria-label="Zoom closer; from the closest view it zooms back out" onPointerUp={onZoom} onClick={onZoom}><Icon type="zoom"/><span>Zoom</span></button>
      <button ref={actionsButton} className={`actions-menu-button ${activeTool?'has-tool':''}`} aria-label="Open build" aria-expanded={actionsOpen} aria-controls="action-menu" disabled={!view.loaded||view.ambient} onClick={toggleActions}><img className="picture-icon higgsfield-icon" src="/icons/higgsfield/build_home.png?v=cottage1" width={44} height={44} alt="" aria-hidden="true" draggable={false} decoding="async" data-game-icon="build_home" data-icon-source="higgsfield"/><span>Build</span>{activeTool&&<i className="equipped-mark" aria-hidden="true">✓</i>}</button>
      <button className="tools-chip" aria-label="Open tools and upgrades" disabled={!view.loaded||view.ambient} onClick={()=>openPanel('tools')}><Icon type="mine"/><span>Tools</span></button>
    </nav>
    {view.reel&&<div className="reel-caption" role="status" aria-live="polite"><span className="reel-dot"/><span className="friend-face">{view.reel.imageUrl?<img src={view.reel.imageUrl} alt=""/>:view.reel.name[0]}</span><span className="reel-text"><strong>Watching {view.reel.name}</strong><small>{view.reel.label}</small></span><button type="button" onClick={()=>invoke(g=>g.residents.stopReel())}>Take over</button></div>}
    {/* Stage badge sits top-left; the Friends button hangs directly below it (stage-journey.css / .friends-button). */}
    {view.loaded&&view.playersOnly&&!view.ambient&&!view.fishing&&!view.inside&&view.stages&&<StageBadge stages={view.stages} onOpen={()=>{setActionsOpen(false);setFriendsOpen(false);setPanel(null);setShowTime(false);setPlan(null);invoke(g=>g.stages?.toggle());}}/>}
    {view.playersOnly&&!view.fishing&&!view.inside&&<button type="button" className={`friends-button ${friendsOpen?'open':''}`} aria-expanded={friendsOpen} aria-label={view.friendsWaiting?.count?`Friends. ${view.friendsWaiting.count} waiting to come ashore`:'Friends'} disabled={!view.loaded} onClick={()=>{setActionsOpen(false);if(!view.friends?.length){window.parent?.postMessage({type:'gk-open-friends'},location.origin);return;}setFriendsOpen(o=>!o);}}><FriendsIcon/><span>{view.friendsWaiting?.count>0&&view.friendsWaiting.name&&!friendsOpen?<>Drop off<br/>{view.friendsWaiting.name}</>:'Friends'}</span>{view.friendsWaiting?.count>0&&<b className="friends-badge">{view.friendsWaiting.count}</b>}</button>}
    {friendsOpen&&view.playersOnly&&!view.fishing&&<><div className="friends-shade" onClick={()=>setFriendsOpen(false)}/><div className="friends-menu" role="menu" aria-label="Friends on the island">
      <div className="friends-menu-scroll" onWheel={e=>e.stopPropagation()} onTouchMove={e=>e.stopPropagation()} onScroll={e=>{const el=e.currentTarget;el.classList.add('is-scrolling');clearTimeout(el._friendsScroll);el._friendsScroll=setTimeout(()=>el.classList.remove('is-scrolling'),400);}}>
      {view.friends.map(f=>{const skill=skillFor(f.name);return <button key={f.id} type="button" role="menuitem" className={`friend-row ${f.selected?'selected':''} ${f.energy<=20||f.hunger<=25?'low':''}`} onClick={()=>{setFriendsOpen(false);invoke(g=>g.residents.select(f.id));}} aria-label={`${f.name}. Energy ${f.energy}. Tummy ${f.hunger} percent. ${f.status}. ${f.selected?'You are playing as them':'Tap to watch them; play as them from their card'}`}>
        <span className="friend-row-in">
        <span className="friend-face">{f.imageUrl?<img src={f.imageUrl} alt=""/>:f.name.slice(0,1)}</span>
        <span className="friend-body"><strong>{f.name}{f.selected&&<i>You</i>}</strong><span className="friend-energy"><i style={{width:`${f.energy}%`}}/></span><span className="friend-energy friend-hunger"><i style={{width:`${f.hunger}%`}}/></span><small>{f.energy} energy · {f.hunger}% tummy · {f.status}</small>{skill&&<small className="friend-skill">★ {skill.name} · {skill.short}{skill.blurb&&<span className="friend-blurb" role="tooltip">{skill.blurb}</span>}</small>}{f.role&&<small className="friend-role">{f.role.title||`${f.role.levelName} ${f.role.name}`}{f.role.fixed?'':` · ${f.role.xp}${f.role.next?`/${f.role.next}`:''} xp`}</small>}</span>
        </span>
      </button>;})}
      {view.friends.length>1&&<button type="button" role="menuitem" className="friend-row watch" onClick={()=>{setFriendsOpen(false);invoke(g=>g.residents.startReel());}}><span className="friend-row-in"><span className="friend-face plus">▶</span><span className="friend-body"><strong>Just watch</strong><small>Sit back: the camera follows whoever is busy. Tap anywhere to take over.</small></span></span></button>}
      <button type="button" role="menuitem" className="friend-row more" onClick={()=>{setFriendsOpen(false);window.parent?.postMessage({type:'gk-open-friends'},location.origin);}}><span className="friend-row-in"><span className="friend-face plus">+</span><span className="friend-body"><strong>Story friends</strong><small>{view.friendsWaiting?.count>0?`${view.friendsWaiting.count} waiting to come ashore`:'Drop off a friend or send one to the ship'}{view.beds&&<> · {view.beds.beds} bed{view.beds.beds===1?'':'s'} for {view.beds.residents} friend{view.beds.residents===1?'':'s'}{!view.beds.canDrop&&view.friendsWaiting?.count>0?' · build a home with a free bed':''}</>}</small></span></span></button>
      </div>
    </div></>}
    {view.loaded&&!panel&&!actionsOpen&&!view.building?.preview&&!view.fishing&&!view.night?.sleeping&&view.harvestPrompts?.map(h=><button key={h.key} type="button" className={`harvest-prompt ${h.kind}`} style={{left:h.x,top:h.y}} aria-label={h.kind==='harvest'?`Pick the ${h.name.toLowerCase()}`:`The ${h.name.toLowerCase()} is thirsty. Water it`} onClick={()=>invoke(g=>g.gardenAction(h.kind,h.key))}><Icon type={h.kind==='harvest'?h.plant:'water_drop'} size={26}/><b>{h.kind==='harvest'?<Icon type="harvest" size={14}/>:'!'}</b></button>)}
    {view.loaded&&!panel&&!actionsOpen&&!view.building?.preview&&!view.fishing&&!view.night?.sleeping&&view.snakePrompts?.map(s=><div key={s.id} className="snake-prompt" style={{left:s.x,top:s.y}}><button type="button" aria-label="Shoo the snake" onClick={()=>invoke(g=>g.animals?.shoo(s.id))}>🐍 Shoo</button></div>)}
    {view.loaded&&!panel&&!view.night?.sleeping&&view.prayer&&<div className={`prayer-bubble ${view.prayer.praying?'':'done'}`} style={{left:view.prayer.x,top:view.prayer.y}} role="status" aria-live="polite"><Icon type="pray" size={30}/><div className="prayer-body"><strong>{view.prayer.name} prays</strong><p>{view.prayer.text}</p><small>{view.prayer.verse}</small></div></div>}
    {view.loaded&&!panel&&!actionsOpen&&!view.building?.preview&&!view.fishing&&!view.night?.sleeping&&!view.inside&&view.prompt&&(view.prompt.kind==='home'
      ? <div className="object-prompt home-go-in" style={{left:view.prompt.x,top:view.prompt.y}} role="group" aria-label="Go in or move"><button type="button" className="go-in-button" onClick={()=>invoke(g=>g.runPrompt('enter'))}>Go in</button><button type="button" className="go-in-button" onClick={()=>invoke(g=>g.runPrompt('move'))}>Move</button></div>
      : <div className="object-prompt" style={{left:view.prompt.x,top:view.prompt.y}} role="group" aria-label="What to do here">{view.prompt.actions.map(a=><button key={a.id} type="button" onClick={()=>invoke(g=>g.runPrompt(a.id))} aria-label={a.label}><span className="object-prompt-icon"><Icon type={a.icon} size={28}/></span><small>{a.label}</small></button>)}</div>)}
    {view.loaded&&!panel&&!view.fishing&&!view.night?.sleeping&&!view.inside&&<WellCard engine={engine} enabled/>}
    {view.loaded&&!panel&&!actionsOpen&&!view.building?.preview&&!view.fishing&&!view.night?.sleeping&&view.firePrompts?.map(f=><button key={f.id} type="button" className={`fire-prompt ${f.out?'out':''}`} style={{left:f.x,top:f.y}} aria-label={f.out?'The campfire is out. Add a log':`The campfire burns out in ${f.minutes} minutes. Add a log`} onClick={()=>invoke(g=>g.nutrition.stokeFire(f.id))}><Icon type="wood" size={26}/><b>!</b></button>)}
    {view.fishPrompt&&!panel&&!actionsOpen&&!view.building?.preview&&<button type="button" className={`fish-prompt ${view.fishPrompt.near?'near':''}`} style={{left:view.fishPrompt.x,top:view.fishPrompt.y}} onClick={()=>invoke(g=>g.nutrition.goFish())} aria-label="Go fishing from the dock"><Icon type="fish" size={30}/><span>Fish?</span></button>}
    {toast&&<ToastLine text={toast} className={`toast${toastLife?' brief':''}`} style={toastLife?{'--toast-life':`${toastLife}ms`}:undefined}/>}
    {view.animals?.hello&&<ToastLine key={view.animals.hello.shownAt} text={view.animals.hello.text} className="toast animal-hello"/>}
    {view.loaded&&view.animals?.confirming&&!view.animals?.placing&&!panel&&<div className="animal-confirm animal-place-chip" role="dialog" aria-label={`Buy a ${view.animals.confirming.name}`}><span className="animal-place-emoji" aria-hidden="true">{view.animals.confirming.emoji}</span><span>Buy a {view.animals.confirming.name.toLowerCase()} for <b>{view.animals.confirming.price}</b> gold coins?</span><button type="button" onClick={()=>invoke(g=>g.animals?.confirmBuy())}>Buy</button><button type="button" className="plain" onClick={()=>invoke(g=>g.animals?.cancelPlace())}>Not now</button></div>}
    {view.loaded&&!panel&&!actionsOpen&&!view.fishing&&!view.night?.sleeping&&!view.inside&&!view.animals?.confirming&&!view.animals?.placing&&!view.building?.preview&&<FarmCard farm={view.farm} onRun={invoke}/>}
    {view.loaded&&!panel&&!view.night?.sleeping&&!view.inside&&<FarmBubble farm={view.farm}/>}
    {view.loaded&&!view.night?.sleeping&&<RecipeBubble bubble={view.recipeBubble}/>}
    {view.loaded&&view.animals?.placing&&!panel&&<div className="animal-place-chip" role="status"><span className="animal-place-emoji" aria-hidden="true">{view.animals.placing.emoji}</span><span>Tap grass to place the {view.animals.placing.name.toLowerCase()}<small>Water and buildings are off limits</small></span><button onClick={()=>invoke(g=>g.animals?.cancelPlace())} aria-label="Cancel placing the animal">Cancel</button></div>}
    {view.nutrition?.sleep&&<SleepBubble sleep={view.nutrition.sleep} onWake={()=>invoke(g=>g.nutrition.wakeUp())} onRetry={()=>invoke(g=>g.nutrition.retrySleep())}/>}
    {view.loaded&&<section className={`bottom-hud ${view.building?.preview?'placing':''} ${actionsOpen?'actions-open':''}`}>
      {view.building?.preview?.stroke?<StrokeBar preview={view.building.preview} onDone={()=>invoke(g=>g.building.cancelPreview())}/>:view.building?.preview?<PlacementControls preview={view.building.preview} onPlace={()=>invoke(g=>g.building.place())} onCrew={ids=>invoke(g=>g.building.setCrew(ids))} onRotate={()=>invoke(g=>g.building.rotate())} onCancel={()=>invoke(g=>g.building.cancelPreview())} onMove={(x,y)=>invoke(g=>g.building.nudge(x,y))} onFind={()=>invoke(g=>g.building.findAnother())} onClear={()=>invoke(g=>g.building.clearSpot())} onClearWith={id=>invoke(g=>g.building.beginClear(id))} onGoal={()=>invoke(g=>g.building.setGoalFromPreview())} onTakeDown={()=>invoke(g=>g.building.askRemove(g.building.preview?.movingId))}/>:<>
      {buildProgressItems(view.building?.items).map(b=><div className="build-progress panel" key={b.id} role="status"><span><Icon type="build" size={34}/></span><div><strong>{b.name}</strong><small>{b.status==='queued'?'Walking to build…':`Building… ${b.remaining}s`}</small><progress value={b.progress} max="1"/></div></div>)}
      {showRecent&&<div className="recent-tools" role="toolbar" aria-label="Recent tools"><span className="recent-tools-label">Recent Tools</span><div className="recent-tools-row">{activeTool&&<button type="button" className="recent-put-away" aria-label={`Put away ${activeTool.name} tool`} title="Put tool away. Walk normally." onClick={()=>runAction(g=>{g.unequipTool();g.renderer.domElement.focus({preventScroll:true});})}><span className="put-away-x" aria-hidden="true">×</span><span className="tool-name">Put away</span></button>}{view.recentTools.map(id=>QUICK_TOOLS.find(t=>t.id===id)).filter(Boolean).slice(0,4).map(t=>{const selected=view.tool===t.id;return <button key={t.id} type="button" className={`tool-button recent-tool ${selected?'selected':''}`} style={{'--tool-color':t.color,'--tool-soft':t.soft}} aria-label={t.name} aria-pressed={t.id==='food'||t.id==='harvest'?undefined:selected} onClick={()=>{if(t.id==='food'){invoke(g=>g.noteTool('food'));openPanel('food');}else if(t.id==='harvest')runAction(g=>{g.noteTool('harvest');g.nutrition.harvestFood();});else invoke(g=>{g.setTool(t.id);g.renderer.domElement.focus({preventScroll:true});});}}><span className="tool-picture"><Icon type={t.id}/></span><span className="tool-name">{t.name}</span>{selected&&<span className="chosen-mark" aria-hidden="true">✓</span>}</button>;})}</div></div>}
      </>}
    </section>}
    {view.loaded&&view.building?.pendingRemove&&!view.fishing&&<div className="animal-confirm animal-place-chip" role="dialog" aria-label={`Take down the ${view.building.pendingRemove.name}`}><span>Take down the {view.building.pendingRemove.name}? The materials come back.</span><button type="button" onClick={()=>invoke(g=>g.building.confirmRemove())}>Take down</button><button type="button" className="plain" onClick={()=>invoke(g=>g.building.cancelRemove())}>Keep it</button></div>}
    {view.loaded&&actionsOpen&&!view.building?.preview&&<ActionMenu view={view} tab={actionsTab} onTab={setActionsTab} seed={seed} onClose={()=>{setActionsOpen(false);actionsButton.current?.focus();}} onPanel={openPanel} onPick={id=>{if(id==='food'||id==='harvest')invoke(g=>g.noteTool(id));}} onEquip={id=>{setActionsOpen(false);invoke(g=>{g.setTool(id);g.renderer.domElement.focus({preventScroll:true});});}} onRun={runAction} buildProps={{onTools:()=>openPanel('tools'),onPause:(id,paused)=>invoke(g=>g.building.pauseProject(id,paused)),onFind:id=>runAction(g=>g.building.focusProject(id)),onChoose:id=>runAction(g=>g.building.startPreview(id)),onGoal:id=>{setActionsOpen(false);invoke(g=>pinBuildGoal(g,id));},onResume:id=>runAction(g=>g.building.go(id)),onCancel:id=>invoke(g=>g.building.cancelQueued(id)),onMove:id=>runAction(g=>g.building.moveExisting(id)),onRemove:id=>invoke(g=>g.building.removeNow(id)),onUpgrade:id=>runAction(g=>g.building.startUpgrade(id))}}/>}
    {panel&&<div className="drawer-shade" onClick={close}><section ref={drawer} tabIndex={-1} className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" aria-label={panel==='characters'?'Choose your character':panel==='report'?'While you were away':panel==='community'?'Our community':panel==='sleep'?'Home and sleep':panel==='storage'?'Wood storage':panel==='build'?'Let’s build!':panel==='catalogue'?'Choose a seed':panel==='tools'?'Better tools':panel==='food'?'Snack time':panel==='campfire'?'Campfire':panel==='dining'?'Dining Hall':panel==='oven'?'Clay oven':panel==='well'?'Water well':panel==='garden'?'Our garden':panel==='market'?'Market stall':'My bag'} onClick={e=>e.stopPropagation()}><div className="drawer-header"><div className="eyebrow">YOUR ISLAND ADVENTURE</div><h1 id="drawer-title">{panel==='characters'?'Choose a friend':panel==='report'?'While you were away':panel==='community'?'Our community':panel==='sleep'?'Time for sleep':panel==='storage'?'Wood storage':panel==='build'?'Let’s build!':panel==='catalogue'?'Choose a seed':panel==='tools'?'Better tools':panel==='food'?'Snack time!':panel==='campfire'?'Campfire grill':panel==='dining'?'Dining Hall':panel==='oven'?'Clay oven':panel==='well'?'Water well':panel==='garden'?'Our garden':panel==='market'?'Market stall':'My bag'}</h1><button data-dialog-close className="close" onClick={close} aria-label="Back to island">← Back</button></div>
      {panel==='dining'?<DiningPanel view={view} onRing={()=>{const id=view.diningCard?.hallId;close();invoke(g=>g.dining.ring(id));}} onFish={()=>{close();invoke(g=>g.nutrition.goFish());}} onCook={()=>{close();invoke(g=>g.nutrition.cook('grill_fish'));}}/>:panel==='campfire'?<CampfirePanel view={view} fireId={campfireId} onGrill={()=>{close();invoke(g=>g.nutrition.cook('grill_fish'));}} onDryClay={()=>{close();invoke(g=>g.nutrition.cook('dry_clay'));}} onStoke={()=>{close();invoke(g=>g.nutrition.stokeFire(campfireId));}} onEat={item=>{close();invoke(g=>g.nutrition.eat(item));}} onFish={()=>{close();invoke(g=>g.nutrition.goFish());}}/>:panel==='oven'?<OvenPanel view={view} onBake={()=>{close();invoke(g=>g.nutrition.cook('bake_manna'));}} onStoke={()=>{close();invoke(g=>g.nutrition.stokeFire(ovenId));}} onEat={item=>{close();invoke(g=>g.nutrition.eat(item));}} onWater={()=>{close();invoke(g=>g.nutrition.fetchWater());}} onHarvest={()=>{close();invoke(g=>g.gardenAction('harvest',null));}}/>:panel==='well'?<WellPanel view={view} onFetch={()=>{close();invoke(g=>g.nutrition.fetchWater(wellId));}} onDig={()=>{close();invoke(g=>{g.setTool('hoe');g.toast('Walk to the beach and tap the sand with the Dig tool to scoop up mud.');});}} onBrick={()=>{close();invoke(g=>g.nutrition.cook('concrete_brick'));}}/>:panel==='garden'?<GardenPanel view={view} onShape={id=>invoke(g=>g.gardenKeeper?.setShape(id,'kid'))}/>:panel==='characters'?<CharacterPicker view={view} onSelect={id=>invoke(g=>{if(g.selectCharacter(id))close();})}/>:panel==='report'?<ReturnReportPanel view={view} onProjects={()=>{close();setPanel('build');}}/>:panel==='community'?<CommunityPanel view={view} onSelect={id=>invoke(g=>{if(g.selectCharacter(id))close();})} onReport={()=>openPanel('report')} onSettings={changes=>invoke(g=>g.community.settings(changes))} onFind={id=>{close();invoke(g=>g.community.find(id));}} onHome={()=>openPanel('sleep')}/>:panel==='sleep'?<SleepPanel onUpgrade={id=>{close();invoke(g=>g.building.startUpgrade(id));}} view={view} selectedHomeId={sleepHomeId} onSleep={id=>{close();invoke(g=>g.nutrition.goSleep(id));}} onBuild={()=>{close();setActionsTab('build');setActionsOpen(true);}} onWake={()=>{close();invoke(g=>g.nutrition.wakeUp());}} onRetry={()=>{close();invoke(g=>g.nutrition.retrySleep());}}/>:(panel==='build'||panel==='storage')?<BuildMenu onPause={(id,paused)=>invoke(g=>g.building.pauseProject(id,paused))} onFind={id=>{close();invoke(g=>g.building.focusProject(id));}} allowedCategories={panel==='storage'?['Storage']:null} onTools={()=>openPanel('tools')} onUpgrade={id=>{close();invoke(g=>g.building.startUpgrade(id));}} view={view} onChoose={id=>{close();invoke(g=>g.building.startPreview(id));}} onGoal={id=>{close();invoke(g=>pinBuildGoal(g,id));}} onResume={id=>{close();invoke(g=>g.building.go(id));}} onCancel={id=>invoke(g=>g.building.cancelQueued(id))} onMove={id=>{close();invoke(g=>g.building.moveExisting(id));}} onRemove={id=>invoke(g=>g.building.removeNow(id))}/>:panel==='catalogue'?<><p>What would you like to grow? Tap a seed below. Then dig a garden spot and plant it!</p><div className="growth-key"><span>Seed</span><i>→</i><span>Sprout</span><i>→</i><span>Growing</span><i>→</i><span>Ready!</span></div><div className="seed-cards">{SEEDS.map(s=><button key={s.id} className={`seed-card ${view.seed===s.id?'active':''}`} onClick={()=>{invoke(g=>g.setSeed(s.id));close();}} aria-label={`Select ${s.name} seed`}><span className="catalogue-icon" style={{background:s.color+'22'}}><ItemIcon id={s.id}/></span><div><strong>{s.name}</strong><small>{s.kind==='tree'?'Grows a tree':'Grows in your garden'} · {inventory[s.id]||0} seeds</small><p><b>{s.hours} game hours</b><span>{realDuration(s.hours,view.state)} real time</span></p><p className="seed-water"><Icon type="water_drop" size={14}/><span>{waterWindow(s)/1440===1?'Water every day':`Water every ${waterWindow(s)/1440} days`} · no water, no growing</span></p></div><span className="choose-arrow">{view.seed===s.id?'✓ Chosen':'Plant →'}</span></button>)}</div><p className="catalogue-note">Watering once gives 20% of total growth immediately. Plants never wither in this first playtest.</p></>:panel==='tools'?<Toolbench view={view} onCraft={tier=>invoke(g=>g.mining.upgrade(tier))} onCraftShovel={tier=>invoke(g=>g.mining.craftShovel(tier))} onBuild={kind=>{close();invoke(g=>g.building.startPreview(kind));}} onFind={deposit=>{close();invoke(g=>g.mining.nearest(deposit));}}/>:panel==='food'?<FoodPanel view={view} onSleep={()=>openPanel('sleep')} onEat={item=>{close();invoke(g=>g.nutrition.eat(item));}} onCook={recipe=>invoke(g=>g.nutrition.cook(recipe))} onFish={()=>{close();invoke(g=>g.nutrition.goFish());}} onRest={()=>{close();invoke(g=>g.nutrition.rest());}} onHarvest={()=>{close();invoke(g=>g.nutrition.harvestFood());}}/>:panel==='market'?<MarketPanel card={view.market} onSell={id=>invoke(g=>g.stall?.sell(id,1))}/>:<BagPanel view={view} busy={busy} onEat={id=>{close();invoke(g=>g.nutrition.eat(id));}} onGrill={()=>{close();invoke(g=>g.nutrition.cook('grill_fish'));}} onPlant={id=>{close();invoke(g=>g.setSeed(id));}} onBuildStorage={()=>openPanel('storage')}/>}
      <footer>One game day = ten real minutes · {view.clock?.text} on Day {view.clock?.day}</footer>
    </section></div>}
    </div>
    {plan&&view.loaded&&!view.fishing&&!mapOnly&&!view.sitePicking&&!view.night?.sleeping&&<IslandPlan today={plan.today} village={plan.village} stages={view.stages} coins={Number.isFinite(view.coins)?view.coins:plan.coins} state={view.state} onClose={()=>setPlan(null)} onAdd={choice=>{invoke(g=>{if(choice?.kind)pinBuildGoal(g,choice.kind);else g.addTodayGoal(choice);});refreshPlan();}} onClearExtra={()=>{invoke(g=>g.clearTodayGoal());refreshPlan();}}/>}
    {view.fishing&&<FishingGame engine={engine} fishing={view.fishing}/>}
    {/* Welcome-ashore profile card: waits for the first-visit tour, fishing, the map and night to clear. */}
    {view.playersOnly&&<ArrivalProfile engine={engine} card={view.arrival} enabled={view.loaded&&!view.fishing&&!mapOnly&&!view.sitePicking&&!view.night?.sleeping&&!tourActive&&!plan}/>}
    {/* Island journey panel + new-stage celebration (stage-journey.jsx); the badge in the top bar opens it. */}
    {view.playersOnly&&<StageJourney engine={engine} stages={view.stages} enabled={view.loaded&&!view.ambient&&!view.fishing&&!mapOnly&&!view.sitePicking&&!view.night?.sleeping&&!tourActive}/>}
    <EnergyFx engine={engine} enabled={view.loaded&&!mapOnly&&!view.overview&&!view.sitePicking&&!view.night?.sleeping}/>
    {view.playersOnly&&!view.sitePicking&&<IslandTour engine={engine} view={view} ui={{panel,showTime,mapOnly,actionsOpen,actionsTab,friendsOpen,plan:!!plan}} onActive={setTourActive}/>}
    <MorningNote report={view.loaded&&!view.night?.sleeping&&!view.sitePicking?view.morning:null} onDismiss={()=>invoke(g=>g.dismissMorning())}/>
    <NightRest night={view.night}/>
    {mapOnly&&!view.night?.sleeping&&<button ref={backToPlay} className="map-only-return" onClick={returnToPlay} aria-label="Back to play. Show game buttons"><span aria-hidden="true">←</span> Back to play</button>}
    {!view.loaded&&<div className={`loading ${view.error?'':'with-tips'}`}>{view.error?<><div className="loading-mark">✦</div><h1>The island needs another try</h1><p>{view.status}</p><p>{view.error}</p><button onClick={()=>location.reload()}>Reload island</button></>:<><LoadingTips/><div className="loading-foot"><div className="loading-track"><i/></div><p>{view.status}</p></div></>}</div>}
  </main>;
}
// Native shells (Despia / WKWebView) only drop their pull-to-refresh when the page itself consumes the
// touch; `touch-action:none` alone is not enough once a finger is dragging (reeling, tilting, pinching).
// Nothing on the island page scrolls except the panels that opt in with overflow:auto, so swallow every
// other one-finger drag. Registered before React mounts so the very first touch is covered.
{
  const scrollsInside=target=>{
    let node=target instanceof Element?target:null;
    while(node&&node!==document.body){
      // The friends roster must keep its swipe even before it overflows, and even while a
      // skill blurb is open. The camera's touchmove preventDefault must not run for it.
      if(node.classList?.contains('friends-menu')||node.classList?.contains('friends-menu-scroll'))return true;
      const {overflowY}=getComputedStyle(node);
      if((overflowY==='auto'||overflowY==='scroll')&&node.scrollHeight>node.clientHeight)return true;
      node=node.parentElement;
    }
    return false;
  };
  let swallow=false;
  document.addEventListener('touchstart',e=>{swallow=!scrollsInside(e.target);},{passive:true,capture:true});
  document.addEventListener('touchmove',e=>{if(swallow&&e.cancelable)e.preventDefault();},{passive:false,capture:true});
  document.addEventListener('gesturestart',e=>e.preventDefault(),{passive:false});
}
createRoot(document.getElementById('root')).render(<App/>);
