import React,{useState} from 'react';
import {GARDEN_PRESETS,FENCE_PRESETS,placeGardenPreset} from './garden-presets.mjs';
import './garden-templates.css';

// Draw the actual tile layout so the picture matches what the child places.
export function GardenArt({preset}){
 const cells=preset.cells,w=Math.max(...cells.map(c=>c[0]))+1,h=Math.max(...cells.map(c=>c[1]))+1;
 const project=(x,y)=>[100+(x-y-(w-h)/2)*17,28+(x+y)*9];
 const tile=(x,y)=>{const [a,b]=project(x,y);return `${a},${b} ${a+17},${b+9} ${a},${b+18} ${a-17},${b+9}`;};
 const plan=placeGardenPreset(preset.id,'0:0'),edges=(plan.ring||[]).filter(k=>k!==plan.gate).map(k=>k.split(':').map(Number));
 const posts=front=>edges.filter(([x,y])=>(x>=w||y>=h)===front).map(([x,y])=>{const [a,b]=project(x,y);return <g key={`${x}:${y}`}><path d={`M${a-7} ${b+5}l14 7m-14-14l14 7`} stroke="#b98b49" strokeWidth="4" strokeLinecap="round"/><path d={`M${a} ${b+11}v-20`} stroke="#825431" strokeWidth="6" strokeLinecap="round"/><path d={`M${a-1} ${b+7}v-17`} stroke="#e4bc79" strokeWidth="3" strokeLinecap="round"/></g>;});
 return <svg viewBox={`0 0 200 ${60+(w+h)*9}`} className="garden-template-art" aria-hidden="true"><ellipse cx="100" cy={39+(w+h)*5} rx="85" ry={25+(w+h)*2} fill="#dfe8bd"/>{posts(false)}{[...cells].sort((a,b)=>a[0]+a[1]-b[0]-b[1]).map(([x,y],i)=>{const [a,b]=project(x,y);return <g key={`${x}:${y}`}><polygon points={tile(x,y)} transform="translate(0 4)" fill={preset.fenceOnly?'#79a957':'#745035'}/><polygon points={tile(x,y)} fill={preset.fenceOnly?'#a5cc75':i%2?'#a97a4b':'#b78957'} stroke={preset.fenceOnly?'#92b969':'#d7ae72'} strokeWidth="1.5"/>{!preset.fenceOnly&&<g transform={`translate(${a} ${b+8})`}><path d="M-6 2L0 6L6 2" fill="none" stroke="#825434" strokeWidth="2"/><path d="M0 3L-3-4L3-3Z" fill={i%3===0?'#f39b32':'#77b94e'}/><ellipse cx="-4" cy="-5" rx="5" ry="3" transform="rotate(30 -4 -5)" fill="#4d9346"/><ellipse cx="4" cy="-6" rx="5" ry="3" transform="rotate(-35 4 -6)" fill="#79be57"/><path d="M0 1V-8" stroke="#4d9346" strokeWidth="2"/></g>}</g>;})}{posts(true)}</svg>;
}
export function TemplatePicker({onChoose,mode=null}){
 const [tab,setTab]=useState(mode||'gardens'),[fenced,setFenced]=useState(true);
 const items=tab==='fences'?FENCE_PRESETS:GARDEN_PRESETS.filter(p=>p.fenced===fenced);
 return <section className="garden-templates" aria-label="Garden and fence templates"><h2>Choose it. Place it. Build it!</h2><p>A ready-made shape for your island.</p>{!mode&&<div className="template-tabs" role="group" aria-label="Template type">{['gardens','fences'].map(t=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t==='gardens'?'Gardens':'Fenced pens'}</button>)}</div>}{tab==='gardens'&&<label className="template-fence-toggle"><input type="checkbox" checked={fenced} onChange={e=>setFenced(e.target.checked)}/>Include a fence</label>}<div className="template-cards">{items.map(p=>{const plan=placeGardenPreset(p.id,'0:0');return <article className="template-card" key={p.id}><GardenArt preset={p}/><h3>{p.name.replace(' + Fence','')}</h3><span>{p.fenceOnly?`${p.width} × ${p.height} open space`:`${p.plots} planting spots`}</span><small>{p.friends} {p.friends===1?'friend':'friends'}{plan.wood>0?` · ${plan.wood} wood`:''}</small>{p.fenced&&<small className="template-entry">Entrance included</small>}<button onClick={()=>onChoose(p.id)} aria-label={`Choose ${p.name}`}>Choose →</button></article>;})}</div><p className="template-help">Choose a picture, tap clear grass, then tap Build it here. Your friends help build it.</p></section>;
}
