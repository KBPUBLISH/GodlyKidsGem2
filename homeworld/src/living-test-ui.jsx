import React,{useEffect,useRef} from 'react';
import {Icon,ItemIcon,useDialogFocus} from './ui.jsx';
import './living-test.css';
import {IslandArrival} from './living-arrival.jsx';
import {Coins,FarmPurchase} from './living-farm-ui.jsx';

function Progress({value,total,label}){
 return <span className="living-progress" aria-label={label} aria-live="polite"><span className="living-pips" aria-hidden="true">{Array.from({length:total},(_,i)=><i key={i} className={i<value?'filled':''}/>)}</span><b>{value}/{total}</b></span>;
}
function ActionChip({icon,emoji,label,accessibleLabel,progress,children,...props}){
 return <button className="living-guide" aria-label={accessibleLabel} {...props}>{emoji?<span className="living-action-emoji" aria-hidden="true">{emoji}</span>:<Icon type={icon} size={36}/>}<span className="living-action-copy"><strong>{label}</strong>{progress&&<Progress {...progress}/>}{children}</span></button>;
}

export function LivingTestUI({engine,view,blocked=false,onModalChange}){
 const drawer=useRef(null);
 const play=view.livingTest,task=play?.task,hint=play?.guidance,farm=play?.farm,garden=play?.garden;
 blocked=blocked||!!play?.friend?.chatOpen;
 const gardenTask=!!garden&&!garden.completed;
 const modal=blocked||play?.arrival?null:farm?.pending?'purchase':play?.decision?'build-confirm':(play?.tasksOpen?'tasks':play?.inviteVisible?'first-friend':play?.welcomeVisible?'welcome':null);
 const invoke=fn=>engine.current?.livingTest&&fn(engine.current.livingTest);
 const focusWorld=()=>engine.current?.renderer.domElement.focus({preventScroll:true});
 const close=()=>{
  if(modal==='tasks')invoke(t=>t.closeTasks());
  else if(modal==='purchase')invoke(t=>t.farm.cancel());
  else if(modal==='build-confirm')invoke(t=>t.cancelBuild());
  else if(modal==='first-friend')invoke(t=>t.dismissInvite());
  else if(modal==='welcome')invoke(t=>t.welcomeAdam());
  focusWorld();
 };
 useDialogFocus(modal,drawer,close);
 useEffect(()=>{invoke(t=>t.setDialog(!!modal||blocked||!!play?.arrival));onModalChange?.(!!modal||!!play?.arrival);},[modal,blocked,onModalChange,!!play?.arrival]);
 const title=modal==='tasks'?'My first tasks':modal==='purchase'?(farm.pending.kind==='coop'?(farm.coop?'Bigger coop?':'Build a coop?'):farm.pending.kind==='chicken'?'New chicken?':'New cow?'):modal==='build-confirm'?`Build ${play.decision.name}?`:modal==='first-friend'?'Add a friend?':modal==='welcome'?'Hi, Adam!':'Our home';
 const gardenIcon=garden?.phase==='plant'?'plant':garden?.phase==='water'?'water':'harvest';
 return <div className="living-intro-layer">
  {play?.arrival&&<IslandArrival arrival={play.arrival} engine={engine}/>}
  {view.loaded&&play&&!blocked&&!play.arrival&&<>
   {!modal&&!play.insideHome&&!play.watching&&<section className="living-request" aria-label="Current island task">
    {play.helpOffer&&<div className="living-help" role="dialog" aria-label={`${play.helpOffer.who} asks for help`}><strong>{play.helpOffer.who}</strong><p>{play.helpOffer.ask}</p><div className="living-help-actions"><button type="button" onClick={()=>invoke(t=>t.acceptHelp())}>Yes</button><button type="button" onClick={()=>invoke(t=>t.declineHelp())}>No</button></div></div>}
    {play.helpJob&&<div className="living-help living-help-job" role="status" aria-label={play.helpJob.label}><button type="button" className="living-help-x" aria-label="Cancel this task" onClick={()=>invoke(t=>t.cancelHelp())}><span aria-hidden="true">×</span></button><strong>{play.helpJob.who}</strong><p>{play.helpJob.label}</p><small>{play.helpJob.done}/{play.helpJob.count}</small></div>}
    {play.placingAdam?<ActionChip emoji="👋" label="Tap land" accessibleLabel="Place Adam on clear land" onClick={()=>invoke(t=>t.placeAdam())}/>:gardenTask?<ActionChip icon={gardenIcon} emoji={garden.phase==='wait'?'⏳':null} label={garden.busy?'…':garden.phase==='plant'?'Plant':garden.phase==='water'?'Water':garden.phase==='wait'?garden.timer:'Pick'} accessibleLabel={garden.label} disabled={garden.busy||garden.phase==='wait'} aria-busy={garden.busy} progress={{value:garden.value,total:garden.total,label:garden.progress}} onClick={()=>invoke(t=>t.garden.go())}/>:task?<ActionChip icon={hint.delivery?'walk':task.item==='wood'?'wood':'carrot'} label={hint.delivery?'Bring':'Pick'} accessibleLabel={hint.label} progress={{value:hint.delivery?play.deposited:hint.found,total:task.count,label:hint.progress}} onClick={()=>invoke(t=>t.showNext())}/>:play.homeReady?<ActionChip icon="build" label="Visit" accessibleLabel="Explore our home" onClick={()=>invoke(t=>t.visitHome())}/>:play.stage>=3?<div className="living-building" role="status"><Icon type="build" size={30}/><span>Building…</span></div>:!play.adamUnlocked?<ActionChip icon="book" label="Meet Adam" accessibleLabel="Meet your first friend" onClick={()=>invoke(t=>t.openInvite())}/>:null}
    {gardenTask&&garden.phase==='wait'&&task&&!hint.delivery&&<ActionChip icon="wood" label="Find logs" accessibleLabel="Find a log while vegetables grow" onClick={()=>invoke(t=>t.showNext())}/>}
    {play.canSpeak&&<button className="living-task-info" aria-label="Hear this task" title="Read task aloud" onClick={()=>invoke(t=>t.hearTask())}><b aria-hidden="true">!</b></button>}
    {farm.error&&<p role="alert" className="living-error">{farm.error}</p>}
   </section>}
   {!modal&&!play.insideHome&&!play.watching&&!play.placingAdam&&play.resources.filter(r=>r.visible).map(r=><button key={r.id} className="living-resource-hit" style={{left:r.x,top:r.y}} aria-label={`Walk to ${r.id}`} onClick={()=>invoke(t=>t.walk(t.resources.find(p=>p.id===r.id)))}/>)}
   {!modal&&!play.insideHome&&!play.watching&&!gardenTask&&!play.placingAdam&&play.target?.visible&&<button className="living-target" style={{left:`clamp(30px, ${play.target.x}px, calc(100% - 30px))`,top:play.target.y-26}} aria-label="Walk to the next task spot" onClick={()=>invoke(t=>t.showNext())}><Icon type={hint?.delivery?'walk':task?.item==='wood'?'wood':'carrot'} size={30}/><span className="living-point-arrow" aria-hidden="true">▼</span></button>}
   {!modal&&!play.watching&&!play.insideHome&&!play.placingAdam&&garden.spots.map(p=>p.kind==='wait'?<span key={p.index} className="living-garden-timer" ref={node=>invoke(t=>t.garden.bindPrompt(p.index,node))} aria-label={`${p.crop} growing · ${p.timer}`}><span aria-hidden="true">⏳</span>{p.timer}</span>:<button key={p.index} className="living-garden-spot" ref={node=>invoke(t=>t.garden.bindPrompt(p.index,node))} disabled={garden.busy} aria-label={p.kind==='plant'?`Plant carrot spot ${p.index+1}`:p.kind==='water'?`Water ${p.crop} in garden spot ${p.index+1}`:gardenTask?`Pick ${p.crop} from garden spot ${p.index+1}`:`Pick ${p.crop} · +2 coins`} onClick={()=>invoke(t=>t.garden.go(p.index))}><Icon type={p.kind==='plant'?'plant':p.kind==='water'?'water_drop':'harvest'} size={28}/></button>)}
   {!modal&&play.placingAdam&&play.dropTarget?.visible&&<button className="living-target" style={{left:play.dropTarget.x,top:play.dropTarget.y}} aria-label="Place Adam here" onClick={()=>invoke(t=>t.placeAdam())}><span aria-hidden="true">👋</span><span className="living-point-arrow" aria-hidden="true">▼</span></button>}

   {!modal&&!play.watching&&!play.insideHome&&!play.placingAdam&&farm.animals.filter(a=>a.kind!=='chicken'&&a.ready&&a.screen.visible).map(a=><button key={a.id} className="living-target farm-ready" style={{left:`clamp(30px, ${a.screen.x}px, calc(100% - 30px))`,top:a.screen.y}} aria-label={`Collect from ${a.name}`} onClick={()=>invoke(t=>t.farm.walkTo(a.id))}><span aria-hidden="true">{a.kind==='chicken'?'🥚':'🥛'}</span><b>{a.ready}</b></button>)}
   {!modal&&!play.insideHome&&!play.watching&&farm.coop>0&&farm.coopScreen?.visible&&!farm.moving&&<button className="living-target coop-entry" style={{left:`clamp(60px, ${farm.coopScreen.x}px, calc(100% - 60px))`,top:farm.coopScreen.y}} aria-label={`Chicken coop · ${farm.eggCount} eggs ready`} onClick={()=>invoke(t=>t.farm.offerCoop())}><span aria-hidden="true">🏡</span><b>{farm.eggCount>0?`🥚 ${farm.eggCount}`:'Coop'}</b></button>}
   {!modal&&farm.moving&&<div className="coop-move-hint" role="status">Tap open ground to move the coop<button onClick={()=>invoke(t=>t.farm.cancelMove())}>Cancel</button></div>}
   {!modal&&play.friend?.near&&<section className="living-friend-hello" aria-label="Adam nearby"><span className="living-friend-face" aria-hidden="true">👋</span><div><strong>Adam</strong><p>{play.friend.greeting}</p><div><button onClick={()=>invoke(t=>t.friend.open('chat'))}>💬 Chat</button><button onClick={()=>invoke(t=>t.friend.open('tasks'))}>🛠 Help</button></div></div></section>}
   {!modal&&play.greeting?.visible&&<div className="living-greeting" role="status" style={{left:`clamp(85px, ${play.greeting.x}px, calc(100% - 85px))`,top:play.greeting.y}}>{play.greeting.text}</div>}
   {!modal&&play.watching&&<section className="living-watch"><span>{play.watchingName}</span><button aria-label="Back to me" onClick={()=>invoke(t=>t.stopWatching())}><Icon type="walk" size={30}/>Back to me</button></section>}
   {!modal&&!play.insideHome&&play.pickupNotice&&!play.celebration&&<div className="living-pickup" role="status">{play.pickupNotice}</div>}
   {!modal&&play.celebration&&<div className="living-celebration" role="status"><Icon type="actions" size={28}/><strong>{play.celebration}</strong></div>}
  </>}
  {modal&&play&&<div className="drawer-shade living-sheet-shade" onClick={close}><section ref={drawer} className={`drawer living-sheet living-sheet-${modal}`} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="living-drawer-title" onClick={e=>e.stopPropagation()}>
   <div className="drawer-header"><h1 id="living-drawer-title">{title}</h1><button className="close" onClick={close} aria-label="Back to island">×</button></div>
   {modal==='tasks'?<>
    <div className="living-task-list">{play.tasks.map(task=><button key={task.id} className={`living-task-row ${task.done?'done':''}`} disabled={task.locked||task.done} aria-label={`${task.accessibleLabel||task.label}. ${task.value} of ${task.total}${task.done?'. Done':task.locked?'. Complete the previous task first':''}`} onClick={()=>invoke(t=>t.startTask(task.id))}>
     <Icon type={task.icon} size={36}/><span className="living-task-copy"><strong>{task.label}</strong>{task.crops?<span className="living-task-crops">{task.crops.map(c=><span key={c.id} aria-label={`${c.id}: ${c.done?1:0} of 1`}><span aria-hidden="true">{c.id==='carrot'?'🥕':c.id==='pumpkin'?'🎃':'🥬'}</span>{c.done?'✓':'0/1'}</span>)}</span>:<small>{task.value}/{task.total}</small>}</span><b aria-hidden="true">{task.done?'✓':task.locked?'🔒':'→'}</b>
    </button>)}</div>
    <button className="living-task-hear" aria-label="Hear my tasks" onClick={()=>invoke(t=>t.hearTask())}><b aria-hidden="true">!</b> Read tasks aloud</button>
    {play.tasks.every(t=>t.done)&&<p className="living-tasks-done" role="status">All done! 🎉</p>}
   </>:modal==='purchase'?<FarmPurchase key={farm.pending.kind} farm={farm} onConfirm={name=>{if(engine.current.livingTest.farm.confirm(name)){focusWorld();}}} onCancel={close}/>:modal==='build-confirm'?<>
    <div className="living-choice-preview"><ItemIcon id="pine_wood" size={42}/><b>× {play.decision.remaining}</b><span aria-hidden="true">→</span><span className="living-emoji" aria-hidden="true">{play.decision.name==='home'?'🏡':'⛺'}</span></div>
    <div className="food-actions"><button aria-label={`Build ${play.decision.name}`} onClick={()=>{invoke(t=>t.confirmBuild());focusWorld();}}><Icon type="build" size={28}/>Build</button><button aria-label="Not now" onClick={close}>Later</button></div>
   </>:modal==='first-friend'?<>
    <div className="living-choice-preview"><Icon type="book" size={48}/><span aria-hidden="true">→</span><img src="/icons/higgsfield/friends.png?v=2" width="48" height="48" alt="Adam"/></div>
    <div className="food-actions"><button disabled={play.openingStory} aria-label={play.friendLoading?(play.friendError?'Try Adam again':'Adam is arriving…'):play.openingStory?'Opening your story…':'Yes, add a friend'} onClick={()=>invoke(t=>t.requestFirstFriend())}><Icon type="book" size={28}/>{play.friendLoading?(play.friendError?'Retry':'Arriving…'):play.openingStory?'Opening…':'Yes'}</button><button aria-label="No, keep exploring" onClick={close}>No</button></div>{play.storyError&&<p role="alert" className="living-error">{play.storyError}</p>}
   </>:modal==='welcome'?<div className="food-actions"><button aria-label="Welcome, Adam!" onClick={close}><span aria-hidden="true">👋</span>Hi!</button></div>:null}
  </section></div>}
 </div>;
}
