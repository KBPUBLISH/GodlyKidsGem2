/** Same-tab progress survives hosted checkout, without granting an entitlement. */
const KEY='godlykids_island_welcome_v1';
type Progress={step:number;phase:'intro'|'details';checkoutPending?:boolean;choice?:'trial'|'tour'};
export function welcomeProgress():Progress {
  try {const p=JSON.parse(sessionStorage.getItem(KEY)||'null');if(p&&(p.phase==='intro'||p.phase==='details'))return {...p,step:Math.min(3,Math.max(0,Number(p.step)||0))};}catch{}
  return {step:0,phase:'intro'};
}
export function saveWelcomeProgress(p:Partial<Progress>) {try{sessionStorage.setItem(KEY,JSON.stringify({...welcomeProgress(),...p}));}catch{}}
export function welcomeCheckoutPending(){return welcomeProgress().checkoutPending===true;}
export function completeWelcome(choice:'trial'|'tour'){saveWelcomeProgress({phase:'details',step:3,checkoutPending:false,choice});}
export function clearWelcomeProgress(){try{sessionStorage.removeItem(KEY);}catch{}}
