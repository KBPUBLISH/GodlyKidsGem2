import LocalizedText from '../../localization/LocalizedText';
import React from 'react';
import {SEEDS,label,realDuration} from './core.mjs';
import {MINERALS} from './mining.mjs';
import {FOODS,MATERIALS,mealGain,canCook} from './nutrition.mjs';
import {litFires} from './building.mjs';
import {Icon,ItemIcon} from './ui.jsx';
import {WoodStorageCard} from './wood-storage-ui.jsx';

const SEED_IDS=new Set(SEEDS.map(s=>s.id));
const STAGES={seeded:'Just planted',seedling:'Sprouting',growing:'Growing',ready:'Ready to pick!'};

/** Sort a bag into friendly shelves. Anything we don't recognise lands in "Other finds". */
function shelves(inventory){
  const out={snacks:[],fish:[],seeds:[],rocks:[],wood:[],supplies:[],other:[]};
  for(const [id,n] of Object.entries(inventory)){
    if(!(n>0))continue;
    if(FOODS[id])out.snacks.push(id);
    else if(id==='fish')out.fish.push(id);
    else if(SEED_IDS.has(id))out.seeds.push(id);
    else if(MINERALS[id])out.rocks.push(id);
    else if(id.endsWith('_wood'))out.wood.push(id);
    else if(MATERIALS[id])out.supplies.push(id);
    else out.other.push(id);
  }
  out.snacks.sort((a,b)=>FOODS[b].energy-FOODS[a].energy);
  out.seeds.sort((a,b)=>SEEDS.findIndex(s=>s.id===a)-SEEDS.findIndex(s=>s.id===b));
  return out;
}

function Shelf({icon,title,count,hint,children}){
  return <section className="bag-shelf">
    <header className="bag-shelf-head"><Icon type={icon} size={28}/><div><h2>{title}</h2>{hint&&<small>{hint}</small>}</div>{count!=null&&<b className="bag-shelf-count">{count}</b>}</header>
    <div className="bag-grid">{children}</div>
  </section>;
}

function Tile({id,name,count,note,action,tone}){
  return <article className={`bag-tile ${tone||''}`}>
    <span className="bag-tile-icon"><ItemIcon id={id} size={40}/><b className="bag-tile-count">×{count}</b></span>
    <strong><LocalizedText value={name}/></strong>
    {note&&<small>{note}</small>}
    {action}
  </article>;
}

/**
 * My bag: everything the crew has gathered, sorted onto shelves (snacks,
 * fish, seeds, stone & ore, wood), then the garden and the island record.
 */
