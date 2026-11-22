import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';

test('each shipped icon contains exactly its own source tile, with no neighboring artwork',async()=>{
 const root=new URL('../src/assets/kitchen/',import.meta.url);
 for(const [name,grid,folder,ids] of [
  ['cooking-actions',3,'actions',['potato','fry','batter','fillet','coated','tray','oven','knife','hand']],
  ['kitchen-icons',4,'icons',['fish_chips','pumpkin_stew','garden_omelette','pantry','prep','pot','oven','serve','pumpkin','carrot','egg','fish','potato','chef_hat','spoon','star']],
 ]){
  const source=await readFile(new URL(`${name}.webp`,root)),meta=await sharp(source).metadata();
  for(const [index,id]of ids.entries()){
   const col=index%grid,row=Math.floor(index/grid),left=Math.round(col*meta.width/grid),top=Math.round(row*meta.height/grid);
   const width=Math.round((col+1)*meta.width/grid)-left,height=Math.round((row+1)*meta.height/grid)-top;
   const expected=await sharp(source).extract({left,top,width,height}).ensureAlpha().raw().toBuffer();
   const actual=await sharp(await readFile(new URL(`${folder}/${id}.webp`,root))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   assert.equal(actual.info.width,width,id);assert.equal(actual.info.height,height,id);
   // Fully transparent RGB is undefined during lossless WebP encoding.
   for(let i=0;i<expected.length;i+=4){if(expected[i+3]===0)expected.fill(0,i,i+3);if(actual.data[i+3]===0)actual.data.fill(0,i,i+3);}
   assert.equal(Buffer.compare(actual.data,expected),0,id);
  }
 }
});
