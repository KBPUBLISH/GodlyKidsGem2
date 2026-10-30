import React,{useRef,useState} from 'react';
import {Icon,ItemIcon,useDialogFocus} from './ui.jsx';
import './living-test.css';

export function LivingTestUI({host,engine,view}){
  const [panel,setPanel]=useState(null),drawer=useRef(null);
  const play=view.livingTest,task=play?.task,hint=play?.guidance;
  const modal=panel||(play?.inviteVisible?'first-friend':play?.welcomeVisible?'welcome':null);
  const milestone=modal==='first-friend'||modal==='welcome';
  const invoke=fn=>engine.current?.livingTest&&fn(engine.current.livingTest);
  const close=()=>{if(!panel&&modal==='first-friend')invoke(t=>t.dismissInvite());if(!panel&&modal==='welcome')invoke(t=>t.welcomeAdam());setPanel(null);engine.current?.renderer.domElement.focus({preventScroll:true});};
  useDialogFocus(modal,drawer,close);
  const title=modal==='first-friend'?'Let’s collect your first friend!':modal==='welcome'?'Adam is here!':panel==='friends'?'Our friends':panel==='bag'?'My bag':'Our little home';
  return <main className="game-shell living-island-test" onPointerDownCapture={()=>engine.current?.music?.unlock()}>
    <div ref={host} className="world"/>
    {view.loaded&&play&&<>
      <header className="topbar"><div className="clock-button"><Icon type="walk"/><span><strong>Your island</strong><small>One little adventure at a time</small></span></div><button type="button" className={`sound-button ${view.music===false?'off':''}`} aria-label={view.music===false?'Turn sound on':'Turn sound off'} onClick={()=>engine.current?.setMusic(view.music===false)}><span className="sound-mark" aria-hidden="true">{view.music===false?'🔇':'🔊'}</span><span>Sound</span></button></header>
      {!play.insideHome&&<section className="mission panel living-request" aria-label="Current island task">
        <div className="eyebrow">{task?.friend==='you'?'Your first adventure':task?'A little help for Adam':play.homeReady?'Look what we made!':play.stage>=3?'A home for two friends':'Look what you made!'}</div>
        <strong>{hint?.delivery?hint.label:task?.title||(play.homeReady?'Your home is ready!':play.stage>=3?'Adam is building!':'Your first camp is ready!')}</strong>
        <p>{hint?.instruction||(play.homeReady?'Come and have a look inside.':play.stage>=3?'Watch Adam work, or explore while he builds.':'A cozy place for your adventure.')}</p>
        {task&&<><div className="living-progress" aria-live="polite"><ItemIcon id={task.item==='wood'?'pine_wood':task.item} size={24}/><span>{hint.progress}</span><span className="living-pips" aria-hidden="true">{Array.from({length:task.count},(_,i)=><i key={i} className={i<hint.found?'filled':''}/>)}</span></div><div className="living-goal-actions"><button className="living-guide" onClick={()=>invoke(t=>t.showNext())}><Icon type="walk" size={24}/>{hint.label}</button>{play.canSpeak&&<button className="living-listen" aria-label="Hear this task" onClick={()=>invoke(t=>t.hearTask())}>🔊</button>}</div></>}
        {play.homeReady&&<button className="living-guide" onClick={()=>invoke(t=>t.visitHome())}>Explore our home</button>}
        {!task&&!play.adamUnlocked&&!modal&&<button className="living-guide" onClick={()=>invoke(t=>t.openInvite())}>Meet your first friend</button>}
      </section>}
      {play.stage>=2&&!play.insideHome&&<nav className="side-buttons" aria-label="Explore your island"><button className="actions-menu-button" onClick={()=>setPanel('build')} aria-label="Open build"><img className="picture-icon higgsfield-icon" src="/icons/higgsfield/build_home.png?v=cottage1" width="44" height="44" alt=""/><span>Home</span></button></nav>}
      {play.adamUnlocked&&!play.insideHome&&<button className="friends-button" aria-label="Friends" onClick={()=>setPanel('friends')}><img className="picture-icon" src="/icons/higgsfield/friends.png?v=2" width="32" height="32" alt=""/><span>Friends</span></button>}
      {!modal&&!play.insideHome&&play.resources.filter(r=>r.visible).map(r=><button key={r.id} className="living-resource-hit" style={{left:r.x,top:r.y}} aria-label={`Walk to ${r.id}`} onClick={()=>invoke(t=>t.walk(t.resources.find(p=>p.id===r.id)))}/>)}
      {!modal&&!play.insideHome&&play.target?.visible&&<button className="living-target" style={{left:play.target.x,top:play.target.y-26}} aria-label="Walk to the next task spot" onClick={()=>invoke(t=>t.showNext())}><span aria-hidden="true">↓</span>{hint?.delivery?'Bring them here':'Tap here'}</button>}
      {!modal&&!play.insideHome&&play.pickupNotice&&<div className="living-pickup" role="status">{play.pickupNotice}</div>}
      {!modal&&play.celebration&&<div className="panel living-celebration" role="status"><Icon type="build" size={36}/><strong>{play.celebration}</strong></div>}
      {!modal&&<section className="bottom-hud"><div className="context panel living-carry">{play.insideHome?<button onClick={()=>engine.current?.building.leaveHome()}>← Back to our island</button>:<><button onClick={()=>setPanel('bag')} aria-label="Open my bag"><Icon type="bag" size={30}/><b>{Object.values(play.inventory).reduce((a,b)=>a+b,0)} in my bag</b></button><small>Tap to walk.<br/>Drag to look around.</small></>}</div></section>}
      {view.toasts?.[0]&&!modal&&!play.celebration&&<div className="toast" role="status">{view.toasts[0].text}</div>}
    </>}
    {(!view.loaded||view.error)&&<div className="living-loading panel" role="status"><strong>{view.error?'The island could not load':'Rowing ashore…'}</strong><p>{view.error||'Getting your island ready.'}</p></div>}
    {modal&&play&&<div className={`drawer-shade ${milestone?'living-milestone-shade':''}`} onClick={close}><section ref={drawer} className={`drawer ${milestone?'living-milestone':''}`} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="living-drawer-title" onClick={e=>e.stopPropagation()}><div className="drawer-header"><div className="eyebrow">YOUR ISLAND ADVENTURE</div><h1 id="living-drawer-title">{title}</h1><button className="close" onClick={close} aria-label="Back to island">← Back</button></div>
      {modal==='first-friend'?<><p>Your camp is ready. Read a story to invite Adam to your island!</p><div className="food-actions"><button disabled={play.openingStory} onClick={()=>invoke(t=>t.requestFirstFriend())}><Icon type="book"/>{play.openingStory?'Opening your story…':'Let’s read a story'}</button><button onClick={close}>Keep exploring for now</button></div>{play.storyError&&<p role="alert">{play.storyError}</p>}</>:modal==='welcome'?<><p>“Hello! I’m Adam. I’m so glad we’re friends!”</p><div className="food-actions"><button onClick={close}>Welcome, Adam!</button></div></>:panel==='friends'?<><p>Friends explore and help around the island.</p><div className="friends-list">{play.friends.map(f=><button className="friend-row" key={f.id} onClick={()=>{invoke(t=>t.hello(f.id));close();}}><img className="picture-icon" src="/icons/higgsfield/friends.png?v=2" width="44" height="44" alt=""/><span className="friend-body"><strong>{f.name}</strong><small>Say hello</small></span></button>)}</div></>:panel==='bag'?<><p>Walk close to supplies to pick them up.</p>{Object.entries(play.inventory).filter(([id,n])=>n>0||id===task?.item).map(([id,n])=><div className="living-bag-row" key={id}><ItemIcon id={id==='wood'?'pine_wood':id}/><strong>{id==='wood'?'Logs':'Carrots'}</strong><span>{n}</span></div>)}{Object.values(play.inventory).every(n=>!n)&&<p>Your bag is ready for an adventure.</p>}</>:<><p>{play.homeReady?'We made a home together!':play.stage>=3?'Adam is building your home. You can watch or explore.':'Bring logs to the home circle. Adam will do the building.'}</p><div className="food-actions">{play.homeReady?<button onClick={()=>{close();invoke(t=>t.visitHome());}}>Explore our home</button>:task&&<button onClick={()=>{close();invoke(t=>t.showNext());}}>{hint.label}</button>}</div></>}
    </section></div>}
  </main>;
}
