import React from 'react';
/** Small, local illustrations also used in the bag and meal picker. */
export function CookingArt({id,size=96}){
 const potato=id==='potato'||id==='potato_seed',stew=id==='pumpkin_stew',egg=id==='garden_omelette';
 return <svg width={size} height={size} viewBox="0 0 120 100" aria-hidden="true" className="cooking-art">
  <ellipse cx="60" cy="87" rx="45" ry="8" fill="#392415" opacity=".17"/>
  {potato?<><path d="M26 39C19 10 63 5 79 23C111 31 103 69 77 79C46 95 9 70 26 39Z" fill="#d5ac6d" stroke="#9e713f" strokeWidth="3"/><path d="M34 36Q46 17 65 24" fill="none" stroke="#f6dc9f" strokeWidth="8" strokeLinecap="round"/>{[[37,51],[58,67],[82,42],[76,61]].map(([x,y])=><ellipse key={x} cx={x} cy={y} rx="3" ry="2" fill="#92643a"/>)}</>:<>
  <ellipse cx="60" cy="71" rx="51" ry="20" fill="#bbd7c4" stroke="#577c68" strokeWidth="3"/><ellipse cx="60" cy="68" rx="43" ry="14" fill="#fff2d5"/>
  {stew?<><path d="M21 46H99L90 74Q61 97 30 74Z" fill="#d68448" stroke="#8f4d2e" strokeWidth="3"/><ellipse cx="60" cy="47" rx="39" ry="18" fill="#ffa941" stroke="#f7d19b" strokeWidth="5"/>{[[40,43],[62,51],[77,39],[53,35]].map(([x,y])=><rect key={x} x={x} y={y} width="10" height="8" rx="2" fill="#ed782b" transform={`rotate(20 ${x} ${y})`}/>)}<path d="M36 47q16-11 35 1" fill="none" stroke="#ffdd87" strokeWidth="4"/><path d="M45 18q-8-6 0-12M66 20q-9-8 0-16" fill="none" stroke="#fff5df" strokeWidth="4" strokeLinecap="round"/></>:egg?<><path d="M24 60Q39 23 83 43Q103 53 94 68Q54 91 24 60Z" fill="#eeb13b" stroke="#bf7f2c" strokeWidth="3"/><path d="M26 57Q55 31 93 60Q60 75 26 57" fill="#ffdc68"/>{[[42,53],[64,47],[78,58],[55,63]].map(([x,y])=><circle key={x} cx={x} cy={y} r="4" fill="#e87e3f"/>)}</>:<><g fill="#f5c35d" stroke="#d99a3b" strokeWidth="2">{[0,1,2,3,4].map(i=><rect key={i} x={68+i*4} y={32+i*5} width="8" height="35" rx="3" transform={`rotate(${i*12-35} 84 58)`}/>)}</g><path d="M23 55Q43 29 74 48Q73 69 44 73L23 64L15 74V47Z" fill="#ce823d" stroke="#94552e" strokeWidth="3"/><path d="M34 53l8 11m4-16 8 11m4-16 8 11" stroke="#f7c478" strokeWidth="4" strokeLinecap="round"/></>}
  <path d="M60 52q1-14 13-15q-2 13-13 15m0 0q-13-2-12-12q12 1 12 12" fill="#548e45"/></>}
 </svg>;
}
