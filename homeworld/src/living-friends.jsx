import React,{useEffect,useState} from 'react';
import {profileFor} from './character-profile.mjs';
import {friendPortraits} from './friend-portraits.js';
import './living-friends.css';
const sillyLines={adam:'Every chicken gets a name. Even the grumpy one!',noah:'Builds giant boats. Still asks for back scratches.',abel:'His scarecrow is a very good listener.',eve:'Rings the dinner bell like the whole island is late!'};
export function LivingFriends({play,state,game,onHello,onWatch,waiting,onArrivals}){
 const friends=play?.friends||[],[portraits,setPortraits]=useState({});
 const rosterKey=friends.map(f=>f.id).join('|');
 useEffect(()=>{setPortraits(friendPortraits(game,friends));},[game,rosterKey]);
 return <div className="friend-album">
  <header className="friend-album-intro"><span aria-hidden="true">🌿</span><div><p>BETTER TOGETHER</p><h2>Your island friends</h2><span>Everyone has something special to share.</span></div><b aria-label={`${friends.length} friend${friends.length===1?'':'s'}`}>{friends.length}</b></header>
  {waiting?.count>0&&<section className="friend-arrival-invite" aria-label="Friends waiting to come ashore"><span className="arrival-portrait">{waiting.imageUrl?<img src={waiting.imageUrl} alt=""/>:'👋'}</span><div><small>NEW FRIEND{waiting.count>1?'S':''}</small><h3>{waiting.count===1?`${waiting.name} is waiting!`:`${waiting.count} friends are waiting!`}</h3><p>Welcome them to your island.</p><button onClick={onArrivals}>{waiting.count===1?`Drop off ${waiting.name}`:'Welcome friends'} →</button></div></section>}
  {!friends.length?(waiting?.count>0?null:<div className="friend-album-empty"><span aria-hidden="true">👋</span><h3>A new friendship is waiting!</h3><p>Meet a friend in a Bible story, then welcome them to your island.</p></div>):<div className="friend-album-grid">{friends.map(f=>{
   const profile=profileFor(f,state),silly=sillyLines[f.name.toLowerCase()]||profile.tasks.find(t=>t.silly)?.text||'Always ready to try something new!';
   return <article className="island-friend-card" key={f.id} aria-label={`${f.name}’s friend card`}>
    <div className="island-friend-heading"><div className="island-friend-portrait">{portraits[f.id]||f.imageUrl?<img src={portraits[f.id]||f.imageUrl} alt={`${f.name}’s portrait`} width="104" height="104" onError={e=>{e.currentTarget.hidden=true;}}/>:<span aria-label={`${f.name}’s initial`}>{f.name.slice(0,1)}</span>}<i aria-hidden="true">♥</i></div><div><small>ON YOUR ISLAND</small><h3>{f.name}</h3><p>{profile.role.name}</p></div></div>
    <dl className="island-friend-traits"><div><dt><span aria-hidden="true">★</span> Great at</dt><dd>{profile.strengths.join(' & ')||'Helping friends'}</dd></div><div><dt><span aria-hidden="true">🌱</span> Needs help with</dt><dd>{profile.weaknesses.join(' & ')||'Discovering new skills'}</dd></div></dl>
    <div className="island-friend-silly"><span aria-hidden="true">☺</span><p><small>ISLAND SILLINESS</small>{silly}</p></div>
    <div className="island-friend-buttons"><button className="watch-friend" onClick={()=>onWatch(f.id)} aria-label={`Watch ${f.name}`}><span aria-hidden="true">▶</span> Watch {f.name}</button><button className="hello-friend" onClick={()=>onHello(f.id)} aria-label={`Say hello to ${f.name}`}><span aria-hidden="true">👋</span> Say hello</button></div>
   </article>;
  })}</div>}
  {friends.length>0&&<button className="watch-island-life" onClick={()=>onWatch()}><span aria-hidden="true">☀</span><span>Watch island life<small>See what everyone is up to</small></span><b aria-hidden="true">→</b></button>}
 </div>;
}
