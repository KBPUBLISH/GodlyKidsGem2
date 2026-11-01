import test from 'node:test';
import assert from 'node:assert/strict';
import {dockWalkArea,openDockCells} from '../src/fishing-dock.mjs';

const spot={
  position:[1.25,-4.25,.0814],
  water:[4.3749,-6.8373,-.39],
};

const point=(along,lateral)=>{
  const dx=spot.water[0]-spot.position[0],dy=spot.water[1]-spot.position[1],length=Math.hypot(dx,dy);
  const fx=dx/length,fy=dy/length,rx=-fy,ry=fx;
  return {x:spot.position[0]+fx*along+rx*lateral,y:spot.position[1]+fy*along+ry*lateral};
};

test('dock footprint is walkable from its shore join to its outer edge',()=>{
  assert.equal(dockWalkArea(spot,point(-.2,0)).inside,true);
  assert.equal(dockWalkArea(spot,point(2,.4)).inside,true);
  assert.equal(dockWalkArea(spot,point(4.15,-.4)).inside,true);
});

test('water beside and beyond the dock stays blocked',()=>{
  assert.equal(dockWalkArea(spot,point(2,.7)).inside,false);
  assert.equal(dockWalkArea(spot,point(4.55,0)).inside,false);
});

test('dock cells are opened without making the surrounding water walkable',()=>{
  const points=[point(2,0),point(2,.8),point(4.1,0)];
  const nav={width:3,height:1,blocked:new Uint8Array([1,1,1]),point:(col)=>points[col]};
  openDockCells(nav,spot);
  assert.deepEqual([...nav.blocked],[0,1,0]);
});
