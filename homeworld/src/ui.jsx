import React,{useEffect,useRef,useState} from 'react';
import {DISH_ICONS,RecipeIcon} from './recipe-icons.jsx';

export const TOOLS=[
  {id:'axe',name:'Chop',color:'#ad6236',soft:'#fff0d7'},
  {id:'mine',name:'Smash',color:'#7560b2',soft:'#eee7ff'},
  {id:'hoe',name:'Dig',color:'#ac643a',soft:'#ffeadb'},
  {id:'plant',name:'Plant',color:'#418446',soft:'#e4f6d9'},
  {id:'water',name:'Water',color:'#267fbb',soft:'#def5ff'},
  {id:'fish',name:'Fish',color:'#237f8b',soft:'#dbf7f1'},
  {id:'food',name:'Eat',color:'#b75b42',soft:'#fff0e7'},
];

const ICONS=new Set(['walk','axe','mine','hoe','plant','water','fish','food','build','book','bag','map','zoom','sun','energy','wood','stone','copper','iron','diamond','carrot','pumpkin','bread','rawfish','cookedfish','wheat','sunflower','pine_seed','oak_acorn','maple_seed','apple_seed','coconut','moon','harvest','rest','water_drop','actions','shovel','mud','clay','manna','oven','pray']);
const ITEM_ICONS={fish:'rawfish',cooked_fish:'cookedfish',water:'water_drop',copper_ore:'copper',iron_ore:'iron',carrot_seed:'carrot',wheat_seed:'wheat',sunflower_seed:'sunflower',pumpkin_seed:'pumpkin',maple_samara:'maple_seed',pine:'pine_seed',oak:'oak_acorn',maple:'maple_seed',apple:'apple_seed',coconut_palm:'coconut',concrete_brick:'stone',wheat:'wheat',clay:'clay',garden_salad:'carrot',seed_crackers:'wheat',nut_butter_greens:'sunflower',roasted_seeds:'sunflower',veggie_stew:'pumpkin',pumpkin_coconut:'coconut',apple_nut:'apple_seed',carrot_bites:'carrot',oak_acorn:'oak_acorn',coconut:'coconut',pine_seed:'pine_seed',sunflower:'sunflower'};

// Generated once through Higgsfield, packaged locally so play never needs an art service.
export function Icon({type,size=44,className=''}){
  const id=ICONS.has(type)?type:'bag';
  const [failed,setFailed]=useState(null);
  if(failed===id)return <span className={`icon-fallback ${className}`} style={{width:size,height:size}} data-icon-fallback={id}><FallbackIcon type={id}/></span>;
  return <img className={`picture-icon higgsfield-icon ${className}`} src={`/icons/higgsfield/${id}.png`} width={size} height={size} alt="" aria-hidden="true" draggable={false} decoding="async" data-game-icon={id} data-icon-source="higgsfield" onError={()=>setFailed(id)}/>;
}
export function ItemIcon({id,...props}){
  if(DISH_ICONS.has(id))return <RecipeIcon id={id} {...props}/>;
  return <Icon type={ITEM_ICONS[id]||(id?.endsWith('_wood')?'wood':id)} {...props}/>;
}

