import React,{useEffect,useRef,useState} from 'react';
import {useLocation} from 'react-router-dom';
import {ChevronLeft,ArrowRight,BookOpen,Headphones,Check} from 'lucide-react';
import ParentGateModal from '../features/ParentGateModal';
import {useSubscription} from '../../context/SubscriptionContext';
import {useUser} from '../../context/UserContext';
import {ANNUAL_PRICE_USD,MONTHLY_PRICE_USD,TRIAL_DAYS} from '../../utils/pricing';
import {PREVIEW_ART,WELCOME_ART} from '../../utils/previewAssets.mjs';
import {completeWelcome,saveWelcomeProgress,welcomeProgress} from '../../utils/welcomeProgress';
import './IslandWelcome.css';

const slides=[
 {title:'Build Community',copy:'Read Stories - Grow your World',src:WELCOME_ART.unlock,alt:'A boy and girl look out over their island world as Noah, David and Esther wave from across a bridge.'},
 {title:'Build & Grow',copy:'Build a world with Bible friends.',src:WELCOME_ART.buildGrow,alt:'A girl plants seeds with Eve while a boy builds a wooden hut with Noah.'},
 {title:'Discover',copy:'Audio adventures. Books to explore.',src:WELCOME_ART.discover,alt:'Children enjoy headphones and a storybook with Esther.'},
];
type Props={mode?:'intro'|'offer';onIntroComplete?:()=>void;onComplete:(choice:'trial'|'tour')=>void;onBack:()=>void};
export default function IslandWelcome({onComplete,onBack,onIntroComplete,mode='intro'}:Props){
 const location=useLocation();
 const [step,setStep]=useState(()=>mode==='offer'?3:Math.min(2,welcomeProgress().step));
 const [plan,setPlan]=useState<'annual'|'monthly'>('annual');
 const [gate,setGate]=useState(false),[paying,setPaying]=useState(false),[error,setError]=useState('');
 const busy=useRef(false),heading=useRef<HTMLHeadingElement>(null),swipe=useRef<{x:number;y:number}|null>(null);
 const {purchase,isPremium}=useSubscription();const {subscribe}=useUser();
 const trial=step===3,slide=slides[Math.min(step,2)];
 useEffect(()=>{if(new URLSearchParams(location.search).get('trial')==='cancelled')saveWelcomeProgress({checkoutPending:false});},[location.search]);
 useEffect(()=>{saveWelcomeProgress({step,phase:mode==='offer'?'offer':'intro'});heading.current?.focus({preventScroll:true});const next=slides[step+1]?.src;if(next){const image=new Image();image.src=next;}},[step]);
 const advance=()=>{if(step===2&&mode==='intro')onIntroComplete?.();else setStep(s=>Math.min(3,s+1));};
 const finish=(choice:'trial'|'tour')=>{completeWelcome(choice);onComplete(choice);};
 const buy=async()=>{
  if(busy.current)return;busy.current=true;setPaying(true);setError('');saveWelcomeProgress({checkoutPending:true});
  try{const result=await purchase(plan);if(result.success){subscribe();finish('trial');return;}if(result.error==='REDIRECT_TO_STRIPE')return;saveWelcomeProgress({checkoutPending:false});if(result.error&&result.error!=='Purchase cancelled')setError(result.error);}
  catch{saveWelcomeProgress({checkoutPending:false});setError('Checkout did not open. Try again or continue for now.');}
  finally{busy.current=false;setPaying(false);}
 };
 return <main className={`island-welcome${trial?' is-trial':''}`}>
  <div className="welcome-shell">
   <div className="welcome-top"><button className="welcome-back" aria-label="Back" disabled={paying} onClick={()=>{setError('');mode==='offer'?onBack():step?setStep(step-1):onBack();}}><ChevronLeft/></button><img src={PREVIEW_ART.logo} alt="Godly Kids" width="640" height="366"/></div>
   <header className="welcome-heading"><h1 ref={heading} tabIndex={-1}>{trial?(isPremium?'Your adventure awaits':`Try ${TRIAL_DAYS} Days Free`):slide.title}</h1><p>{trial?(isPremium?'Your membership is ready.':'More stories. More adventures.') :slide.copy}</p></header>
   <figure className={`welcome-art${step===1?' welcome-build-art':''}`} onPointerDown={e=>{swipe.current={x:e.clientX,y:e.clientY};}} onPointerCancel={()=>{swipe.current=null;}} onPointerUp={e=>{const start=swipe.current;swipe.current=null;if(!start||trial)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.3){if(dx<0)advance();else if(step)setStep(step-1);}}}>
    <img src={trial?PREVIEW_ART.splash:slide.src} alt={trial?'Children with their Bible friends on their island.':slide.alt} fetchPriority="high" decoding="async"/>
    {step===2&&<div className="welcome-formats"><span><Headphones size={18}/>Listen</span><span><BookOpen size={18}/>Read</span></div>}
   </figure>
   <div className="welcome-bottom">
    {trial&&!isPremium&&<div className="welcome-plans" role="group" aria-label="Membership plan">
     {(['annual','monthly'] as const).map(p=><button key={p} className={plan===p?'selected':''} aria-pressed={plan===p} disabled={paying} onClick={()=>setPlan(p)}><span>{p==='annual'?'Yearly':'Monthly'}{plan===p&&<Check size={16}/>}</span><strong>${p==='annual'?ANNUAL_PRICE_USD:MONTHLY_PRICE_USD}<small>/{p==='annual'?'year':'month'}</small></strong></button>)}
    </div>}
    <div className="welcome-dots" aria-label={trial?'Trial offer':`Step ${step+1} of 3`}>{(trial?[]:[0,1,2]).map(i=><i key={i} className={i===step?'active':''}/>)}</div>
    {error&&<p className="welcome-error" role="alert">{error}</p>}
    <button className="welcome-primary" disabled={paying} onClick={()=>trial?(isPremium?finish('tour'):setGate(true)):advance()}>{paying?'Opening checkout…':trial&&!isPremium?`Try ${TRIAL_DAYS} Days Free`:'Continue'}<ArrowRight size={23}/></button>
    {trial&&!isPremium&&<><p className="welcome-terms">{TRIAL_DAYS} days free, then ${plan==='annual'?`${ANNUAL_PRICE_USD}/year`:`${MONTHLY_PRICE_USD}/month`}. Renews automatically. Cancel anytime. Trial for eligible families.</p><button className="welcome-skip" disabled={paying} onClick={()=>finish('tour')}>Maybe later</button></>}
   </div>
  </div>
  <ParentGateModal isOpen={gate} onClose={()=>setGate(false)} onSuccess={buy} isPurchasing={paying}/>
 </main>;
}

