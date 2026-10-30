const TAU=Math.PI*2;
export const wrapYaw=yaw=>((yaw+Math.PI)%TAU+TAU)%TAU-Math.PI;
export const PITCH_MIN=-0.42,PITCH_MAX=0.55;
export function cameraOffset(yaw=0,overview=false,pitch=0){
 let [x,y,z]=overview?[0,120,28]:[11,18,18];
 if(!overview){
  const flat=Math.hypot(x,z)||1,len=Math.hypot(flat,y);
  const elev=Math.min(1.25,Math.max(0.28,Math.atan2(y,flat)+pitch));
  const horiz=Math.cos(elev)*len,scale=horiz/flat;
  y=Math.sin(elev)*len;x*=scale;z*=scale;
 }
 const c=Math.cos(yaw),s=Math.sin(yaw);
 return [x*c+z*s,y,z*c-x*s];
}
// Keep the full island in frame as its long side turns across a portrait screen.
export function overviewSpan(yaw,aspect){
 const c=Math.abs(Math.cos(yaw)),s=Math.abs(Math.sin(yaw));
 return Math.max(112,(85*c+112*s)/aspect,112*c+85*s);
}

export class MapGesture {
 constructor(surface,{rotate,tilt,tap,drag,threshold=10}){
  this.surface=surface;this.rotate=rotate;this.tilt=tilt;this.tap=tap;this.drag=drag;this.threshold=threshold;this.down=null;
  this.handlers={pointerdown:e=>this.begin(e),pointermove:e=>this.move(e),pointerup:e=>this.end(e),pointercancel:()=>this.cancel(),lostpointercapture:()=>this.cancel()};
  for(const [type,handler]of Object.entries(this.handlers))surface.addEventListener(type,handler);
 }
 begin(e,tap=null){
  // UI sheets (the friends roster) sit above the canvas. A touch that starts there must
  // scroll that sheet, never orbit the island, even if the event is retargeted here.
  if(e.composedPath?.().some(n=>n.classList?.contains?.('friends-menu')||n.classList?.contains?.('friends-menu-scroll')||n.classList?.contains?.('site-pan')||n.classList?.contains?.('resident-line')))return;
  // A second finger cancels the gesture, so it cannot accidentally become a tap.
  if(e.isPrimary===false){this.cancel();return;}
  if(e.button!==0||this.down)return;
  this.down={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,dragged:false,tap};
  try{this.surface.setPointerCapture(e.pointerId);}catch{/* The pointer may already have been cancelled. */}
 }
 move(e){
  const d=this.down;if(!d||d.id!==e.pointerId)return;
  if(!d.dragged&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<this.threshold)return;
  d.dragged=true;this.surface.dataset.rotating='true';
  const rect=this.surface.getBoundingClientRect(),width=Math.max(1,rect.width),height=Math.max(1,rect.height);
  const dx=e.clientX-d.lastX,dy=e.clientY-d.lastY;
  // No character selected: drag slides the view. A selected character keeps the orbit.
  if(!(this.drag&&this.drag(dx,dy))){
   if(dx)this.rotate(-dx/width*Math.PI);
   if(dy&&this.tilt)this.tilt(-dy/height*Math.PI*0.85);
  }
  d.lastX=e.clientX;d.lastY=e.clientY;
 }
 end(e){
  const d=this.down;if(!d||d.id!==e.pointerId)return;
  this.move(e);const tap=!d.dragged;this.cancel();if(tap)(d.tap||this.tap)(e);
 }
 cancel(){
  const id=this.down?.id;this.down=null;delete this.surface.dataset.rotating;
  if(id!==undefined)try{if(this.surface.hasPointerCapture(id))this.surface.releasePointerCapture(id);}catch{/* Capture can end before pointercancel is delivered. */}
 }
 dispose(){this.cancel();for(const [type,handler]of Object.entries(this.handlers))this.surface.removeEventListener(type,handler);}
}
