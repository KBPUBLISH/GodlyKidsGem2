import React, { useEffect, useState, useSyncExternalStore } from 'react';
const key = 'godlykids_app_language';
const subscribe = (fn:()=>void) => {window.addEventListener('storage',fn);window.addEventListener('gk:language',fn);return ()=>{window.removeEventListener('storage',fn);window.removeEventListener('gk:language',fn);};};
export const getLanguage = () => localStorage.getItem(key)||'en';
// Short role labels need human context: Google can interpret 'Parent' as a plant or ancestor.
const roleLabels: Record<string,Record<string,string>> = {
  Parent: {tl:'Magulang',pt:'Responsável',fr:'Parent',de:'Elternteil',it:'Genitore',ko:'부모 또는 보호자',es:'Madre, padre o tutor',pl:'Rodzic'},
  Kid: {tl:'Bata',pt:'Criança',fr:'Enfant',de:'Kind',it:'Bambino',ko:'어린이',es:'Niño',pl:'Dziecko'},
};
const cache = new Map<string,string>();
const pending = new Map<string,Promise<string>>();
let queue: {text:string,lang:string,resolve:(text:string)=>void}[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
function endpoint() {
  const base = ((import.meta as ImportMeta & {env:Record<string,string>}).env.VITE_API_BASE_URL || 'http://localhost:5001/api').replace(/\/$/,'');
  return `${base.endsWith('/api')?base:base+'/api'}/translate/texts`;
}
async function flush() {
  const batch=queue.splice(0,24);timer=undefined;
  if(queue.length) timer=setTimeout(flush,60);
  for(const lang of new Set(batch.map(x=>x.lang))) {
    const items=batch.filter(x=>x.lang===lang);
    try {
      const response=await fetch(`${endpoint()}?lang=${encodeURIComponent(lang)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texts:items.map(x=>x.text)}),signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw Error('Translation unavailable');
      const data=await response.json();
      if(!Array.isArray(data.translations)||data.translations.length!==items.length)throw Error('Invalid translation');
      items.forEach((item,i)=>{const translated=data.translations[i];if(typeof translated!=='string'||translated.startsWith(`[${lang.toUpperCase()}]`))throw Error('Invalid translation');});
      items.forEach((item,i)=>{const id=lang+'\0'+item.text;if(cache.size>=2500)cache.delete(cache.keys().next().value!);cache.set(id,data.translations[i]);pending.delete(id);item.resolve(data.translations[i]);});
    } catch {
      items.forEach(item=>{pending.delete(lang+'\0'+item.text);item.resolve(item.text);});
      window.dispatchEvent(new Event('gk:translation-unavailable'));
    }
  }
}
export function translate(text:string,lang:string = getLanguage(), template = false): Promise<string> {
  if(lang === 'en' || !text.trim()) return Promise.resolve(text);
  // Reuse timer/count translations instead of making a new request every game tick.
  if(!template && /\d/.test(text)) {
    const numbers:string[]=[];
    const pattern=text.replace(/\d+(?:[.:]\d+)*/g, n => `{${numbers.push(n)-1}}`);
    return translate(pattern,lang,true).then(value => numbers.every((_,i)=>value.includes(`{${i}}`)) ? value.replace(/\{(\d+)\}/g,(token,i)=>numbers[Number(i)]??token) : text);
  }
  const id=lang+'\0'+text;
  if(roleLabels[text]?.[lang])return Promise.resolve(roleLabels[text][lang]);
  if(cache.has(id))return Promise.resolve(cache.get(id)!);
  if(pending.has(id))return pending.get(id)!;
  const promise=new Promise<string>(resolve=>{queue.push({text,lang,resolve});if(!timer)timer=setTimeout(flush,40);});
  pending.set(id,promise);return promise;
}
/** Text-only boundary: never changes element identity, event handlers or game data. */
function LocalizedText({value}:{value:React.ReactNode}) {
  const lang=useSyncExternalStore(subscribe,getLanguage,()=> 'en');
  const source=typeof value==='string'?value:'';
  const [result,setResult]=useState({source:'',lang:'',text:''});
  useEffect(()=>{let active=true;if(lang!=='en'&&source.trim()&&/[A-Za-z]/.test(source))translate(source,lang).then(text=>{if(active)setResult({source,lang,text});});return()=>{active=false;};},[source,lang]);
  return <>{lang!=='en'&&result.source===source&&result.lang===lang?result.text:value}</>;
}

export default React.memo(LocalizedText);

/** Keep labels available to assistive technology in the same language as visible text. */
export const LocalizedElement = React.forwardRef<HTMLElement, any>(function LocalizedElement({as: Tag, ...props}, ref) {
  const lang = useSyncExternalStore(subscribe, getLanguage, () => 'en');
  const keys = ['aria-label', 'title', 'placeholder', 'alt'];
  const source = JSON.stringify(keys.map(key => typeof props[key] === 'string' ? props[key] : ''));
  const [result, setResult] = useState({source:'',lang:'',values:[] as string[]});
  useEffect(() => { let active = true;
    if(lang !== 'en') Promise.all(JSON.parse(source).map((text:string) => translate(text,lang))).then(values => {if(active)setResult({source,lang,values});});
    return () => { active = false; };
  }, [source,lang]);
  const translated = {...props,ref};
  if(result.source === source && result.lang === lang && lang !== 'en') keys.forEach((key,i) => {if(typeof props[key] === 'string')translated[key] = result.values[i];});
  return React.createElement(Tag, translated);
});

export function useLocalizedString(source:string) {
  const lang=useSyncExternalStore(subscribe,getLanguage,()=> 'en');
  const [value,setValue]=useState({source:'',lang:'',text:''});
  useEffect(()=>{let active=true;translate(source,lang).then(text=>{if(active)setValue({source,lang,text});});return()=>{active=false;};},[source,lang]);
  return lang==='en'?source:value.source===source&&value.lang===lang?value.text:'';
}
