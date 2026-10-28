import React from 'react';
export function CharacterPicker({view,onSelect}){
 const people=view.community?.members||[];
 return <><p>Who would you like to play as? Tap a friend, then tap the land to walk. Your other friends explore, help and take rest breaks.</p><div className="character-choices">{[...people].sort((a,b)=>['adam','eve','noah'].indexOf(a.id)-['adam','eve','noah'].indexOf(b.id)).map(m=><button key={m.id} aria-label={`Play as ${m.name}`} aria-pressed={m.selected} onClick={()=>onSelect(m.id)}><span className={`community-avatar ${m.id}`} aria-hidden="true">{m.name[0]}</span><span><strong>{m.name}</strong><small>{m.selected?'✓ You’re playing':m.status}</small></span><b aria-hidden="true">{m.selected?'✓':'→'}</b></button>)}</div><p className="catalogue-note">You can also tap a character on the island to select them. Everyone keeps their own energy and position.</p></>;
}