export function BagPanel({view,busy,onEat,onGrill,onPlant,onBuildStorage}){
  const s=view.state,inv=s.inventory||{},stats=s.stats||{};
  const shelf=shelves(inv);
  const kinds=Object.values(shelf).reduce((n,list)=>n+list.length,0);
  const fireLit=litFires(s,view.minutes).length>0,canGrill=canCook(s,'grill_fish')&&fireLit;
  const plants=view.plants||[],readyPlants=plants.filter(p=>p.stage==='ready').length,thirsty=plants.filter(p=>p.thirsty&&p.stage!=='ready').length;
  const snackCount=shelf.snacks.reduce((n,id)=>n+inv[id],0);
  return <>
    <div className="bag-summary" aria-label="Bag at a glance">
      <span><Icon type="bag" size={22}/><b>{kinds}</b> kinds of things</span>
      <span><Icon type="food" size={22}/><b>{snackCount}</b> snack{snackCount===1?'':'s'}</span>
      <span><Icon type="plant" size={22}/><b>{plants.length}</b> growing</span>
    </div>

    <WoodStorageCard state={s} onBuild={onBuildStorage}/>

    {kinds===0&&<div className="bag-empty"><Icon type="bag" size={56}/><strong>Your bag is empty</strong><p>Chop a tree, break a rock or pick a ripe crop and it will show up here.</p></div>}

    {shelf.snacks.length>0&&<Shelf icon="food" title="Snacks" count={snackCount} hint="Eat one to fill the tummy and get energy back.">
      {shelf.snacks.map(id=>{const f=FOODS[id],gain=mealGain(s,id,view.minutes).total;return <Tile key={id} id={id} name={f.name} count={inv[id]} note={`+${f.energy} energy`} tone="snack" action={<button type="button" className="bag-action" disabled={busy||gain<=0} aria-label={gain<=0?`Full. Save the ${f.name.toLowerCase()} for later`:`Eat ${f.name.toLowerCase()}`} onClick={()=>onEat(id)}>{gain<=0?'Full':'Eat'}</button>}/>;})}
    </Shelf>}

    {shelf.fish.length>0&&<Shelf icon="rawfish" title="Fish to grill" count={inv.fish} hint={fireLit?'Grill them at the campfire for a hearty meal.':'Light the campfire, then grill them.'}>
      <Tile id="fish" name="Raw fish" count={inv.fish} note="Becomes grilled fish" tone="fish" action={<button type="button" className="bag-action warm" disabled={busy||!canGrill} aria-label={canGrill?'Grill a fish':'The campfire is not lit'} onClick={onGrill}>{canGrill?'Grill':'No fire'}</button>}/>
    </Shelf>}

    {shelf.seeds.length>0&&<Shelf icon="plant" title="Seeds" count={shelf.seeds.reduce((n,id)=>n+inv[id],0)} hint="Tap Plant, then tap an empty garden spot.">
      {shelf.seeds.map(id=>{const seed=SEEDS.find(x=>x.id===id);return <Tile key={id} id={id} name={seed.name} count={inv[id]} note={seed.kind==='tree'?'Grows a tree':`${seed.hours} island hours`} tone="seed" action={<button type="button" className={`bag-action green ${view.seed===id?'chosen':''}`} disabled={busy} aria-label={`Plant ${seed.name.toLowerCase()} seeds`} onClick={()=>onPlant(id)}>{view.seed===id?'✓ Ready':'Plant'}</button>}/>;})}
    </Shelf>}

    {shelf.rocks.length>0&&<Shelf icon="stone" title="Stone & ore" count={shelf.rocks.reduce((n,id)=>n+inv[id],0)} hint="For building and making better tools.">
      {shelf.rocks.map(id=><Tile key={id} id={id} name={MINERALS[id].name} count={inv[id]} tone="rock"/>)}
    </Shelf>}

    {shelf.wood.length>0&&<Shelf icon="wood" title="Wood" count={shelf.wood.reduce((n,id)=>n+inv[id],0)} hint="Every kind of wood works for building.">
      {shelf.wood.map(id=><Tile key={id} id={id} name={label(id)} count={inv[id]} tone="wood"/>)}
    </Shelf>}

    {shelf.supplies.length>0&&<Shelf icon="build" title="Oven supplies" hint="2 mud + 1 water dries into a clay brick by the campfire. The oven needs 6 bricks, then bakes wheat + water into manna.">
      {shelf.supplies.map(id=><Tile key={id} id={id} name={MATERIALS[id].name} count={inv[id]} note={MATERIALS[id].source} tone="rock"/>)}
    </Shelf>}

    {shelf.other.length>0&&<Shelf icon="bag" title="Other finds">
      {shelf.other.map(id=><Tile key={id} id={id} name={label(id)} count={inv[id]}/>)}
    </Shelf>}

    <section className="bag-shelf">
      <header className="bag-shelf-head"><Icon type="harvest" size={28}/><div><h2>In the garden</h2><small>{plants.length?readyPlants?`${readyPlants} ready to pick!`:thirsty?`${thirsty} need${thirsty===1?'s':''} water`:'Everything is growing nicely.':'Nothing planted yet.'}</small></div>{plants.length>0&&<b className="bag-shelf-count">{plants.length}</b>}</header>
      {plants.length?<div className="bag-garden">{plants.map(p=><div key={p.key} className={`bag-plant ${p.stage==='ready'?'ready':p.thirsty?'thirsty':''}`}>
        <ItemIcon id={p.seed.plant} size={30}/>
        <div><strong>{p.seed.name}</strong><small>{STAGES[p.stage]}{p.thirsty&&p.stage!=='ready'?' · needs water':''}{p.stage!=='ready'&&!p.thirsty?` · ${realDuration(p.remaining/60,s)} left`:''}</small><span className="bag-plant-track"><i style={{width:`${Math.round(p.progress*100)}%`}}/></span></div>
        <b>{Math.round(p.progress*100)}%</b>
      </div>)}</div>:<p className="bag-note">Pick a seed above, then dig a garden spot and plant it.</p>}
    </section>

    <section className="bag-shelf">
      <header className="bag-shelf-head"><Icon type="sun" size={28}/><div><h2>Island record</h2><small>Everything the crew has done so far.</small></div></header>
      <div className="bag-stats">
        <span><Icon type="axe" size={26}/><b>{stats.trees||0}</b><small>trees cut</small></span>
        <span><Icon type="mine" size={26}/><b>{stats.rocks||0}</b><small>rocks broken</small></span>
        <span><Icon type="plant" size={26}/><b>{stats.planted||0}</b><small>planted</small></span>
        <span><Icon type="harvest" size={26}/><b>{stats.harvested||0}</b><small>harvests</small></span>
      </div>
    </section>
  </>;
}
