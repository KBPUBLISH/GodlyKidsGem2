import React,{useEffect,useId,useRef,useState} from 'react';
import {cutFry,fryCutX,onFillet,coatInBatter,onBakingTray,insideOven,dragCentre} from './fish-chips-gestures.mjs';
import './fish-chips-activity.css';
import {CookingActionArt as Art} from './cooking-action-art.jsx';

/** Fish and chips has concrete tools, food transformations and drop targets.
 * All saved recipe indices stay unchanged; completion goes through CookingGame. */
export function FishChipsActivity({action,progress,onProgress,onComplete}){
 const prefix=useId().replaceAll(':',''),gesture=useRef(null),timer=useRef(null),closing=useRef(false);
 const [drag,setDrag]=useState(null),[flipped,setFlipped]=useState(false),[hint,setHint]=useState(''),[closed,setClosed]=useState(false);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 const cut=action==='slice',coat=action==='prepare',bake=action==='bake';
 const finished=cut?progress>=3:coat?progress>=2:progress>=1;
 const needsFlip=coat&&progress===1&&!flipped;
 const origin=bake?{x:.5,y:.82}:{x:.5,y:.45};
 const pointer=e=>{const r=e.currentTarget.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};};
 const completePiece=()=>{
  if(finished||needsFlip)return;
  onProgress(progress+1);setHint(cut?(progress===2?'Look! Four long fries, ready for the tray.':'A long fry! Follow the next line.'):coat?(progress===0?'One side is coated. Now flip the fish.':'Both sides are covered in batter!'):'Your tray is on the oven shelf. Close the door to bake.');
 };
 const down=e=>{
  if(gesture.current||finished||needsFlip||closing.current||e.button>0)return;
  const p=pointer(e);
  if(coat&&!onFillet(p)){setHint('Touch the fish in the bowl, then slide it through the batter.');return;}
  if(bake&&!onBakingTray(p)){setHint('Pick up the tray of fish and fries at the bottom.');return;}
  e.preventDefault();try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}
  gesture.current={id:e.pointerId,start:p};setDrag(cut?p:origin);
 };
 const move=e=>{const g=gesture.current;if(!g||e.pointerId!==g.id)return;const p=pointer(e);const c=dragCentre(g.start,p,origin);setDrag(cut?p:coat?{x:Math.max(.34,Math.min(.66,c.x)),y:Math.max(.34,Math.min(.59,c.y))}:c);};
 const up=e=>{
  const g=gesture.current;if(!g||e.pointerId!==g.id)return;const p=pointer(e),centre=dragCentre(g.start,p,origin);gesture.current=null;setDrag(null);
  if(cut?cutFry(g.start,p,progress):coat?coatInBatter(g.start,p):insideOven(centre))completePiece();
  else setHint(cut?'Start at the top of the glowing line. Cut all the way down.':coat?'Slide the fish across the bowl so the batter covers it.':'Slide the tray onto the glowing shelf inside the oven.');
 };
 const flip=()=>{setFlipped(true);setHint('Here is the other side. Slide it through the batter too!');};
 const finish=()=>{
  if(!finished||closing.current)return;
  if(!bake){onComplete();return;}
  closing.current=true;setClosed(true);setHint('Door closed. Time to bake!');timer.current=setTimeout(()=>{if(onComplete()===false){closing.current=false;setClosed(false);setHint('Could not save yet. Your tray is still here. Try again.');}},600);
 };
 const title=cut?(finished?'You made fries!':'Cut long, skinny fries'):coat?(finished?'Battered fish, ready to bake!':needsFlip?'Flip the fish over':progress?'Coat the other side':'Coat the fish in batter'):finished?'Tray in! Close the oven door':'Put the tray on the oven shelf';
 const instruction=cut?(finished?'The potato is now four long strips.':'Follow each line from top to bottom.'):coat?(finished?'Your fish is ready to bake.':needsFlip?'Tap “Flip the fish” to turn it over.':'Slide the fish through the creamy batter.'):finished?'Your fish and fries are ready to bake.':'Drag the tray up into the glowing opening.';
 const tray=finished?{x:.5,y:.35}:drag||origin;
 const fillet=drag||origin;
 return <div className={`fish-activity fish-activity-${action}`}>
  <div className="fish-instruction"><h2>{title}</h2><p>{instruction}</p></div>
  <div className="fish-stage" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{gesture.current=null;setDrag(null);}} role="group" aria-label={instruction}>
   <svg viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
    <defs>
     <linearGradient id={`${prefix}-wood`} x2="0" y2="1"><stop stopColor="#eac18b"/><stop offset="1" stopColor="#c38b51"/></linearGradient>
     <linearGradient id={`${prefix}-potato`}><stop stopColor="#d7a65c"/><stop offset=".25" stopColor="#ffe6a5"/><stop offset=".65" stopColor="#f6d38c"/><stop offset="1" stopColor="#e8bc70"/></linearGradient>
     <linearGradient id={`${prefix}-fish`} x2=".5" y2="1"><stop stopColor="#fff4e5"/><stop offset=".55" stopColor="#f3ceb2"/><stop offset="1" stopColor="#dba285"/></linearGradient>
     <linearGradient id={`${prefix}-crumb`} x2="0" y2="1"><stop stopColor="#f8d280"/><stop offset=".5" stopColor="#e9b55b"/><stop offset="1" stopColor="#c78b3c"/></linearGradient>
     <linearGradient id={`${prefix}-tray`} x2="0" y2="1"><stop stopColor="#b3c7be"/><stop offset=".5" stopColor="#657e77"/><stop offset="1" stopColor="#99afa3"/></linearGradient>
     <radialGradient id={`${prefix}-fire`}><stop stopColor="#ffcc69"/><stop offset=".5" stopColor="#b4632d"/><stop offset="1" stopColor="#422e27"/></radialGradient>
     <linearGradient id={`${prefix}-steel`} x2="0" y2="1"><stop stopColor="#f5faf1"/><stop offset=".45" stopColor="#9eafa5"/><stop offset="1" stopColor="#e5eee0"/></linearGradient>
     {[0,1,2,3].map(i=><clipPath key={i} id={`${prefix}-fry-${i}`}><rect x={90+i*40} y="25" width="40" height="240"/></clipPath>)}
    </defs>
    <rect width="400" height="300" fill={`url(#${prefix}-wood)`}/>
    {[35,100,165,230].map(y=><path key={y} d={`M0 ${y}H400`} stroke="#af7945" opacity=".35" strokeWidth="3"/>)}
    {cut&&<>
     <rect x="19" y="38" width="250" height="233" rx="24" fill="#996338"/><rect x="19" y="30" width="250" height="233" rx="24" fill="#f1ce95" stroke="#cb975b" strokeWidth="4"/>
     <path d="M38 50h210M38 245h210" stroke="#d4a66b" strokeWidth="3"/>
     <rect x="280" y="58" width="109" height="213" rx="15" fill="#9ab2a1" stroke="#dce0b8" strokeWidth="5"/>
     <text x="335" y="45" textAnchor="middle" className="fish-svg-label">MY FRIES</text>
     {[0,1,2,3].map(i=>{const moved=i<progress||(i===3&&finished);return <g key={i} className="fry-piece" style={{transform:moved?`translate(${291+i*23}px, ${82+i%2*10}px) rotate(${i%2?2:-2}deg) scale(.52, .91) translate(${-90-i*40}px, -65px)`:'translate(0px, 0px)'}}>{moved?<Art id="fry" x={90+i*40-60} y={55} width={154} height={190}/>:<g clipPath={`url(#${prefix}-fry-${i})`}><Art id="potato" x={50} y={25} width={240} height={240}/></g>}</g>;})}
     {!finished&&<>
      <path d={`M${fryCutX(progress)*400} 55v196`} stroke="#fff6c2" strokeWidth="12" strokeLinecap="round"/><path d={`M${fryCutX(progress)*400} 55v196`} stroke="#63a391" strokeWidth="4" strokeDasharray="9 7"/>
      <path d={`M${fryCutX(progress)*400-8} 238l8 12 8-12`} fill="none" stroke="#4a8979" strokeWidth="4"/>
      <Art id="knife" x={(drag?.x??fryCutX(progress))*400-18} y={(drag?.y??.18)*300-28} width={110} height={110}/>
      {!drag&&<Art id="hand" x={fryCutX(progress)*400+20} y={150} width={58} height={58} className="tutorial-hand tutorial-hand-cut"/>}
     </>}
    </>}
    {coat&&<>
     <Art id="batter" x={30} y={20} width={340} height={250}/>
     <g className={flipped?'fillet-flipped':''} key={flipped?'back':'front'}>
      <Art id={progress>=2||(progress===1&&!flipped)?'coated':'fillet'} x={fillet.x*400-100} y={fillet.y*300-90} width={200} height={180}/>
      {drag&&<Art id="coated" x={fillet.x*400-100} y={fillet.y*300-90} width={200} height={180} opacity={Math.min(1,Math.abs(drag.x-.5)*6)}/>}
     </g>
     {!finished&&!needsFlip&&!drag&&<>
      <path className="food-direction" d="M97 172Q71 120 116 88m0 0-4 21m4-21-22 5" fill="none" stroke="#fff8d0" strokeWidth="5" strokeLinecap="round"/>
      <Art id="hand" x={217} y={153} width={66} height={66} className="tutorial-hand tutorial-hand-batter"/>
     </>}
     <g className="fish-side-checks">{[0,1].map(i=><g key={i} transform={`translate(${145+i*100} 278)`}><circle r="12" fill={progress>i?'#7eab49':'#fff3cd'}/><text y="5" textAnchor="middle" fill={progress>i?'white':'#987c4a'} fontSize="14">{progress>i?'✓':i+1}</text><text x="18" y="5" className="fish-svg-label">Side {i+1}</text></g>)}</g>
    </>}
    {bake&&<>
     <Art id="oven" x={25} y={-10} width={350} height={220}/>
     <rect x="111" y="110" width="178" height="32" rx="8" fill="#ffd880" fillOpacity=".13" stroke="#fff1ac" strokeWidth="3" strokeDasharray="7 5" className={finished?'':'oven-shelf-glow'}/>
     {!finished&&<text x="200" y="93" textAnchor="middle" fill="#fff0c3" fontSize="12" fontWeight="800">SLIDE THE TRAY HERE</text>}
     {!finished&&!drag&&<path className="food-direction" d="M200 216v-39m0 0-11 13m11-13 11 13" stroke="#fff2ac" strokeWidth="6" strokeLinecap="round" fill="none"/>}
     <g className={`baking-tray ${drag?'tray-dragging':''}`} style={{transform:`translate(${tray.x*400}px, ${tray.y*300}px) scale(${finished ? .63 : 1})`}}><Art id="tray" x={-155} y={-72} width={310} height={132}/></g>
     {!finished&&!drag&&<Art id="hand" x={102} y={220} width={62} height={62} className="tutorial-hand tutorial-hand-oven"/>}
     {closed&&<g className="oven-door-shut"><path d="M80 157V84Q80 39 200 39Q320 39 320 84V157Z" fill="#596d64" stroke="#c3ccb4" strokeWidth="6"/><path d="M105 133V89Q105 63 200 63Q295 63 295 89V133Z" fill="#9f6739" stroke="#3a4c42" strokeWidth="4"/><path d="M145 147H255" stroke="#dce0c1" strokeWidth="8" strokeLinecap="round"/></g>}
    </>}
   </svg>
  </div>
  <div className="fish-controls">
   <div className="fish-action-progress" role="progressbar" aria-label={cut?'Fries cut':coat?'Sides coated':'Tray placed'} aria-valuemin={0} aria-valuemax={cut?3:coat?2:1} aria-valuenow={progress}><span style={{width:`${progress/(cut?3:coat?2:1)*100}%`}}/></div>
   {finished?<button className="cooking-gold" disabled={closed} onClick={finish}>{cut?'Fries ready! Coat the fish ❯':coat?'Fish ready! Go to the oven ❯':closed?'Baking…':'Close the oven & bake ❯'}</button>:needsFlip?<button className="cooking-gold" onClick={flip}>Flip the fish ↻</button>:<button className="cooking-gold" onClick={completePiece}>{cut?'Cut the next fry ↓':coat?'Coat this side in batter':'Slide the tray onto the shelf ↑'}</button>}
   <p className="fish-hint" role="status" aria-live="polite">{hint||'Drag to play, or use the big button.'}</p>
  </div>
 </div>;
}
