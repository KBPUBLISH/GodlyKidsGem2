import React,{useEffect,useRef,useState} from 'react';
import {createAvatarPreview} from '../onboarding/avatarPreviewScene';
/** The same chosen 3D scout, grounded on the painted deck without another model download. */
export default function ShipPlayerAvatar({avatarId,name,style,paused=false}:{avatarId:string;name?:string;style:React.CSSProperties;paused?:boolean}){
 const host=useRef<HTMLDivElement>(null),scene=useRef<ReturnType<typeof createAvatarPreview>|null>(null);
 const [fallback,setFallback]=useState(false);
 useEffect(()=>{
  if(!host.current)return;
  const node=host.current,lost=(event:Event)=>{event.preventDefault();scene.current?.pause();setFallback(true);};
  try{scene.current=createAvatarPreview(node,avatarId);scene.current.setDragging(true);node.addEventListener('webglcontextlost',lost);}
  catch{setFallback(true);}
  return()=>{node.removeEventListener('webglcontextlost',lost);scene.current?.dispose();scene.current=null;};
 },[]);
 useEffect(()=>{scene.current?.select(avatarId);scene.current?.setDragging(true);},[avatarId]);
 useEffect(()=>{if(paused)scene.current?.pause();else scene.current?.resume();},[paused]);
 return <div className="ship-player-avatar" data-avatar-id={avatarId} role="img" aria-label={`${name||'Your avatar'} aboard the Godly Ship`} style={{position:'absolute',zIndex:5,pointerEvents:'none',...style}}><div ref={host} style={{width:'100%',height:'100%',visibility:fallback?'hidden':'visible'}}/>{fallback&&<img src={`/avatars/adventurers/${avatarId}-full.webp?v=harbor-4`} alt="" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain'}}/>}</div>;
}