function FallbackIcon({type}){
  const art={
    build:<><path stroke="#9b663b" strokeWidth="8" d="m10 36 18-23"/><path stroke="#d9a668" strokeWidth="3" d="m10 35 17-22"/><path fill="#9aafba" stroke="#566d7c" strokeWidth="2" d="m20 8 8-5 12 10-7 8-13-9Z"/><path fill="#d4e2e7" d="m33 8 7 5-7 8-5-4Z"/></>,
    walk:<><path fill="#4b9acb" d="M10 7c-5 0-7 6-5 11l5 10c2 4 8 2 7-2l-3-14c0-3-1-5-4-5Z"/><ellipse fill="#275e8d" cx="9" cy="34" rx="6" ry="4"/><path fill="#72bdd7" d="M31 4c5 0 7 6 5 11l-5 10c-2 4-8 2-7-2l3-14c0-3 1-5 4-5Z"/><ellipse fill="#275e8d" cx="31" cy="31" rx="6" ry="4"/></>,
    axe:<><path stroke="#784727" strokeWidth="7" d="m10 36 18-28"/><path stroke="#c88e50" strokeWidth="3" d="m10 35 17-27"/><path fill="#8cb9b5" stroke="#426965" strokeWidth="2" d="m23 8 11-3 6 10-9 7-11-9Z"/><path fill="#d5e9db" d="m34 6 6 9-4 4-6-11Z"/></>,
    mine:<><path stroke="#815032" strokeWidth="7" d="m11 37 15-27"/><path stroke="#ce9556" strokeWidth="3" d="m11 36 15-27"/><path fill="#91b4c7" stroke="#4f657e" strokeWidth="2" d="M4 16Q21-2 40 13L26 10l-7 8-15-2Z"/><path fill="#e7f5f2" d="m7 14 13-6 8 1-13 5Z"/><path fill="#bda0ec" d="m31 27 7 1 3 7-8 5-6-6Z"/></>,
    hoe:<><ellipse fill="#b68152" cx="22" cy="36" rx="20" ry="5"/><path stroke="#815032" strokeWidth="6" d="m12 34 16-27"/><path stroke="#d6a467" strokeWidth="2" d="m12 34 16-27"/><path fill="#a2c4c4" stroke="#4f7374" strokeWidth="2" d="m18 7 18 4 3-7-17-3Z"/><path stroke="#e3b779" strokeWidth="2" d="m5 35 4-2m13 5 5-2m6-1 3-2"/></>,
    plant:<><ellipse fill="#ad764b" cx="22" cy="36" rx="18" ry="5"/><path stroke="#3b8249" strokeWidth="4" d="M22 36V17"/><path fill="#75b94c" stroke="#3b8249" strokeWidth="1.5" d="M22 26C8 28 4 17 7 12c12-1 15 9 15 14Z"/><path fill="#9bd261" stroke="#3b8249" strokeWidth="1.5" d="M22 19C22 6 32 2 38 5c1 12-10 15-16 14Z"/><path stroke="#d6ef9a" strokeWidth="2" d="m25 15 8-7M18 23l-7-6"/></>,
    water:<><path fill="#5fb9db" stroke="#28799e" strokeWidth="2" d="M11 17h19v19H11z"/><path fill="none" stroke="#28799e" strokeWidth="4" d="M11 21H6a5 5 0 0 0 0 10h5M15 17v-6h11v6"/><path fill="#86d4e8" stroke="#28799e" strokeWidth="2" d="m30 22 9-8 3 5-12 12Z"/><path stroke="#66bcdf" strokeWidth="2" d="m40 24 1 3m-4-1 1 4m-4-2 1 4"/><path fill="#c6eef6" d="M15 21h10v3H15z"/></>,
    fish:<><path fill="none" stroke="#9a6337" strokeWidth="3" d="M7 37 18 6l17 5"/><path fill="none" stroke="#657f8b" strokeWidth="1.5" d="M35 11v15q0 7-6 4"/><path fill="#5eb8cf" stroke="#267f8b" strokeWidth="1.5" d="M17 30q10-12 18 0-8 12-18 0l-6 5V25Z"/><circle fill="#fff8de" cx="30" cy="29" r="2.5"/><circle fill="#294b51" cx="30.5" cy="29" r="1"/><path stroke="#e3ba6e" strokeWidth="4" d="m6 38 4-10"/></>,
    food:<><path fill="#75b24d" d="m17 10 1-8 6 5 7-4-1 9Z"/><path fill="#ee8d39" stroke="#b5632a" strokeWidth="1.7" d="M15 10c8-3 18 3 14 11L12 39c-2 1-4-1-3-3l6-26Z"/><path stroke="#ffc366" strokeWidth="2" d="m14 19 6 2m-7 5 4 1"/><path fill="#ed705f" d="M33 28c-6-8-13 2 0 10 13-8 6-18 0-10Z"/></>,
    book:<><rect fill="#e8bc68" stroke="#9a713b" strokeWidth="2" x="7" y="4" width="29" height="35" rx="5"/><path fill="#fff2cc" d="M13 9h18v25H13z"/><path stroke="#4e8b4f" strokeWidth="2.5" d="M23 31V20"/><path fill="#79b84e" d="M23 25c-10 0-11-9-11-9 11-1 11 9 11 9Zm0-5c0-10 10-10 10-10 0 10-10 10-10 10Z"/><path stroke="#b28041" strokeWidth="3" d="M11 5v33"/></>,
    bag:<><path fill="none" stroke="#96683c" strokeWidth="4" d="M15 13V9a7 7 0 0 1 14 0v4"/><rect fill="#dba45a" stroke="#96683c" strokeWidth="2" x="7" y="11" width="30" height="29" rx="8"/><path fill="#edc77a" stroke="#96683c" strokeWidth="2" d="M7 15h30v9c-9 6-21 6-30 0Z"/><rect fill="#fff3c4" stroke="#96683c" x="19" y="21" width="7" height="8" rx="2"/></>,
    map:<><path fill="#d9edbc" stroke="#6c9255" strokeWidth="2" d="m3 9 12-5 14 5 12-5v30l-12 5-14-5-12 5Z"/><path fill="#8ecadd" d="m21 8 6 1-6 27-6-2Z"/><path fill="none" stroke="#edb25d" strokeWidth="3" strokeDasharray="3 4" d="m9 28 3-13 17 10 6-13"/><path fill="#ed8260" stroke="#ba5b3d" d="M30 11a5 5 0 1 1 10 0c0 4-5 8-5 8s-5-4-5-8Z"/><circle fill="#fff4d5" cx="35" cy="11" r="2"/></>,
    zoom:<><circle fill="#bfe7ed" stroke="#467a8b" strokeWidth="3" cx="18" cy="18" r="12"/><path stroke="#9a6e43" strokeWidth="8" d="m28 28 10 10"/><path stroke="#5b8c98" strokeWidth="3" d="M12 18h12m-6-6v12"/><path stroke="#fff" strokeWidth="2" d="m10 15 3-5"/></>,
    sun:<><g stroke="#d99231" strokeWidth="3"><path d="M22 2v5m0 30v5M2 22h5m30 0h5M7 7l4 4m22 22 4 4M7 37l4-4M33 11l4-4"/></g><circle fill="#ffd168" stroke="#d99231" strokeWidth="2" cx="22" cy="22" r="11"/></>,
    actions:<><circle fill="#f3e6c4" stroke="#c9b48a" strokeWidth="3" cx="20" cy="22" r="14"/><path fill="none" stroke="#6eae4a" strokeWidth="5" d="m12 22 6 6 12-13"/><path fill="#f08a2a" d="m34 6 2 5 5 1-4 3 1 5-4-3-5 1 2-5-4-3 5 1Z"/></>,
  };
  return <svg className="picture-icon" viewBox="0 0 44 44" width="44" height="44" aria-hidden="true" focusable="false" strokeLinecap="round" strokeLinejoin="round">{art[type]||art.plant}</svg>;
}

export function ActionButton({icon,children,secondary=false,...props}){
  return <button className={`action-button ${secondary?'secondary':''}`} {...props}>{icon&&<Icon type={icon}/>}<span>{children}</span></button>;
}

export function useDialogFocus(open,ref,onClose){
  const close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    if(!open||!ref.current)return;
    const opener=document.activeElement,dialog=ref.current;
    const focusable=()=>[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),summary,[tabindex="0"]')].filter(e=>e.getClientRects().length);
    (dialog.querySelector('[data-dialog-close]')||dialog).focus();
    const key=e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close.current();}
      if(e.key==='Tab'){
        const items=focusable(),first=items[0],last=items.at(-1);
        if(!first){e.preventDefault();dialog.focus();return;}
        if(e.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){e.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',key,true);
    return()=>{document.removeEventListener('keydown',key,true);if(opener?.isConnected)opener.focus();};
  },[open,ref]);
}
