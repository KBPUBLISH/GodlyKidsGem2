export const CYCLE_MS=600000,DAYLIGHT_MS=590000,NIGHT_MS=10000,DUSK_MS=60000;
export const MORNING=420,BEDTIME=1320,DAYLIGHT_MINUTES=900,NIGHT_MINUTES=540;
const mod=(n,d)=>((n%d)+d)%d;
export function clockTicks(minutes){const day=Math.floor((minutes-MORNING)/1440),m=mod(minutes-MORNING,1440);return day*CYCLE_MS+(m<DAYLIGHT_MINUTES?m/DAYLIGHT_MINUTES*DAYLIGHT_MS:DAYLIGHT_MS+(m-DAYLIGHT_MINUTES)/NIGHT_MINUTES*NIGHT_MS);}
export function ticksMinutes(ticks){const day=Math.floor((ticks+.000001)/CYCLE_MS),phase=Math.max(0,ticks-day*CYCLE_MS);return day*1440+MORNING+(phase<DAYLIGHT_MS?phase/DAYLIGHT_MS*DAYLIGHT_MINUTES:DAYLIGHT_MINUTES+(phase-DAYLIGHT_MS)/NIGHT_MS*NIGHT_MINUTES);}
export function minutesAt(clock,wall){return clock.paused?clock.minutes:clock.cycle===1?ticksMinutes(clockTicks(clock.minutes)+wall-clock.wall):clock.minutes+Math.max(0,wall-clock.wall)/600000*1440;}
export function dayPhase(clock,wall){
 const ticks=clockTicks(minutesAt(clock,wall)),day=Math.floor((ticks+.000001)/CYCLE_MS),phase=Math.max(0,ticks-day*CYCLE_MS),night=phase>=DAYLIGHT_MS-.000001;
 const boundary=day*CYCLE_MS+(night?CYCLE_MS:DAYLIGHT_MS),remainingMs=Math.max(0,boundary-ticks),dusk=!night&&phase>=DAYLIGHT_MS-DUSK_MS;
 return {day,night,dusk,phase,remainingMs,nightProgress:night?(phase-DAYLIGHT_MS)/NIGHT_MS:0,duskProgress:dusk?(phase-(DAYLIGHT_MS-DUSK_MS))/DUSK_MS:0,morningMinutes:(day+1)*1440+MORNING};
}
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function islandLight(clock,wall){
 if(clock.cycle!==1){const h=mod(minutesAt(clock,wall),1440)/60;return {daylight:Math.max(.10,Math.min(1,Math.sin((h-6)/12*Math.PI))),phase:'legacy'};}
 const p=dayPhase(clock,wall);if(p.night){const dawn=smooth((p.nightProgress-.65)/.35);return {...p,daylight:.12+.88*dawn,phase:'night'};}
 const dusk=smooth((p.duskProgress-.15)/.65);return {...p,daylight:1-.88*dusk,phase:p.dusk?'dusk':'day'};
}
export function durationMilliseconds(clock,from,to){return clock.cycle===1?clockTicks(to)-clockTicks(from):(to-from)/1440*CYCLE_MS;}
