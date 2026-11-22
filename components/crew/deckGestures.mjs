export const DECK_IDLE_GESTURES=['look','nod','stretch'];
export const DECK_WAVE_MS=1800;
/** Small additive bone rotations, with a soft start/end and no root translation. */
export function deckGesture(kind,progress){
 const p=Math.max(0,Math.min(1,progress)),ease=Math.sin(Math.PI*p)**2;
 if(kind==='wave')return {mixamorigRightArm:[-.35*ease,0,-1.55*ease],mixamorigRightForeArm:[-.35*ease,.2*Math.sin(p*Math.PI*8)*ease,-.65*ease],mixamorigRightHand:[0,.3*Math.sin(p*Math.PI*8)*ease,0],mixamorigHead:[0,.06*ease,.06*ease]};
 if(kind==='look')return {mixamorigHead:[0,Math.sin(p*Math.PI*2)*.32*ease,0]};
 if(kind==='nod')return {mixamorigHead:[Math.sin(p*Math.PI*4)*.12*ease,0,0]};
 if(kind==='stretch')return {mixamorigSpine:[-.07*ease,0,.05*ease],mixamorigLeftArm:[-.15*ease,0,.32*ease],mixamorigRightArm:[-.15*ease,0,-.32*ease]};
 return {};
}
