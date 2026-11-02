import React,{useEffect,useId,useRef,useState} from 'react';
import {cutFry,fryCutX,onCrumbBowl,overFillet,onBakingTray,insideOven,dragCentre} from './fish-chips-gestures.mjs';
import './fish-chips-activity.css';

function Fillet({coated=false,prefix}){
 return <g>
  <path d="M-92 7Q-77-44-20-40Q45-47 94-8Q85 29 39 39Q-16 54-70 30Z" fill={`url(#${prefix}-${coated?'crumb':'fish'})`} stroke={coated?'#ad7131':'#d7977c'} strokeWidth="3"/>
  {[-55,-30,-5,20,45].map((x,i)=><path key={x} d={`M${x-5} ${-24+i%2*4}q15 24 0 48`} fill="none" stroke={coated?'#eeb85e':'#fff4de'} strokeWidth="3" opacity=".8"/>)}
  {coated&&Array.from({length:65},(_,i)=>{const x=-70+(i*37%145),y=-25+(i*23%55);return <circle key={i} cx={x} cy={y} r={1.5+i%3} fill={i%3?'#f7cc73':'#b67a35'}/>;})}
  <path d="M-72-4Q-27-28 35-17" fill="none" stroke="#fff3cf" strokeWidth="5" strokeLinecap="round" opacity=".5"/>
 </g>;
}

function LoadedTray({prefix}){
 return <g>
  <rect x="-146" y="-42" width="292" height="91" rx="19" fill="#394e4c"/>
  <rect x="-146" y="-48" width="292" height="90" rx="19" fill={`url(#${prefix}-tray)`} stroke="#ecedcf" strokeWidth="5"/>
  <rect x="-132" y="-36" width="264" height="65" rx="12" fill="#d8cba4"/>
  <g transform="translate(-48 -4) scale(.68 .66)"><Fillet coated prefix={prefix}/></g>
  {[0,1,2,3].map(i=><g key={i} transform={`translate(${36+i*21} -25) rotate(${i%2?8:-6})`}><rect width="11" height="49" rx="4" fill={`url(#${prefix}-potato)`} stroke="#ce9a4b" strokeWidth="1.5"/><path d="M3 8v30" stroke="#fff1b1" strokeWidth="2"/></g>)}
  <path d="M-153-17v32M153-17v32" stroke="#9caea1" strokeWidth="10" strokeLinecap="round"/>
 </g>;
}

/** Fish and chips has concrete tools, food transformations and drop targets.
 * All saved recipe indices stay unchanged; completion goes through CookingGame. */
