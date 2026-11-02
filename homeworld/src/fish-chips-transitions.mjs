/** A brief result animation, then continue. Cancellation also guards callbacks
 * already queued when the activity is closed or its saved step changes. */
export function scheduleFishTransition({action,progress,onFlip,onClose,onComplete,delay=setTimeout,clear=clearTimeout}){
 let active=true,timer;
 const after=(ms,fn)=>{timer=delay(()=>{if(active)fn();},ms);};
 if(action==='prepare'&&progress===1)after(350,onFlip);
 else if((action==='slice'&&progress>=3)||(action==='prepare'&&progress>=2))after(650,onComplete);
 else if(action==='bake'&&progress>=1)after(350,()=>{onClose();after(500,onComplete);});
 return ()=>{active=false;clear(timer);};
}
