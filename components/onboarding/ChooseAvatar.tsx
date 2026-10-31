import React, {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Users,ArrowRight} from 'lucide-react';
import {LIVING_AVATARS,getLivingAvatar,livingAvatarPortraitUrl} from '../../shared/livingAvatars.mjs';
import {PREVIEW_ART} from '../../utils/previewAssets.mjs';
import {createAvatarPreview} from './avatarPreviewScene';
import './ChooseAvatar.css';

const ART='/assets/images/avatar-harbor';
type Props={selectedId:string;onSelect:(id:string)=>void;onConfirm:()=>void;onBack:()=>void};
export default function ChooseAvatar({selectedId,onSelect,onConfirm,onBack}:Props) {
  const host=useRef<HTMLDivElement>(null);
  const scene=useRef<ReturnType<typeof createAvatarPreview> | null>(null);
  const swipe=useRef<{x:number;y:number;lastX:number;time:number;mode?:'swipe'|'turn'}|null>(null);
  const [fallback,setFallback]=useState(false);
  const [familyHelp,setFamilyHelp]=useState(false);
  const avatar=getLivingAvatar(selectedId);
  const index=LIVING_AVATARS.findIndex(item=>item.id===avatar.id);
  const move=(direction:number)=>onSelect(LIVING_AVATARS[(index+direction+LIVING_AVATARS.length)%LIVING_AVATARS.length].id);
  useEffect(()=>{
    if(!host.current)return;
    const lost=(event:Event)=>{event.preventDefault();scene.current?.pause();setFallback(true);};
    try {scene.current=createAvatarPreview(host.current,selectedId);host.current.addEventListener('webglcontextlost',lost,true);}
    catch {setFallback(true);}
    const element=host.current;
    return ()=>{element.removeEventListener('webglcontextlost',lost,true);scene.current?.dispose();scene.current=null;};
  },[]);
  useEffect(()=>{scene.current?.select(selectedId);},[selectedId]);
  useEffect(()=>{
    const element=host.current,root=element?.closest<HTMLElement>('.choose-avatar');
    const harbor=root?.querySelector<HTMLElement>('.avatar-harbor');
    if(!element||!root||!harbor)return;
    const placeDock=()=>{
      const bounds=element.parentElement!.getBoundingClientRect(),screen=harbor.getBoundingClientRect();
      const anchor=scene.current?.groundAnchor()||{x:.5,y:.95934};
      let x=bounds.left+bounds.width*anchor.x-screen.left,y=bounds.top+bounds.height*anchor.y-screen.top;
      if(fallback){
        // The full-body fallback is 400×600 and uses object-fit:contain.
        const height=Math.min(bounds.height,bounds.width*1.5);
        y=bounds.top+(bounds.height-height)/2+height*.953-screen.top;
      }
      // The center of the illustrated stone's top is at 50%, 66% in the art.
      // Align that point to the actual soles, covering every viewport edge.
      const width=Math.max(screen.width,2*x,2*(screen.width-x));
      const height=Math.max(screen.height,y/.66,(screen.height-y)/.34);
      harbor.style.setProperty('--dock-width',`${width}px`);harbor.style.setProperty('--dock-height',`${height}px`);
      harbor.style.setProperty('--dock-left',`${x-width*.5}px`);harbor.style.setProperty('--dock-top',`${y-height*.66}px`);
    };
    const observer=new ResizeObserver(placeDock);observer.observe(element.parentElement!);observer.observe(root);
    window.addEventListener('resize',placeDock);placeDock();
    return()=>{observer.disconnect();window.removeEventListener('resize',placeDock);};
  },[fallback]);
  return <main className="choose-avatar">
    <picture className="avatar-harbor" aria-hidden="true"><source media="(min-width:768px)" srcSet={`${ART}/harbor-tablet-v1.webp`}/><img src={`${ART}/harbor-phone-v1.webp`} alt="" fetchPriority="high" decoding="async"/></picture>
    <button className="avatar-back" aria-label="Back to name and age" onClick={onBack}><ChevronLeft size={24}/></button>
    <div className="avatar-layout">
      <img className="avatar-logo" src={PREVIEW_ART.logo} alt="Godly Kids" width="640" height="356" fetchPriority="high"/>
      <header className="avatar-heading"><h1>Choose your avatar</h1><p>Who will explore your island?</p></header>
      <section className="avatar-carousel" aria-roledescription="carousel" aria-label="Choose from six adventurers">
        <div className="avatar-viewport" tabIndex={0} role="group" aria-label={`${avatar.name}, ${index+1} of 6. Hold and drag to turn all the way around. Swipe or use the arrow keys to choose.`}
          onKeyDown={event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();move(event.key==='ArrowRight'?1:-1);}}}
          onPointerDown={event=>{swipe.current={x:event.clientX,y:event.clientY,lastX:event.clientX,time:event.timeStamp};scene.current?.setDragging(true);event.currentTarget.setPointerCapture(event.pointerId);}}
          onPointerMove={event=>{const start=swipe.current;if(!start)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(!start.mode&&Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.2)start.mode=event.timeStamp-start.time<450?'swipe':'turn';if(start.mode==='turn')scene.current?.turn((event.clientX-start.lastX)*.014);start.lastX=event.clientX;}}
          onPointerCancel={()=>{swipe.current=null;scene.current?.setDragging(false);}}
          onPointerUp={event=>{const start=swipe.current;swipe.current=null;scene.current?.setDragging(false);if(!start)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(start.mode!=='turn'&&Math.abs(dx)>42&&Math.abs(dx)>Math.abs(dy)*1.2)move(dx<0?1:-1);}}>
          <div ref={host} className={`avatar-canvas${fallback?' is-hidden':''}`}/>
          {fallback&&<img className="avatar-static" src={`/avatars/adventurers/${avatar.id}-full.webp?v=harbor-4`} alt=""/>}
        </div>
        <button className="avatar-arrow previous" aria-label="Previous avatar" onClick={()=>move(-1)}><ChevronLeft size={34} strokeWidth={4}/></button>
        <button className="avatar-arrow next" aria-label="Next avatar" onClick={()=>move(1)}><ChevronRight size={34} strokeWidth={4}/></button>
      </section>
      <div className="avatar-caption" aria-live="polite" aria-atomic="true"><h2>{avatar.name}</h2><span>{index+1} of 6</span><div className="avatar-dots" aria-hidden="true">{LIVING_AVATARS.map(item=><i key={item.id} className={item.id===avatar.id?'selected':''}/>)}</div></div>
      <div className="avatar-thumbnails" role="group" aria-label="Avatar designs">{LIVING_AVATARS.map(item=><button key={item.id} className={`avatar-thumbnail${item.id===avatar.id?' selected':''}`} aria-label={`Choose ${item.name}`} aria-pressed={item.id===avatar.id} onClick={()=>onSelect(item.id)}><img src={livingAvatarPortraitUrl(item.portrait)} alt="" width="160" height="160" decoding="async"/></button>)}</div>
      <button className="avatar-confirm" onClick={onConfirm}>This is me! <ArrowRight size={30} strokeWidth={3} aria-hidden="true"/></button>
      <div className="avatar-family-row"><button className="avatar-family" aria-expanded={familyHelp} aria-controls="avatar-family-help" onClick={()=>setFamilyHelp(value=>!value)}><Users size={20}/><span>You can add another profile later</span></button>
      {familyHelp&&<p id="avatar-family-help" className="avatar-family-help">More kids in your family? Add another child from Profiles later. Each child gets their own island and progress.</p>}</div>
    </div>
  </main>;
}
