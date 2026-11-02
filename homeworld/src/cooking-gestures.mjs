/** Normalised pointer coordinates make the same gestures work on phones and tablets. */
export function stirDelta(previous,current){
 const radius=Math.hypot(current.x-.5,current.y-.5);if(radius<.12||radius>.52||!previous)return 0;
 const before=Math.hypot(previous.x-.5,previous.y-.5);if(before<.12||before>.52)return 0;
 let d=Math.atan2(current.y-.5,current.x-.5)-Math.atan2(previous.y-.5,previous.x-.5);
 if(d>Math.PI)d-=2*Math.PI;if(d< -Math.PI)d+=2*Math.PI;
 return Math.abs(d)>.6?0:d; // Reject jumps and retain direction so jitter doesn't count as circles.
}
export const sliced=(start,end)=>!!start&&Math.hypot(end.x-start.x,end.y-start.y)>=.23;
export const dropped=(start,end)=>!!start&&start.y>.55&&end.y<.46&&end.x>.2&&end.x<.8;

/** A generous downward cut through the food, rather than any swipe on the screen. */
export function chopCrossed(start,end,index=0){
 if(!start||!end||end.y-start.y<.16||start.y>.6||end.y<.5)return false;
 const t=(.55-start.y)/(end.y-start.y),x=start.x+(end.x-start.x)*Math.max(0,Math.min(1,t));
 return Math.abs(x-(.32+index*.18))<=.17;
}
