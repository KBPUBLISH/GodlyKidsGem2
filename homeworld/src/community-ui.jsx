import React from 'react';
import {Icon} from './ui.jsx';
export function CommunityPanel({view,onSettings,onFind,onHome,onReport,onSelect}){
 const c=view.community;if(!c)return <p>Your helpers are arriving…</p>;
 return <>
  <p>Choose Adam, Eve or Noah to play. Your other friends explore the island, care for the garden and fish when there is work to do. Finished chores go into My bag.</p>
  <button className={`community-toggle ${c.enabled?'helping':''}`} aria-pressed={c.enabled} onClick={()=>onSettings({enabled:!c.enabled})}><span aria-hidden="true">{c.enabled?'Ⅱ':'▶'}</span><span><strong>{c.enabled?'Chores are on':'Chores are taking a break'}</strong><small>{c.enabled?'Tap to pause their chores':'Tap to let friends help'}</small></span></button>
  <div className="community-cards">{c.members.map(m=><article className="community-card" key={m.id}>
   <div className={`community-avatar ${m.id}`} aria-hidden="true">{m.name.slice(0,1)}</div><div className="community-person"><h2>{m.name}</h2><small>{m.role}</small><p>{m.status}</p></div>
   <div className="community-levels">{[{name:'Energy',value:m.energy}].map(v=><label key={v.name}><span>{v.name}<b>{v.value}%</b></span><progress aria-label={`${m.name} ${v.name}`} value={v.value} max="100"/></label>)}</div>
   <button aria-pressed={m.selected} onClick={()=>onSelect(m.id)} aria-label={`Play as ${m.name}`}>{m.selected?'✓ Playing as ':'Play as '}{m.name}</button>
   <button onClick={()=>onFind(m.id)} aria-label={`Find ${m.name} on the island`}>Find {m.name} →</button>
  </article>)}</div>
  <button className="food-sleep-link" onClick={onHome}><Icon type="rest" size={32}/><span><strong>A home for your friends</strong><small>Helpers with low energy recharge at home.</small></span></button>
  <h2>While you’re away</h2><label className="community-offline"><input type="checkbox" checked={c.offline} onChange={e=>onSettings({offline:e.target.checked})}/><span><strong>Let friends help when I close the game</strong><small>Chores: up to 8 hours. Building projects: up to 30 days.</small></span></label>
  <p className="catalogue-note">Noah keeps up to 20 raw fish in the shared bag. Eve cares for crops you have planted; she leaves your seeds for you to choose. Assigned builders work on the projects you choose. Materials are used once when you place a project. They can take daytime rest breaks at home. At 10 PM everyone stops together for a 10-second night and wakes at 7 AM. Pausing the island clock pauses chores and the shared night. Construction uses island days: 10 minutes each. Pause a building crew through its project button.</p>
  <button className="report-build-link" onClick={onReport}><Icon type="build" size={28}/> Island progress report →</button>
  <h2>Our helpers have gathered</h2><div className="stats-row"><span>{c.totals.fish} fish</span><span>{c.totals.harvests} harvests</span><span>{c.totals.watered} plants watered</span></div>
 </>;
}
