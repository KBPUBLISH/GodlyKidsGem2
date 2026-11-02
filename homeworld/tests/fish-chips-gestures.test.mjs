import test from 'node:test';
import assert from 'node:assert/strict';
import {cutFry,fryCutX,onCrumbBowl,overFillet,onBakingTray,insideOven,dragCentre} from '../src/fish-chips-gestures.mjs';

test('each fry needs a lengthwise cut through its guide, not a crosswise swipe',()=>{
 for(let i=0;i<3;i++){
  const x=fryCutX(i);
  assert.equal(cutFry({x,y:.2},{x:x+.025,y:.82},i),true);
  assert.equal(cutFry({x,y:.8},{x,y:.2},i),false);
  assert.equal(cutFry({x,y:.45},{x,y:.62},i),false);
  assert.equal(cutFry({x:.1,y:.5},{x:.9,y:.5},i),false);
  assert.equal(cutFry({x:x+.2,y:.2},{x:x+.2,y:.82},i),false);
 }
 assert.equal(cutFry({x:.525,y:.2},{x:.525,y:.82},3),false);
 assert.equal(cutFry(null,{x:.3,y:.8},0),false);
});

test('the crumb bowl has to land on the fillet; dropping on the counter does not coat it',()=>{
 const start={x:.84,y:.8},origin={x:.82,y:.83};
 assert.ok(onCrumbBowl(start));
 assert.equal(onCrumbBowl({x:.48,y:.38}),false);
 assert.ok(overFillet(dragCentre(start,{x:.49,y:.36},origin)));
 assert.equal(overFillet(dragCentre(start,{x:.2,y:.88},origin)),false);
 assert.equal(overFillet(origin),false);
});

test('grabbing the tray off-centre preserves its position and tests the tray centre at the oven',()=>{
 const origin={x:.5,y:.82},start={x:.72,y:.83};
 assert.ok(onBakingTray(start));
 assert.deepEqual(dragCentre(start,start,origin),origin);
 const centre=dragCentre(start,{x:.72,y:.36},origin);
 assert.ok(insideOven(centre));
 assert.equal(insideOven(dragCentre(start,{x:.1,y:.36},origin)),false);
 assert.equal(insideOven({x:.5,y:.6}),false);
 assert.equal(onBakingTray({x:.5,y:.35}),false);
 assert.equal(insideOven(origin),false);
});