export function FishChipsActivity({action,progress,onProgress,onComplete}){
 const prefix=useId().replaceAll(':',''),gesture=useRef(null),timer=useRef(null),closing=useRef(false);
 const [drag,setDrag]=useState(null),[flipped,setFlipped]=useState(false),[hint,setHint]=useState(''),[closed,setClosed]=useState(false);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 const cut=action==='slice',coat=action==='prepare',bake=action==='bake';
 const finished=cut?progress>=3:coat?progress>=2:progress>=1;
 const needsFlip=coat&&progress===1&&!flipped;
 const origin=bake?{x:.5,y:.82}:{x:.82,y:.83};
 const pointer=e=>{const r=e.currentTarget.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};};
 const completePiece=()=>{
  if(finished||needsFlip)return;
  onProgress(progress+1);setHint(cut?(progress===2?'Look! Four long fries, ready for the tray.':'A long fry! Follow the next line.'):coat?(progress===0?'One side is coated. Now flip the fish.':'Both sides are covered in crunchy crumbs!'):'Your tray is on the oven shelf. Close the door to bake.');
 };
 const down=e=>{
  if(gesture.current||finished||needsFlip||closing.current||e.button>0)return;
  const p=pointer(e);
  if(coat&&!onCrumbBowl(p)){setHint('Pick up the little bowl of crumbs at the bottom right.');return;}
  if(bake&&!onBakingTray(p)){setHint('Pick up the tray of fish and fries at the bottom.');return;}
  e.preventDefault();try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}
  gesture.current={id:e.pointerId,start:p};setDrag(cut?p:origin);
 };
 const move=e=>{const g=gesture.current;if(!g||e.pointerId!==g.id)return;const p=pointer(e);setDrag(cut?p:dragCentre(g.start,p,origin));};
 const up=e=>{
  const g=gesture.current;if(!g||e.pointerId!==g.id)return;const p=pointer(e),centre=dragCentre(g.start,p,origin);gesture.current=null;setDrag(null);
  if(cut?cutFry(g.start,p,progress):coat?overFillet(centre):insideOven(centre))completePiece();
  else setHint(cut?'Start at the top of the glowing line. Cut all the way down.':coat?'Drop the crumbs onto the fish. Try again!':'Slide the tray onto the glowing shelf inside the oven.');
 };
 const flip=()=>{setFlipped(true);setHint('Here is the other side. Cover it with crumbs too!');};
 const finish=()=>{
  if(!finished||closing.current)return;
  if(!bake){onComplete();return;}
  closing.current=true;setClosed(true);setHint('Door closed. Time to bake!');timer.current=setTimeout(()=>{if(onComplete()===false){closing.current=false;setClosed(false);setHint('Could not save yet. Your tray is still here. Try again.');}},600);
 };
 const title=cut?(finished?'You made fries!':'Cut long, skinny fries'):coat?(finished?'A crispy coating, all around!':needsFlip?'Flip the fish over':progress?'Coat the other side':'Give the fish a crunchy coat'):finished?'Tray in! Close the oven door':'Put the tray on the oven shelf';
 const instruction=cut?(finished?'The potato is now four long strips.':'Follow each line from top to bottom.'):coat?(finished?'Your fish is ready to bake.':needsFlip?'Tap “Flip the fish” to turn it over.':'Drag the crumb bowl onto the fish.'):finished?'Your fish and fries are ready to bake.':'Drag the tray up into the glowing opening.';
 const tray=finished?{x:.5,y:.35}:drag||origin;
 const bowl=drag||origin;
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
     {[0,1,2,3].map(i=><clipPath key={i} id={`${prefix}-fry-${i}`}><rect x={90+i*40} y="65" width="40" height="180"/></clipPath>)}
    </defs>
    <rect width="400" height="300" fill={`url(#${prefix}-wood)`}/>
    {[35,100,165,230].map(y=><path key={y} d={`M0 ${y}H400`} stroke="#af7945" opacity=".35" strokeWidth="3"/>)}
    {cut&&<>
     <rect x="19" y="38" width="250" height="233" rx="24" fill="#996338"/><rect x="19" y="30" width="250" height="233" rx="24" fill="#f1ce95" stroke="#cb975b" strokeWidth="4"/>
     <path d="M38 50h210M38 245h210" stroke="#d4a66b" strokeWidth="3"/>
     <rect x="280" y="58" width="109" height="213" rx="15" fill="#9ab2a1" stroke="#dce0b8" strokeWidth="5"/>
     <text x="335" y="45" textAnchor="middle" className="fish-svg-label">MY FRIES</text>
     {[0,1,2,3].map(i=>{const moved=i<progress||(i===3&&finished);return <g key={i} className="fry-piece" style={{transform:moved?`translate(${291+i*23}px, ${82+i%2*10}px) rotate(${i%2?2:-2}deg) scale(.52, .91) translate(${-90-i*40}px, -65px)`:'translate(0px, 0px)'}}>{moved?<g><rect x={90+i*40} y="65" width="34" height="174" rx="7" fill={`url(#${prefix}-potato)`} stroke="#bb8747" strokeWidth="2"/><path d={`M${98+i*40} 78v147`} stroke="#fff2bb" strokeWidth="5" strokeLinecap="round"/></g>:<g clipPath={`url(#${prefix}-fry-${i})`}><rect x="90" y="65" width="160" height="180" rx="42" fill={`url(#${prefix}-potato)`} stroke="#bb8747" strokeWidth="3"/>{[0,1,2,3,4,5,6].map(n=><path key={n} d={`M${105+n*21} 86v130`} stroke="#fff0bd" strokeWidth="2" opacity=".5"/>)}</g>}</g>;})}
     {!finished&&<>
      <path d={`M${fryCutX(progress)*400} 55v196`} stroke="#fff6c2" strokeWidth="12" strokeLinecap="round"/><path d={`M${fryCutX(progress)*400} 55v196`} stroke="#63a391" strokeWidth="4" strokeDasharray="9 7"/>
      <path d={`M${fryCutX(progress)*400-8} 238l8 12 8-12`} fill="none" stroke="#4a8979" strokeWidth="4"/>
      <g transform={`translate(${(drag?.x??fryCutX(progress))*400} ${(drag?.y??.18)*300})`}><path d="M0-4h50v19Q30 26 0 19Z" fill={`url(#${prefix}-steel)`} stroke="#728d83" strokeWidth="2"/><rect x="-42" y="-9" width="43" height="30" rx="9" fill="#825735" stroke="#543c27" strokeWidth="3"/><circle cx="-29" cy="6" r="3" fill="#e9d5a3"/></g>
     </>}
    </>}
    {coat&&<>
     <rect x="35" y="34" width="321" height="173" rx="24" fill="#b8854f"/><rect x="35" y="27" width="321" height="173" rx="24" fill="#f2d7a5" stroke="#ce9f60" strokeWidth="4"/>
     <ellipse cx="189" cy="133" rx="103" ry="46" fill="#9b693c" opacity=".13"/>
     <g transform="translate(190 116)"><g className={flipped?'fillet-flipped':''} key={flipped?'back':'front'}><Fillet prefix={prefix} coated={progress>=2||(progress===1&&!flipped)}/></g></g>
     {drag&&overFillet(drag)&&<g className="crumb-rain">{Array.from({length:22},(_,i)=><circle key={i} cx={125+i*37%140} cy={78+i*19%60} r={2+i%3} fill="#e9b45e"/>)}</g>}
     <g className="fish-side-checks"><circle cx="60" cy="235" r="13" fill={progress>=1?'#7eab49':'#eee0be'}/><text x="60" y="240" textAnchor="middle" fill={progress>=1?'white':'#9c8259'} fontSize="15">{progress>=1?'✓':'1'}</text><text x="80" y="240" className="fish-svg-label">Side 1</text><circle cx="60" cy="272" r="13" fill={progress>=2?'#7eab49':'#eee0be'}/><text x="60" y="277" textAnchor="middle" fill={progress>=2?'white':'#9c8259'} fontSize="15">{progress>=2?'✓':'2'}</text><text x="80" y="277" className="fish-svg-label">Side 2</text></g>
     {!finished&&!needsFlip&&<path className="food-direction" d="M285 218Q255 202 231 171m0 0 18 3m-18-3 3 18" fill="none" stroke="#fff5bb" strokeWidth="6" strokeLinecap="round"/>}
     <g className="crumb-bowl" style={{transform:`translate(${bowl.x*400}px, ${bowl.y*300}px)`}}><path d="M-43-7Q-38 36 0 37Q38 36 43-7" fill="#779990" stroke="#54776d" strokeWidth="3"/><ellipse cy="-7" rx="43" ry="22" fill="#edc36f" stroke="#d6e4bc" strokeWidth="5"/>{Array.from({length:24},(_,i)=><circle key={i} cx={-31+i*23%62} cy={-18+i*17%22} r={1.7+i%2} fill={i%3?'#f9dda0':'#be8b43'}/>)}{!drag&&<text y="45" textAnchor="middle" className="fish-svg-label">CRUMBS</text>}</g>
    </>}
    {bake&&<>
     <path d="M35 167V77Q35 7 200 7Q365 7 365 77V167Z" fill="#bd8158" stroke="#946344" strokeWidth="5"/>
     {[0,1,2,3,4,5,6].map(i=><path key={i} d={`M${53+i*48} 40v31m-20 0h48m-24 0v35m-24 0h48m-24 0v38`} fill="none" stroke="#e2b58a" strokeWidth="4"/>)}
     <path d="M80 157V84Q80 39 200 39Q320 39 320 84V157Z" fill={`url(#${prefix}-fire)`} stroke="#e7b77d" strokeWidth="8"/>
     <path d="M99 136H301M104 146H296" stroke="#a9b4a2" strokeWidth="5"/>
     <rect x="98" y="127" width="204" height="28" rx="8" fill="#ffd880" fillOpacity=".13" stroke="#fff1ac" strokeWidth="3" strokeDasharray="7 5" className={finished?'':'oven-shelf-glow'}/>
     {!finished&&<text x="200" y="91" textAnchor="middle" fill="#fff0c3" fontSize="14" fontWeight="800">SLIDE THE TRAY HERE</text>}
     <path d="M66 163H334L356 196H44Z" fill="#718680" stroke="#b9c9b5" strokeWidth="5"/><path d="M112 187H288" stroke="#485e55" strokeWidth="9" strokeLinecap="round"/>
     {!finished&&!drag&&<path className="food-direction" d="M200 216v-39m0 0-11 13m11-13 11 13" stroke="#fff2ac" strokeWidth="6" strokeLinecap="round" fill="none"/>}
     <g className={`baking-tray ${drag?'tray-dragging':''}`} style={{transform:`translate(${tray.x*400}px, ${tray.y*300}px) scale(${finished ? .63 : 1})`}}><LoadedTray prefix={prefix}/></g>
     {closed&&<g className="oven-door-shut"><path d="M80 157V84Q80 39 200 39Q320 39 320 84V157Z" fill="#596d64" stroke="#c3ccb4" strokeWidth="6"/><path d="M105 133V89Q105 63 200 63Q295 63 295 89V133Z" fill="#9f6739" stroke="#3a4c42" strokeWidth="4"/><path d="M145 147H255" stroke="#dce0c1" strokeWidth="8" strokeLinecap="round"/></g>}
    </>}
   </svg>
  </div>
  <div className="fish-controls">
   <div className="fish-action-progress" role="progressbar" aria-label={cut?'Fries cut':coat?'Sides coated':'Tray placed'} aria-valuemin={0} aria-valuemax={cut?3:coat?2:1} aria-valuenow={progress}><span style={{width:`${progress/(cut?3:coat?2:1)*100}%`}}/></div>
   {finished?<button className="cooking-gold" disabled={closed} onClick={finish}>{cut?'Fries ready! Coat the fish ❯':coat?'Fish ready! Go to the oven ❯':closed?'Baking…':'Close the oven & bake ❯'}</button>:needsFlip?<button className="cooking-gold" onClick={flip}>Flip the fish ↻</button>:<button className="cooking-gold" onClick={completePiece}>{cut?'Cut the next fry ↓':coat?'Sprinkle crumbs on this side':'Slide the tray onto the shelf ↑'}</button>}
   <p className="fish-hint" role="status" aria-live="polite">{hint||'Drag to play, or use the big button.'}</p>
  </div>
 </div>;
}