export function IslandProfileDetails({name,age,onName,onAge,onContinue,onBack}:{name:string;age:string;onName:(v:string)=>void;onAge:(v:string)=>void;onContinue:()=>void;onBack:()=>void}){
 const valid=name.trim().length>0&&/^\d+$/.test(age)&&Number(age)>=1&&Number(age)<=17;
 return <main className="island-profile"><button className="welcome-back" aria-label="Back to Discover" onClick={onBack}><ChevronLeft/></button><div className="profile-shell"><img className="profile-logo" src={PREVIEW_ART.logo} alt="Godly Kids"/><h1>Let’s meet you!</h1><p>Your island starts with you.</p><form onSubmit={e=>{e.preventDefault();if(valid)onContinue();}}><label>Your name<input name="childName" type="text" maxLength={18} value={name} autoComplete="given-name" enterKeyHint="next" required onChange={e=>onName(e.target.value)}/></label><label>Your age<input name="childAge" type="number" inputMode="numeric" min={1} max={17} step={1} value={age} required enterKeyHint="done" onChange={e=>onAge(e.target.value.replace(/[^\d]/g,'').slice(0,2))}/></label><button className="welcome-primary" type="submit" disabled={!valid}>Continue<ArrowRight size={23}/></button></form><p className="profile-family">You can add another child later.</p></div></main>;
}
