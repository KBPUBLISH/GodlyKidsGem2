import {useEffect,useRef,useState} from 'react';
import {getLanguage} from '../../localization/LocalizedText';

/** Tap-to-talk; recognition never starts on mount and a transcript is reviewed before Send. */
export function useFriendDictation(onText:(text:string)=>void,onStart:()=>void){
 const recognition=useRef<any>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),active=useRef(false);
 const textCallback=useRef(onText);textCallback.current=onText;
 const [listening,setListening]=useState(false),[notice,setNotice]=useState('');
 const Constructor=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
 const stop=()=>{active.current=false;recognition.current?.abort();recognition.current=null;if(timer.current)clearTimeout(timer.current);setListening(false);};
 useEffect(()=>{const hide=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',hide);return()=>{document.removeEventListener('visibilitychange',hide);active.current=false;recognition.current?.abort();if(timer.current)clearTimeout(timer.current);};},[]);
 const start=()=>{
  if(listening){recognition.current?.stop();return;}
  if(!Constructor){setNotice('Use the keyboard microphone, or tap a choice below.');return;}
  onStart();setNotice('');const rec=new Constructor();recognition.current=rec;active.current=true;
  rec.lang=getLanguage()||'en-US';rec.continuous=false;rec.interimResults=false;rec.maxAlternatives=1;
  rec.onresult=(event:any)=>{if(!active.current)return;const words=Array.from(event.results as any[]).map((r:any)=>r[0]?.transcript||'').join(' ').trim().slice(0,500);if(words){textCallback.current(words);setNotice('Ready? Tap Send.');}};
  rec.onerror=(event:any)=>{if(!active.current)return;setNotice(event.error==='not-allowed'?'Microphone is off. Tap a choice or type instead.':event.error==='no-speech'?'Try speaking again, or tap a choice.':'Voice is unavailable here. Try the keyboard microphone.');};
  rec.onend=()=>{if(recognition.current!==rec)return;active.current=false;setListening(false);recognition.current=null;if(timer.current)clearTimeout(timer.current);};
  try{rec.start();setListening(true);timer.current=setTimeout(()=>rec.stop(),20000);}catch{stop();setNotice('Voice is unavailable here. Try the keyboard microphone.');}
 };
 return {listening,notice,start,stop,supported:!!Constructor};
}
