import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleFishTransition} from '../src/fish-chips-transitions.mjs';

function clock(){
 let time=0,sequence=0;const jobs=new Map();
 return {delay(fn,ms){const id=++sequence;jobs.set(id,{fn,at:time+ms});return id;},clear(id){jobs.delete(id);},tick(ms){const end=time+ms;while(true){const next=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;time=next[1].at;jobs.delete(next[0]);next[1].fn();}time=end;}};
}
test('one accepted batter swipe turns the fish and advances without another tap',()=>{
 const c=clock(),events=[];
 scheduleFishTransition({action:'prepare',progress:1,...c,onFlip(){events.push('flip');scheduleFishTransition({action:'prepare',progress:2,...c,onComplete(){events.push('continue');}});}});
 c.tick(349);assert.deepEqual(events,[]);c.tick(1);assert.deepEqual(events,['flip']);
 c.tick(650);assert.deepEqual(events,['flip','continue']);c.tick(5000);assert.equal(events.length,2);
});
test('completed fries continue once; a tray closes the door before starting to bake',()=>{
 for(const action of ['slice','bake']){
  const c=clock(),events=[];
  scheduleFishTransition({action,progress:action==='slice'?3:1,...c,onClose(){events.push('close');},onComplete(){events.push('continue');}});
  c.tick(1000);assert.deepEqual(events,action==='slice'?['continue']:['close','continue']);c.tick(1000);assert.equal(events.at(-1),'continue');
 }
});
test('leaving during a flip, a result pause or a closing oven cannot advance a recipe later',()=>{
 for(const [action,progress,elapsed] of [['prepare',1,0],['slice',3,0],['bake',1,400]]){
  const c=clock(),events=[];
  const cancel=scheduleFishTransition({action,progress,...c,onFlip(){events.push('flip');},onClose(){events.push('close');},onComplete(){events.push('continue');}});
  c.tick(elapsed);cancel();c.tick(5000);assert.deepEqual(events,elapsed?['close']:[]);
 }
});
test('incomplete cutting and an untouched oven never advance on a timer',()=>{
 for(const [action,progress] of [['slice',0],['slice',2],['bake',0],['prepare',0]]){
  const c=clock();let advanced=false;
  scheduleFishTransition({action,progress,...c,onFlip(){advanced=true;},onClose(){advanced=true;},onComplete(){advanced=true;}});
  c.tick(10000);assert.equal(advanced,false);
 }
});
