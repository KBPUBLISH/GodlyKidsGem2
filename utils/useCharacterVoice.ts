import {useCallback,useEffect,useRef,useState} from 'react';
import {fetchTtsAudioUrl} from '../services/characterChatService';
/** The same ElevenLabs-backed voice path as crew chat; never substitutes a device voice. */
export function useCharacterVoice(voiceId:string){
 const audio=useRef<HTMLAudioElement|null>(null),sequence=useRef(0),url=useRef<string|null>(null);
 const [status,setStatus]=useState<'idle'|'loading'|'playing'|'retry'>('idle');
 const stop=useCallback(()=>{sequence.current++;audio.current?.pause();audio.current=null;if(url.current)URL.revokeObjectURL(url.current);url.current=null;},[]);
 const speak=useCallback(async(text:string,override?:string)=>{
  stop();const ticket=sequence.current;setStatus('loading');
  const src=await fetchTtsAudioUrl(override||voiceId,text);
  if(ticket!==sequence.current){if(src)URL.revokeObjectURL(src);return;}
  if(!src){setStatus('retry');return;}
  url.current=src;const sound=new Audio(src);audio.current=sound;
  sound.onended=()=>{if(ticket===sequence.current)setStatus('idle');};
  sound.onerror=()=>{if(ticket===sequence.current)setStatus('retry');};
  try{await sound.play();if(ticket===sequence.current)setStatus('playing');}catch{if(ticket===sequence.current)setStatus('retry');}
 },[voiceId,stop]);
 useEffect(()=>stop,[stop]);return {speak,stop,status};
}
