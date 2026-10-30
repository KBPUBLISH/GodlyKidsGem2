import React,{useRef,useState} from 'react';
import {Icon,ItemIcon,useDialogFocus} from './ui.jsx';
import {REQUESTS} from './living-test-rules.mjs';
import './living-test.css';

// Existing island UI classes and packaged illustrated icons, with fewer early-game actions.
export function LivingTestUI({host,engine,view}){
  const [panel,setPanel]=useState(null),drawer=useRef(null);
  const close=()=>{setPanel(null);engine.current?.renderer.domElement.focus({preventScroll:true});};
  useDialogFocus(panel,drawer,close);
  const play=view.livingTest,task=play?.task;
  const invoke=fn=>engine.current?.livingTest&&fn(engine.current.livingTest);
  const title=panel==='friends'?'Our friends':panel==='bag'?'My bag':panel==='build'?'Our little home':'One little thing at a time';
  return <main className="game-shell living-island-test" onPointerDownCapture={()=>engine.current?.music?.unlock()}>
    <div ref={host} className="world"/>
    {view.loaded&&play&&<>
      <header className="topbar"><div className="clock-button"><Icon type="walk"/><span><strong>You</strong><small>Your island adventure</small></span></div><button type="button" className={`sound-button ${view.music===false?'off':''}`} aria-label={view.music===false?'Turn sound on':'Turn sound off'} onClick={()=>engine.current?.setMusic(view.music===false)}><span className="sound-mark" aria-hidden="true">{view.music===false?'🔇':'🔊'}</span><span>Sound</span></button></header>
      <section className="mission panel living-request" aria-label="Current help request"><div className="eyebrow">{task?`${task.name} needs a little help`:'Built together'}</div><strong>{task?.title||'A place to belong'}</strong><p>{task?.ask||'Your friends are enjoying the island. Take a walk and say hello.'}</p>{task&&<div className="living-progress"><ItemIcon id={task.item==='wood'?'pine_wood':task.item} size={24}/><span>{play.deposited} / {task.count} delivered</span></div>}</section>
      <nav className="side-buttons" aria-label="Explore your island"><button onClick={()=>setPanel('tasks')} aria-label="Open the island to-do list"><Icon type="book"/><span>To-do</span></button><button onClick={()=>setPanel('bag')} aria-label="Open my bag"><Icon type="bag"/><span>My bag</span></button><button className="actions-menu-button" onClick={()=>setPanel('build')} aria-label="Open build"><img className="picture-icon higgsfield-icon" src="/icons/higgsfield/build_home.png?v=cottage1" width="44" height="44" alt=""/><span>Build</span></button></nav>
      <button className="friends-button" aria-label="Friends" onClick={()=>setPanel('friends')}><img className="picture-icon" src="/icons/higgsfield/friends.png?v=2" width="32" height="32" alt=""/><span>Friends</span></button>
      {!panel&&play.resources.filter(r=>r.visible).map(r=><button key={r.id} className="living-resource-hit" style={{left:r.x,top:r.y}} aria-label={`Walk to ${r.id}`} onClick={()=>invoke(test=>test.walk(test.resources.find(p=>p.id===r.id)))}/>)}
      {!panel&&play.site?.visible&&<div className="object-prompt living-site-counter" style={{left:play.site.x,top:play.site.y}}><button aria-label="Walk to delivery circle" onClick={()=>invoke(test=>test.walk(test.site()))}><ItemIcon id={task?.item==='wood'?'pine_wood':task?.item} size={25}/><small>{play.deposited} / {task?.count}</small></button></div>}
      <section className="bottom-hud"><div className="context panel living-carry"><span><Icon type="bag" size={30}/><b>Carrying {Object.values(play.inventory).reduce((a,b)=>a+b,0)} / 4</b></span><small>Tap land to walk. Collect and deliver as you go.</small></div></section>
      {view.toasts?.[0]&&<div className="toast" role="status">{view.toasts[0].text}</div>}
    </>}
    {(!view.loaded||view.error)&&<div className="living-loading panel" role="status"><strong>{view.error?'The island could not load':'Rowing ashore…'}</strong><p>{view.error||'Getting your familiar island ready.'}</p></div>}
    {panel&&play&&<div className="drawer-shade" onClick={close}><section ref={drawer} className="drawer" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="living-drawer-title" onClick={e=>e.stopPropagation()}><div className="drawer-header"><div className="eyebrow">YOUR ISLAND ADVENTURE</div><h1 id="living-drawer-title">{title}</h1><button className="close" onClick={close} aria-label="Back to island">← Back</button></div>
      {panel==='friends'?<><p>Living here together. Everyone has their own little routine.</p><div className="friends-list">{play.friends.map(f=><button className="friend-row" key={f.id} onClick={()=>{invoke(test=>test.hello(f.id));close();}}><span className="friend-face">{f.name[0]}</span><span className="friend-body"><strong>{f.name}</strong><small>Say hello</small></span></button>)}</div></>:panel==='bag'?<><p>These are the supplies you’re carrying. Walk onto the glowing circle to deliver them.</p>{Object.entries(play.inventory).map(([id,n])=><div className="living-bag-row" key={id}><ItemIcon id={id==='wood'?'pine_wood':id}/><strong>{id==='wood'?'Logs':id==='carrot'?'Carrots':'Flowers'}</strong><span>{n}</span></div>)}</>:<>
      {panel==='build'&&<p>{play.homeReady?'Noah has built your home using the island’s original building pieces.':'Noah is making a home. Bring supplies to the glowing circle; he takes care of the building.'}</p>}
      {(panel==='build'?REQUESTS.slice(0,1):REQUESTS).map((t,i)=><article className="living-task-row" key={t.id}><Icon type={t.item==='wood'?'build':t.item==='carrot'?'carrot':'sunflower'} size={36}/><div><strong>{i>play.stage?'Another little adventure':t.title}</strong><small>{i<play.stage?'✓ You helped '+t.name:i===play.stage?t.action:'Discover it a little later'}</small></div></article>)}
      {task&&<div className="food-actions"><button onClick={()=>{invoke(test=>test.showNext());close();}}>Show me where to help</button></div>}
      </>}
    </section></div>}
  </main>;
}
