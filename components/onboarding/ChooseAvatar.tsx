import React, {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Users} from 'lucide-react';
import {LIVING_AVATARS,getLivingAvatar,livingAvatarPortraitUrl} from '../../shared/livingAvatars.mjs';
import {ONBOARDING_FAMILY_BG_POSTER} from '../../utils/onboardingJourney';
import {createAvatarPreview} from './avatarPreviewScene';
import './ChooseAvatar.css';

type Props={selectedId:string;onSelect:(id:string)=>void;onConfirm:()=>void;onBack:()=>void};
export default function ChooseAvatar({selectedId,onSelect,onConfirm,onBack}:Props) {
  const host=useRef<HTMLDivElement>(null);
  const scene=useRef<ReturnType<typeof createAvatarPreview> | null>(null);
  const swipe=useRef<{x:number;y:number}|null>(null);
  const [fallback,setFallback]=useState(false);
  const [familyHelp,setFamilyHelp]=useState(false);
  const avatar=getLivingAvatar(selectedId);
  const index=LIVING_AVATARS.findIndex(item=>item.id===avatar.id);
  const move=(direction:number)=>onSelect(LIVING_AVATARS[(index+direction+LIVING_AVATARS.length)%LIVING_AVATARS.length].id);
  useEffect(()=>{
    if(!host.current)return;
    const lost=(event:Event)=>{event.preventDefault();setFallback(true);};
    try {scene.current=createAvatarPreview(host.current,selectedId);host.current.addEventListener('webglcontextlost',lost,true);}
    catch {setFallback(true);}
    const element=host.current;
    return ()=>{element.removeEventListener('webglcontextlost',lost,true);scene.current?.dispose();scene.current=null;};
  },[]);
  useEffect(()=>{scene.current?.select(selectedId);},[selectedId]);
  return <main className="choose-avatar" style={{backgroundImage:`linear-gradient(#e9f8f7d9,#f5edcedd),url("${ONBOARDING_FAMILY_BG_POSTER}")`}}>
    <button className="avatar-back" aria-label="Back to name and age" onClick={onBack}><ChevronLeft size={26}/></button>
    <div className="avatar-layout">
      <header className="avatar-heading"><span className="avatar-eyebrow">YOUR ADVENTURE STARTS HERE</span><h1>Choose your avatar</h1><p>Who will explore your island?</p></header>
      <section className="avatar-carousel" aria-roledescription="carousel" aria-label="Choose from six adventurers">
        <div className="avatar-halo" aria-hidden="true"/>
        <div className="avatar-pedestal" aria-hidden="true"/>
        <div className="avatar-viewport" tabIndex={0} role="group" aria-label={`${avatar.name}, ${index+1} of 6. Swipe or use the arrow keys.`}
          onKeyDown={event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();move(event.key==='ArrowRight'?1:-1);}}}
          onPointerDown={event=>{swipe.current={x:event.clientX,y:event.clientY};event.currentTarget.setPointerCapture(event.pointerId);}}
          onPointerCancel={()=>{swipe.current=null;}}
          onPointerUp={event=>{const start=swipe.current;swipe.current=null;if(!start)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.abs(dx)>42&&Math.abs(dx)>Math.abs(dy)*1.2)move(dx<0?1:-1);}}>
          <div ref={host} className={`avatar-canvas${fallback?' is-hidden':''}`}/>
          {fallback&&<img className="avatar-static" src={livingAvatarPortraitUrl(avatar.portrait)} alt=""/>}
        </div>
        <button className="avatar-arrow previous" aria-label="Previous avatar" onClick={()=>move(-1)}><ChevronLeft size={28}/></button>
        <button className="avatar-arrow next" aria-label="Next avatar" onClick={()=>move(1)}><ChevronRight size={28}/></button>
      </section>
      <div className="avatar-caption" aria-live="polite" aria-atomic="true"><h2>{avatar.name}</h2><span>{index+1} of 6</span></div>
      <div className="avatar-dots" aria-hidden="true">{LIVING_AVATARS.map(item=><i key={item.id} className={item.id===avatar.id?'selected':''}/>)}</div>
      <p className="avatar-swipe-hint">Swipe to meet the others</p>
      <button className="avatar-confirm" onClick={onConfirm}>This is me! <span aria-hidden="true">→</span></button>
      <button className="avatar-family" aria-expanded={familyHelp} aria-controls="avatar-family-help" onClick={()=>setFamilyHelp(value=>!value)}><Users size={17}/><span>You can add another profile later</span></button>
      {familyHelp&&<p id="avatar-family-help" className="avatar-family-help">More kids in your family? Add another child from Profiles later. Each child gets their own island and progress.</p>}
    </div>
  </main>;
}
