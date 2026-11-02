import React,{useEffect,useRef,useState} from 'react';
import {KitchenRoomScene} from './kitchen-room-scene.js';
import {KITCHEN_STATIONS} from './kitchen-navigation.mjs';

export function KitchenRoom({game,next,station,moving,travel,onTravel,onArrive,carrying,working,done,counts,action,progress}){
 const canvas=useRef(null),scene=useRef(null),arrive=useRef(onArrive),[layout,setLayout]=useState([]),[fallback,setFallback]=useState(false);
 arrive.current=onArrive;
 useEffect(()=>{try{scene.current=new KitchenRoomScene(canvas.current,game?.model?.userData?.avatarId,id=>arrive.current(id),setLayout);}catch{setFallback(true);}return()=>{scene.current?.dispose();scene.current=null;};},[game]);
 useEffect(()=>{scene.current?.set({next,carrying,working,done,counts,action,progress});},[next,carrying,working,done,counts,action,progress]);
 useEffect(()=>{if(!travel)return;if(scene.current)scene.current.moveTo(travel.id);else arrive.current(travel.id);},[travel]);
 return <div className={`kitchen-room ${fallback?'room-fallback':''}`}>
  <canvas ref={canvas} aria-hidden="true"/>
  {fallback&&<div className="kitchen-room-fallback" aria-hidden="true"><span>🧑‍🍳</span><p>Your sunny island kitchen</p></div>}
  <nav className="kitchen-stations" aria-label="Walk to a kitchen station">{KITCHEN_STATIONS.map(s=>{const position=layout.find(p=>p.id===s.id);return <button key={s.id} style={!fallback&&position?{left:`${position.left}%`,top:`${position.top}%`}:undefined} className={`kitchen-station ${next===s.id?'station-next':''} ${station===s.id&&!moving?'station-here':''}`} onClick={()=>onTravel(s.id)} aria-label={`Walk to ${s.name}${next===s.id?' · next step':''}`} aria-current={station===s.id&&!moving?'location':undefined}><span aria-hidden="true">{s.icon}</span><b>{s.name}</b><small>{moving&&travel?.id===s.id?'Walking…':next===s.id?'✦ Next stop':station===s.id?'You are here':'Walk here'}</small></button>;})}</nav>
  <div className="kitchen-room-caption">{moving?'Here comes the chef!':carrying?'Made by you. Carry it to the next station!':'Tap a station to walk there. Take your time.'}</div>
 </div>;
}
