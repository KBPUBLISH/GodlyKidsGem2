import React,{useEffect,useRef,useState} from 'react';
import {Mic,Send,Volume2,X,MessageCircle,Hammer} from 'lucide-react';
import type {UnlockedCharacter} from '../../services/rewardsService';
import {fetchCharacterChat,GREETING_QUESTION,stripEmotionTags,type ChatTurn} from '../../services/characterChatService';
import {loadChatHistory,saveChatHistory} from './crewChatMemory';
import {useCharacterVoice} from '../../utils/useCharacterVoice';
import {ADAM_TOUR_FALLBACK_VOICE_ID} from '../../utils/adamTour';
import {friendPersona,friendRole,nearbyGreeting,repairFriendReply,FRIEND_TASKS} from '../../shared/friendConversation.mjs';
import {useFriendDictation} from './useFriendDictation';
import './islandFriendChat.css';

export default function IslandFriendChat({character,userName,world,mode='chat',onClose,onTask,result}:{character:UnlockedCharacter;userName:string;world:Record<string,unknown>;mode?:string;onClose:()=>void;onTask:(task:string)=>void;result?:{ok:boolean;line:string;serial:number}}){
 const [portraitFailed,setPortraitFailed]=useState(false);
 const [tab,setTab]=useState(mode),[turns,setTurns]=useState<ChatTurn[]>(()=>loadChatHistory(character.id).slice(-8)),[draft,setDraft]=useState(''),[thinking,setThinking]=useState(false),[error,setError]=useState(''),[suggestions,setSuggestions]=useState<string[]>([]),[confirm,setConfirm]=useState<string|null>(null),[taskPending,setTaskPending]=useState(false);
 const voice=useCharacterVoice(character.voiceId||(/^adam$/i.test(character.name)?ADAM_TOUR_FALLBACK_VOICE_ID:''));
 const request=useRef<AbortController|null>(null),alive=useRef(true),history=useRef(turns),log=useRef<HTMLDivElement>(null),panel=useRef<HTMLElement>(null),taskTimer=useRef<ReturnType<typeof setTimeout>|null>(null),[bottom,setBottom]=useState(0);
 const dictation=useFriendDictation(text=>setDraft(text),voice.stop);
 const remember=(next:ChatTurn[])=>{history.current=next.slice(-10);setTurns(history.current);saveChatHistory(character.id,history.current);};
 const ask=async(question:string)=>{
  if(request.current)return;dictation.stop();voice.stop();setThinking(true);setError('');setSuggestions([]);
  const before=history.current,opening=question===GREETING_QUESTION;
  if(!opening)remember([...before,{role:'user',text:question}]);
  const controller=new AbortController();request.current=controller;const timeout=setTimeout(()=>controller.abort(),16000);
  try{
   const reply=await fetchCharacterChat({characterName:character.name,persona:friendPersona(character.name,character.persona),storyId:character.sourceStoryId,userName,question,history:before,world,signal:controller.signal});
   if(!alive.current)return;const text=repairFriendReply(question,stripEmotionTags(reply.reply)).slice(0,900);
   remember([...history.current,{role:'character',text}]);setSuggestions(reply.suggestedQuestions.filter(q=>q.length<70).slice(0,3));void voice.speak(text);
  }catch{
   if(!alive.current||controller.signal.reason==='changed')return;
   if(opening){const text=nearbyGreeting(userName,Math.floor(Date.now()/86400000)%4);remember([...history.current,{role:'character',text}]);void voice.speak(text);}
   else setError('Couldn’t connect. Try again in a moment.');
  }finally{clearTimeout(timeout);if(request.current===controller){request.current=null;if(alive.current)setThinking(false);}}
 };
 useEffect(()=>{
  alive.current=true;const old=document.activeElement;panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();if(mode==='chat')void ask(GREETING_QUESTION);
  const resize=()=>{const v=window.visualViewport;setBottom(v?Math.max(0,innerHeight-v.height-v.offsetTop):0);};window.visualViewport?.addEventListener('resize',resize);resize();
  return()=>{alive.current=false;request.current?.abort();if(taskTimer.current)clearTimeout(taskTimer.current);window.visualViewport?.removeEventListener('resize',resize);if(old instanceof HTMLElement)old.focus();};
 },[]);
 useEffect(()=>{log.current?.scrollTo({top:log.current.scrollHeight});},[turns,thinking,tab]);
 useEffect(()=>{if(!result)return;if(taskTimer.current)clearTimeout(taskTimer.current);setTaskPending(false);setConfirm(null);remember([...history.current,{role:'character',text:result.line}]);void voice.speak(result.line);},[result?.serial]);
 const switchTab=(next:string)=>{request.current?.abort('changed');request.current=null;setThinking(false);dictation.stop();voice.stop();setTab(next);setConfirm(null);if(next==='chat'&&!history.current.length)void ask(GREETING_QUESTION);};
 const send=()=>{const text=draft.trim();if(!text||thinking)return;setDraft('');void ask(text);};
 const shown=turns.map((turn,index)=>{if(turn.role!=='character')return turn;const asked=[...turns.slice(0,index)].reverse().find(item=>item.role==='user')?.text;return {...turn,text:repairFriendReply(asked,turn.text)};});
 const last=shown.filter(t=>t.role==='character').at(-1)?.text;
 const key=(event:React.KeyboardEvent)=>{
  if(event.key==='Escape'){event.preventDefault();onClose();}
  if(event.key==='Tab'){const nodes=panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input');if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
 };
 return <div className="island-friend-layer"><section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Chat with ${character.name}`} className="island-friend-chat" style={{bottom:`calc(${bottom}px + max(8px, env(safe-area-inset-bottom)))`}} onKeyDown={key}>
  <header><div className="friend-chat-portrait">{character.imageUrl&&!portraitFailed?<img src={character.imageUrl} alt="" onError={()=>setPortraitFailed(true)}/>:<img src="/homeworld/icons/higgsfield/friends.png?v=2" alt=""/>}</div><div className="friend-chat-name"><strong>{character.name}</strong><small>{friendRole(character.name)} · Bible friend</small></div><button aria-label={`Hear ${character.name} again`} disabled={!last} onClick={()=>last&&void voice.speak(last)}><Volume2 size={21}/></button><button aria-label="Close friend chat" onClick={onClose}><X size={23}/></button></header>
  <nav aria-label="Friend choices"><button aria-pressed={tab==='chat'} onClick={()=>switchTab('chat')}><MessageCircle size={18}/>Chat</button><button aria-pressed={tab==='tasks'} onClick={()=>switchTab('tasks')}><Hammer size={18}/>Help</button></nav>
  {tab==='chat'?<>
   <div className="friend-chat-messages" ref={log} role="log" aria-live="polite">{shown.slice(-8).map((t,i)=><p key={`${i}:${t.text}`} className={`friend-message ${t.role}`}><span className="sr-only">{t.role==='user'?'You':character.name}: </span>{t.text}</p>)}{thinking&&<p className="friend-message character friend-thinking" role="status">{character.name} is thinking <span>•••</span></p>}{error&&<p className="friend-chat-notice" role="status">{error}<button onClick={()=>void ask('Please answer my last message.')}>Try again</button></p>}</div>
   <div className="friend-chat-choices">{(suggestions.length?suggestions:['Ask me about my day','Tell me a Bible story','Let’s pray together']).map(q=><button key={q} disabled={thinking||dictation.listening} onClick={()=>void ask(q)}>{q==='Ask me about my day'?'☀️ My day':q==='Tell me a Bible story'?'📖 Bible story':q==='Let’s pray together'?'🙏 Pray together':q}</button>)}</div>
   <form className="friend-chat-compose" onSubmit={e=>{e.preventDefault();send();}}><button type="button" className={`friend-mic ${dictation.listening?'listening':''}`} aria-label={dictation.listening?'Stop listening':'Talk to your friend'} aria-pressed={dictation.listening} disabled={thinking} onClick={dictation.start}><Mic size={24}/><span>{dictation.listening?'Done':'Talk'}</span></button><input aria-label="Your message" value={draft} maxLength={500} placeholder={dictation.listening?'Listening…':'Say or type something…'} onChange={e=>setDraft(e.target.value)} disabled={thinking}/><button type="submit" aria-label="Send message" disabled={!draft.trim()||thinking||dictation.listening}><Send size={23}/></button></form>
   {(dictation.listening||dictation.notice)&&<p className="friend-chat-notice" role="status">{dictation.listening?'Listening… tap Done when you’re ready.':dictation.notice}</p>}
  </>:<div className="friend-help"><p>{result?.line||'What shall we do together?'}</p>{confirm?<div className="friend-task-confirm"><strong>{FRIEND_TASKS.find(t=>t.id===confirm)?.label||'Take a break'}?</strong><button disabled={taskPending} onClick={()=>{setTaskPending(true);onTask(confirm);taskTimer.current=setTimeout(()=>{if(alive.current){setTaskPending(false);setConfirm(null);setError('Couldn’t start that task. Try again.');}},6000);}}>{taskPending?'One moment…':'Yes, please!'}</button><button disabled={taskPending} onClick={()=>setConfirm(null)}>Not now</button></div>:<div className="friend-task-grid">{FRIEND_TASKS.map(t=><button key={t.id} onClick={()=>setConfirm(t.id)}><span aria-hidden="true">{t.icon}</span>{t.label}</button>)}<button onClick={()=>setConfirm('stop')}><span aria-hidden="true">🌿</span>Take a break</button></div>}{error&&<p role="status">{error}</p>}</div>}
  {tab==='tasks'&&result?.ok&&!confirm&&<button onClick={onClose}>Watch {character.name} →</button>}
  {voice.status==='retry'&&<span className="sr-only" role="status">Voice is unavailable. You can tap the speaker to try again.</span>}
 </section></div>;
}
