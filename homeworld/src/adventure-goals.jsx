import React,{useEffect,useRef,useState} from 'react';
import {useDialogFocus} from './ui.jsx';
import {GOALS,goalById,goalFacts,restoreGoals,availableGoals,chooseGoal,advanceGoal} from './adventure-goals.mjs';
import './adventure-goals.css';
function GoalArt({goal}){
 const [failed,setFailed]=useState(false);
 return <div className={`adventure-art ${goal.color}`} aria-hidden="true">{failed?<span>{goal.emoji}</span>:<img src={`/assets/${goal.art}`} alt="" onError={()=>setFailed(true)}/>}<span className="adventure-art-spark">✦</span></div>;
}
export function AdventureGoals({engine,view,blocked,onPanel,onModalChange,request,onActiveChange}){
 const [sheet,setSheet]=useState(null),[selected,setSelected]=useState(null),[error,setError]=useState('');const dialog=useRef(null),lastRequest=useRef(request);
 const saved=restoreGoals(view.state?.adventureGoals),facts=goalFacts(view.state),active=goalById(saved.active),record=active&&saved.records[active.id];
 const stepIndex=active?active.steps.findIndex((s,i)=>record.progress[i]<s.count):-1,step=active?.steps[stepIndex];
 const celebration=goalById(saved.celebrate),options=availableGoals(saved,facts),modal=sheet||(!blocked&&celebration?'complete':null);
 const persist=next=>{const g=engine.current;if(!g?.store)return false;try{g.store.save({...g.store.state,adventureGoals:next});setError('');g.notify();return true;}catch{setError('Your goal could not be saved. Please try again.');return false;}};
 const close=()=>{if(modal==='complete')persist({...saved,celebrate:null});setSheet(null);setSelected(null);};
 useDialogFocus(!!modal,dialog,close);
 useEffect(()=>{if(request!==lastRequest.current){lastRequest.current=request;setSelected(null);setSheet('picker');}},[request]);
 useEffect(()=>{onModalChange?.(!!modal);engine.current?.livingTest?.setDialog(!!modal||blocked);return()=>onModalChange?.(false);},[!!modal,blocked]);
 useEffect(()=>{onActiveChange?.(!!active);},[!!active]);
 const stamp=JSON.stringify(facts),saveStamp=JSON.stringify(saved);
 useEffect(()=>{if(!view.loaded||!saved.active)return;const next=advanceGoal(saved,facts);if(JSON.stringify(next)!==saveStamp)persist(next);},[stamp,saveStamp,view.loaded]);
 const start=()=>{if(persist(advanceGoal(chooseGoal(saved,selected,facts),facts))){setSheet(null);setSelected(null);engine.current?.livingTest?.activity();}};
 const help=()=>{
  setSheet(null);const g=engine.current;if(!g||!step)return;g.livingTest?.stopWatching();g.livingTest?.activity();
  if(step.action==='food')onPanel('food');
  else if(step.action==='fish')g.nutrition.goFish();
  else if(step.action.startsWith('build:'))onPanel('build');
  else{g.setTool(step.action==='harvest'?'walk':step.action);g.toast(step.action==='axe'?'Tap a tree to chop it.':step.action==='mine'?'Tap a stone to break it.':step.action==='hoe'?'Tap clear grass to till a square.':step.action==='plant'?'Choose a seed, then tap a tilled square.':step.action==='water'?'Tap a thirsty plant to water it.':'Tap a ripe crop to harvest it.');if(step.action==='plant')onPanel('catalogue');}
  g.notify();
 };
 const openPicker=()=>{setSelected(null);setSheet('picker');};
 if(!view.loaded||!view.livingTest)return null;
 return <div className={`adventure-layer ${active?'has-goal':''}`}>
  {!blocked&&!modal&&!view.livingTest.arrival&&!view.livingTest.placingAdam&&<>
   {active&&step?<section className="adventure-current" aria-label="My goal"><button className="adventure-current-art" aria-label="See my goal" onClick={()=>setSheet('detail')}><GoalArt goal={active}/></button><div><button className="adventure-current-title" onClick={()=>setSheet('detail')}>{active.title}</button><p aria-live="polite">{step.label} <b>{record.progress[stepIndex]}/{step.count}</b></p><div className="adventure-stage-dots" aria-label={`Step ${stepIndex+1} of ${active.steps.length}`}>{active.steps.map((s,i)=><i key={s.id} className={i<stepIndex?'done':i===stepIndex?'now':''}/>)}</div><button className="adventure-show" onClick={help}>Show me <span aria-hidden="true">→</span></button></div></section>:<button className="adventure-invite" onClick={openPicker}><span aria-hidden="true">✦</span><span><b>My next adventure</b><small>Choose something to do</small></span><span aria-hidden="true">→</span></button>}
  </>}
  {modal&&<div className="adventure-shade" onClick={close}><section ref={dialog} className={`adventure-sheet ${modal==='complete'?'adventure-complete':''}`} role="dialog" aria-modal="true" aria-labelledby="adventure-title" tabIndex={-1} onClick={e=>e.stopPropagation()}>
   <button data-dialog-close className="adventure-close" aria-label="Back to island" onClick={close}>×</button>
   {modal==='complete'&&celebration?<><div className="adventure-kicker">YOU DID IT!</div><GoalArt goal={celebration}/><h1 id="adventure-title">Adventure complete!</h1><p>{celebration.title}</p><div className="adventure-finished-check">✓</div><p className="adventure-muted">Look at what you can do!</p><button className="adventure-primary" onClick={()=>{if(persist({...saved,celebrate:null}))openPicker();}}>Choose my next goal →</button><button className="adventure-text" onClick={close}>Keep exploring</button></>:modal==='detail'&&active?<><div className="adventure-kicker">MY ADVENTURE</div><h1 id="adventure-title">{active.title}</h1><div className="adventure-detail-art"><GoalArt goal={active}/></div><ol className="adventure-steps">{active.steps.map((s,i)=><li key={s.id} className={i<stepIndex?'done':i===stepIndex?'current':''}><span>{i<stepIndex?'✓':i+1}</span><div><b>{s.label}</b>{i===stepIndex&&<small>{record.progress[i]} of {s.count}</small>}</div></li>)}</ol><button className="adventure-primary" onClick={help}>Show me the next step →</button><button className="adventure-text" onClick={openPicker}>Choose something else</button><p className="adventure-muted">Your progress stays safe.</p></>:selected?<><div className="adventure-kicker">LET'S MAKE IT HAPPEN</div><div className="adventure-detail-art"><GoalArt goal={goalById(selected)}/></div><h1 id="adventure-title">{goalById(selected).title}</h1><p>{goalById(selected).description}</p><div className="adventure-preview-note">One little step at a time.</div><button className="adventure-primary" onClick={start}>Let's do it! →</button><button className="adventure-text" onClick={()=>setSelected(null)}>Back to my choices</button></>:<><div className="adventure-kicker">A LITTLE ADVENTURE, A BIG SMILE</div><h1 id="adventure-title">What shall we do next?</h1><p>Pick something you'd love to do.</p><div className="adventure-options">{options.slice(0,3).map(g=><button key={g.id} className={`adventure-option ${g.color}`} onClick={()=>setSelected(g.id)}><GoalArt goal={g}/><strong>{g.title}</strong><span>{saved.records[g.id]?'Keep going':'Choose this'} <b aria-hidden="true">→</b></span></button>)}</div>{!options.length&&<p>You've finished every adventure here! Enjoy your island while more adventures are on the way.</p>}<button className="adventure-text" onClick={close}>Explore for now</button>{Object.values(saved.records).some(r=>r.completed)&&<p className="adventure-muted">{Object.values(saved.records).filter(r=>r.completed).length} {Object.values(saved.records).filter(r=>r.completed).length===1?'adventure completed':'adventures completed'} ✦</p>}</>}
   {error&&<p className="adventure-error" role="alert">{error}</p>}
  </section></div>}
 </div>;
}
