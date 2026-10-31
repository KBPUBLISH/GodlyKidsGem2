import React,{useEffect,useRef} from 'react';
import {Icon,ItemIcon,useDialogFocus} from './ui.jsx';
import './living-test.css';
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
 const gardenTask=!!garden&&!garden.completed;
 const modal=blocked?null:farm?.pending?'purchase':play?.decision?'build-confirm':(play?.tasksOpen?'tasks':play?.inviteVisible?'first-friend':play?.welcomeVisible?'welcome':null);
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
 useEffect(()=>{invoke(t=>t.setDialog(!!modal||blocked));onModalChange?.(!!modal);},[modal,blocked,onModalChange]);
 const title=modal==='tasks'?'My first tasks':modal==='purchase'?(farm.pending.kind==='coop'?'Bigger coop?':farm.pending.kind==='chicken'?'New chicken?':'New cow?'):modal==='build-confirm'?`Build ${play.decision.name}?`:modal==='first-friend'?'Add a friend?':modal==='welcome'?'Hi, Adam!':'Our home';
 const gardenIcon=garden?.phase==='plant'?'plant':'harvest';
 return <div className="living-intro-layer">
  {view.loaded&&play&&!blocked&&<>
   {!modal&&!play.insideHome&&!play.watching&&<section className="living-request" aria-label="Current island task">
    {play.placingAdam?<ActionChip emoji="👋" label="Tap land" accessibleLabel="Place Adam on clear land" onClick={()=>invoke(t=>t.placeAdam())}/>:gardenTask?<ActionChip icon={gardenIcon} label={garden.busy?(garden.seconds?'Growing…':'…'):garden.phase==='plant'?'Plant':'Pick'} accessibleLabel={garden.label} disabled={garden.busy} aria-busy={garden.busy} progress={{value:garden.value,total:garden.total,label:garden.progress}} onClick={()=>invoke(t=>t.garden.go())}/>:task?<ActionChip icon={hint.delivery?'walk':task.item==='wood'?'wood':'carrot'} label={hint.delivery?'Bring':'Pick'} accessibleLabel={hint.label} progress={{value:hint.delivery?play.deposited:hint.found,total:task.count,label:hint.progress}} onClick={()=>invoke(t=>t.showNext())}/>:play.homeReady?<ActionChip icon="build" label="Visit" accessibleLabel="Explore our home" onClick={()=>invoke(t=>t.visitHome())}/>:play.stage>=3?<div className="living-building" role="status"><Icon type="build" size={30}/><span>Building…</span></div>:!play.adamUnlocked?<ActionChip icon="book" label="Meet Adam" accessibleLabel="Meet your first friend" onClick={()=>invoke(t=>t.openInvite())}/>:null}
    {play.canSpeak&&<button className="living-round" aria-label="Hear this task" onClick={()=>invoke(t=>t.hearTask())}>👂</button>}
    {farm.error&&<p role="alert" className="living-error">{farm.error}</p>}
   </section>}
   {!modal&&!play.insideHome&&!play.watching&&!gardenTask&&!play.placingAdam&&play.resources.filter(r=>r.visible).map(r=><button key={r.id} className="living-resource-hit" style={{left:r.x,top:r.y}} aria-label={`Walk to ${r.id}`} onClick={()=>invoke(t=>t.walk(t.resources.find(p=>p.id===r.id)))}/>)}
   {!modal&&!play.insideHome&&!play.watching&&!gardenTask&&!play.placingAdam&&play.target?.visible&&<button className="living-target" style={{left:`clamp(30px, ${play.target.x}px, calc(100% - 30px))`,top:play.target.y-26}} aria-label="Walk to the next task spot" onClick={()=>invoke(t=>t.showNext())}><Icon type={hint?.delivery?'walk':task?.item==='wood'?'wood':'carrot'} size={30}/><span className="living-point-arrow" aria-hidden="true">▼</span></button>}
   {!modal&&!play.watching&&!play.insideHome&&gardenTask&&garden.spots.filter(p=>p.visible).map(p=><button key={p.index} className="living-garden-spot" style={{left:p.x,top:p.y}} disabled={garden.busy} aria-label={garden.phase==='plant'?`Plant carrot spot ${p.index+1}`:`Pick ${p.crop} from garden spot ${p.index+1}`} onClick={()=>invoke(t=>t.garden.go(p.index))}><Icon type={gardenIcon} size={28}/></button>)}
   {!modal&&play.placingAdam&&play.dropTarget?.visible&&<button className="living-target" style={{left:play.dropTarget.x,top:play.dropTarget.y}} aria-label="Place Adam here" onClick={()=>invoke(t=>t.placeAdam())}><span aria-hidden="true">👋</span><span className="living-point-arrow" aria-hidden="true">▼</span></button>}
   {!modal&&!play.watching&&!play.insideHome&&!gardenTask&&!play.placingAdam&&garden.crops.filter(c=>c.ready&&c.visible).map(c=><button key={c.index} className="living-resource-hit" style={{left:c.x,top:c.y}} aria-label={`Pick ${c.crop} · +2 coins`} onClick={()=>invoke(t=>t.garden.go(c.index))}/>)}
   {!modal&&!play.watching&&!play.insideHome&&!play.placingAdam&&farm.animals.filter(a=>a.ready&&a.screen.visible).map(a=><button key={a.id} className="living-target farm-ready" style={{left:`clamp(30px, ${a.screen.x}px, calc(100% - 30px))`,top:a.screen.y}} aria-label={`Collect from ${a.name}`} onClick={()=>invoke(t=>t.farm.walkTo(a.id))}><span aria-hidden="true">{a.kind==='chicken'?'🥚':'🥛'}</span><b>{a.ready}</b></button>)}
   {!modal&&play.greeting?.visible&&<div className="living-greeting" role="status" style={{left:`clamp(85px, ${play.greeting.x}px, calc(100% - 85px))`,top:play.greeting.y}}>{play.greeting.text}</div>}
   {!modal&&play.watching&&<section className="living-watch"><span>{play.watchingName}</span><button aria-label="Back to me" onClick={()=>invoke(t=>t.stopWatching())}><Icon type="walk" size={30}/>Back to me</button></section>}
   {!modal&&!play.insideHome&&play.pickupNotice&&!play.celebration&&<div className="living-pickup" role="status">{play.pickupNotice}</div>}
   {!modal&&play.celebration&&<div className="living-celebration" role="status"><Icon type="actions" size={28}/><strong>{play.celebration}</strong></div>}
   {view.toasts?.[0]&&!modal&&!play.celebration&&!play.pickupNotice&&<div className="toast living-toast" role="status">{view.toasts[0].text}</div>}
  </>}
  {modal&&play&&<div className="drawer-shade living-sheet-shade" onClick={close}><section ref={drawer} className={`drawer living-sheet living-sheet-${modal}`} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="living-drawer-title" onClick={e=>e.stopPropagation()}>
   <div className="drawer-header"><h1 id="living-drawer-title">{title}</h1><button className="close" onClick={close} aria-label="Back to island">×</button></div>
   {modal==='tasks'?<>
    <div className="living-task-list">{play.tasks.map(task=><button key={task.id} className={`living-task-row ${task.done?'done':''}`} disabled={task.locked||task.done} aria-label={`${task.accessibleLabel||task.label}. ${task.value} of ${task.total}${task.done?'. Done':task.locked?'. Complete the previous task first':''}`} onClick={()=>invoke(t=>t.startTask(task.id))}>
     <Icon type={task.icon} size={36}/><span className="living-task-copy"><strong>{task.label}</strong>{task.crops?<span className="living-task-crops">{task.crops.map(c=><span key={c.id} aria-label={`${c.id}: ${c.done?1:0} of 1`}><span aria-hidden="true">{c.id==='carrot'?'🥕':c.id==='pumpkin'?'🎃':'🥬'}</span>{c.done?'✓':'0/1'}</span>)}</span>:<small>{task.value}/{task.total}</small>}</span><b aria-hidden="true">{task.done?'✓':task.locked?'🔒':'→'}</b>
    </button>)}</div>
    <button className="living-task-hear" aria-label="Hear my tasks" onClick={()=>invoke(t=>t.hearTask())}>👂 Hear tasks</button>
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
