import React,{Component,useEffect} from 'react';
import {useCharacterVoice} from '../../utils/useCharacterVoice';
import {ONBOARDING_GUIDE_VOICE_ID} from '../../utils/onboardingJourney';
import PerryGuidePortrait from './PerryGuidePortrait';
import './livingJourneyGuide.css';
class PortraitFallback extends Component<{children:React.ReactNode},{failed:boolean}>{
 declare props:{children:React.ReactNode};
 state={failed:false};static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<span aria-hidden="true" className="living-perry-fallback">🦜</span>:this.props.children;}
}
export default function LivingJourneyGuide({line,spoken,onAction,label,disabled=false,onDismiss,autoSpeak=true}:{line:string;spoken?:string;onAction?:()=>void;label?:string;disabled?:boolean;onDismiss?:()=>void;autoSpeak?:boolean}){
 const voice=useCharacterVoice(ONBOARDING_GUIDE_VOICE_ID);
 const speech=(spoken||'').replace(/\[[^\]]+\]/g,'').replace(/\s+/g,' ').trim();
 const say=()=>void voice.speak(spoken||line);
 useEffect(()=>{if(autoSpeak)void voice.speak(spoken||line);else voice.stop();return voice.stop;},[line,spoken,autoSpeak,voice.speak,voice.stop]);
 return <aside className="living-journey-guide" aria-label="Perry’s guide">
  <div className="living-perry-portrait"><PortraitFallback><PerryGuidePortrait/></PortraitFallback></div>
  <div className="living-perry-cue"><strong role="status">{line}</strong>{speech&&speech!==line.trim()&&<p className="living-perry-speech">{speech}</p>}{onDismiss&&<button type="button" className="living-perry-dismiss" aria-label="Keep exploring" onClick={onDismiss}>×</button>}<div><button type="button" className="living-perry-listen" aria-label={voice.status==='retry'?'Try Perry again':'Hear Perry'} aria-busy={voice.status==='loading'} onClick={say}>{voice.status==='retry'?'↻':'!'}</button>{onAction&&<button type="button" className="living-perry-action" disabled={disabled} onClick={onAction}>{label}</button>}</div></div>
 </aside>;
}
