/**
 * The garden card: how safe the garden is, what Abel is asking the builders for, and the layout plan the
 * kid can choose (Rectangle / Heart / Smiley). Data comes from world.snapshot().garden (garden-keeper.js card()).
 */
import React from 'react';
import {SHAPES} from './garden-rules.mjs';
import './garden-ui.css';

const SIDE_ORDER=['north','east','south','west'];
const THREAT={none:{label:'Safe for now',tone:'calm'},watch:{label:'Open to the wild',tone:'warm'},low:{label:'Fenced and watched',tone:'calm'},medium:{label:'Coyotes could get in',tone:'warm'},high:{label:'Attacked — fix the fence!',tone:'hot'}};

function ShapePreview({id}){
  const s=SHAPES[id];
  if(!s?.mask)return <span className="garden-shape-grid rect" aria-hidden="true">{Array.from({length:16},(_,i)=><i key={i} className="fill"/>)}</span>;
  const w=s.mask[0].length;
  return <span className="garden-shape-grid" style={{gridTemplateColumns:`repeat(${w},1fr)`}} aria-hidden="true">{s.mask.flatMap((row,r)=>[...row].map((ch,c)=><i key={`${r}:${c}`} className={ch==='#'?'fill':ch==='o'?'feature':''}/>))}</span>;
}

export function GardenPanel({view,onShape}){
  const card=view.garden;
  if(!card)return <p>Dig a garden spot first — then {view.friends?.find(f=>/abel/i.test(f.name))?'Abel':'the gardener'} will look after it.</p>;
  const threat=THREAT[card.threatLevel]||THREAT.none;
  const nextUp=card.requests[0]||null;
  const gaps=SIDE_ORDER.filter(s=>card.gapsBySide[s]>0);
  return <>
    <div className={`campfire-status garden-status ${threat.tone}`}><span className="campfire-flame" aria-hidden="true">{card.threatLevel==='high'?'🐺':card.fencedPct>=100?'🌱':'🪵'}</span><div><strong>{threat.label}</strong><small>{card.plots} plot{card.plots===1?'':'s'} · {card.planted} planted · fence {card.fencedPct}%{card.gate?card.gate.built?' · gate ✓':' · no gate yet':''}{card.scarecrows.count?` · ${card.scarecrows.count} scarecrow${card.scarecrows.count===1?'':'s'}`:''}</small>
      <div className="garden-meter" role="progressbar" aria-valuenow={card.fencedPct} aria-valuemin={0} aria-valuemax={100} aria-label="Garden fenced"><i style={{width:`${card.fencedPct}%`}}/></div>
      {gaps.length>0&&<small className="garden-gaps">Open on the {gaps.join(', ')} side{gaps.length===1?'':'s'}.</small>}
      {card.lastAttack&&<small className="garden-gaps">Last trouble: {card.lastAttack.kind==='crow'?'crows at dawn':'a coyote at night'} on day {card.lastAttack.day+1}{card.lastAttack.sides?.length?` from the ${card.lastAttack.sides.join(' and ')}`:''}.</small>}
    </div></div>

    <h2>{card.keeper} will build</h2>
    {card.requests.length===0?<p className="catalogue-note">Nothing right now. {card.fencedPct>=100?'The ring is closed and the rows are watched.':'The garden is small enough to keep an eye on.'}</p>:
    <div className="garden-requests">{card.requests.slice(0,4).map(r=><article key={r.id} className={`grill-card garden-request ${r===nextUp?'next':''}`}><span className="grill-icon garden-request-icon" aria-hidden="true">{{fence:'🪵',brick_fence:'🧱',gate:'🚪',scarecrow:'🎃',path:'🪨',clear:'🪓',wood:'🌲',unfence:'🔧'}[r.kind]||'🌱'}</span><div><strong>{{fence:'Fence',brick_fence:'Brick fence',gate:'Garden gate',scarecrow:'Scarecrow',path:'Stepping stones',clear:'Clear the way',wood:'More wood',unfence:'Move the old fence'}[r.kind]||r.kind}{r.side&&r.side!=='corner'?` · ${r.side} side`:r.side==='corner'?' · corners':''}{r.tiles>1?` · ${r.tiles} pieces`:''}</strong><small>{Object.entries(r.need||{}).map(([k,n])=>`${n} ${k.replace(/_/g,' ')}`).join(' + ')||'no materials'}</small><p>{r.reason}</p></div>{r===nextUp&&<b className="garden-next">Next</b>}</article>)}</div>}
    <p className="catalogue-note">{card.keeper} puts up the fences and scarecrows himself. Houses stay with Noah and Adam.{card.waitingOn&&card.requests.length>0?` He waits until the ${card.waitingOn.toLowerCase()} is finished — only one piece can go up at a time.`:''}</p>

    <h2>Garden plan</h2>
    <div className="garden-shapes" role="radiogroup" aria-label="Garden plan">{card.plan.options.map(o=>{const locked=o.id!=='rectangle'&&!card.plan.shapesUnlocked,active=card.plan.shape===o.id;return <button key={o.id} type="button" role="radio" aria-checked={active} className={`garden-shape ${active?'active':''} ${locked?'locked':''}`} onClick={()=>onShape?.(o.id)} aria-label={`${o.name}${locked?' (locked)':''}`}><ShapePreview id={o.id}/><strong>{o.name}</strong><small>{locked?'🔒 fence it first':active?'Chosen':o.hint||'Tap to choose'}</small></button>;})}</div>
    <p className="catalogue-note">{card.plan.shapesUnlocked?`The next patch will be a ${card.plan.name.toLowerCase()}${card.plan.chosenBy==='foreman'?' — the foreman suggested it':''}. Eve plants pumpkins and wheat so it shows from the hill.`:`Neat rows for now: the garden grows a full row at a time. Fence it all the way round and reach ${card.shapeMin} plots, then you can pick a heart or a smiley.`}</p>
    {card.plan.blocked&&<p className="catalogue-note garden-blocked">{card.plan.blocked}</p>}

    {card.upgrades.length>0&&<><h2>Next upgrades</h2><ul className="garden-upgrades">{card.upgrades.map(u=><li key={u.id}><strong>{u.name}</strong><small>{u.why}</small></li>)}</ul></>}

    <details className="garden-rules"><summary>Garden rules {card.keeper} follows</summary><ul>{card.rules.map(r=><li key={r.id}>{r.text}</li>)}</ul></details>
  </>;
}
