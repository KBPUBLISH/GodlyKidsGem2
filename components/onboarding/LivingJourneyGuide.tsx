import React,{Component,useEffect} from 'react';
import PerryGuidePortrait from './PerryGuidePortrait';
import './livingJourneyGuide.css';
class PortraitFallback extends Component<{children:React.ReactNode},{failed:boolean}>{
 declare props:{children:React.ReactNode};
 state={failed:false};static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<span aria-hidden="true" className="living-perry-fallback">🦜</span>:this.props.children;}
}
export default function LivingJourneyGuide({line,spoken,onAction,label,disabled=false}:{line:string;spoken?:string;onAction?:()=>void;label?:string;disabled?:boolean}){
 const say=()=>{if(!window.speechSynthesis)return;window.speechSynthesis.cancel();const words=new SpeechSynthesisUtterance(spoken||line);words.rate=.9;window.speechSynthesis.speak(words);};
 useEffect(()=>{say();return()=>window.speechSynthesis?.cancel();},[line,spoken]);
 return <aside className="living-journey-guide" aria-label="Perry’s guide">
  <div className="living-perry-portrait"><PortraitFallback><PerryGuidePortrait/></PortraitFallback></div>
  <div className="living-perry-cue"><strong>{line}</strong><div><button type="button" className="living-perry-listen" aria-label="Hear Perry" onClick={say}>👂</button>{onAction&&<button type="button" className="living-perry-action" disabled={disabled} onClick={onAction}>{label}</button>}</div></div>
 </aside>;
}
