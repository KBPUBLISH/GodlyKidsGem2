import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';

// Convert the generated background and transparent UI atlas into small runtime assets.
// Usage: node scripts/build-avatar-harbor-assets.mjs background.png ui-atlas.png
const [background,atlas]=process.argv.slice(2);
if(!background||!atlas)throw Error('Supply the generated harbor background and transparent UI atlas.');
const out='public/assets/images/avatar-harbor';await mkdir(out,{recursive:true});
await sharp(background).resize({width:768,withoutEnlargement:true}).webp({quality:79,effort:6}).toFile(`${out}/harbor-phone-v1.webp`);
await sharp(background).resize({width:1280,withoutEnlargement:true}).webp({quality:82,effort:6}).toFile(`${out}/harbor-tablet-v1.webp`);

// Separate the five opaque islands of the atlas. Their bounding boxes overlap slightly,
// so a rectangular crop alone would include a fragment of the adjacent asset.
const {data,info:{width:w,height:h}}=await sharp(atlas).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const labels=new Int32Array(w*h),queue=new Int32Array(w*h),parts=[];let id=0;
for(let start=0;start<labels.length;start++){
 if(labels[start]||data[start*4+3]<128)continue;
 const part={id:++id,count:0,left:w,top:h,right:0,bottom:0};let head=0,tail=0;queue[tail++]=start;labels[start]=id;
 while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);part.count++;part.left=Math.min(part.left,x);part.right=Math.max(part.right,x);part.top=Math.min(part.top,y);part.bottom=Math.max(part.bottom,y);
  for(const q of [x?p-1:-1,x<w-1?p+1:-1,y?p-w:-1,y<h-1?p+w:-1])if(q>=0&&!labels[q]&&data[q*4+3]>=128){labels[q]=id;queue[tail++]=q;}
 }
 if(part.count>10000)parts.push(part);
}
parts.sort((a,b)=>a.top-b.top);
if(parts.length!==5)throw Error(`Expected five separate UI assets; found ${parts.length}.`);
const names=['logo','heading','caption','confirm','arrow'],widths=[640,1000,800,900,144];
for(const [i,part] of parts.entries()){
 const left=Math.max(0,part.left-4),top=Math.max(0,part.top-4),width=Math.min(w-1,part.right+4)-left+1,height=Math.min(h-1,part.bottom+4)-top+1;
 const pixels=Buffer.alloc(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const src=(top+y)*w+left+x;let belongs=labels[src]===part.id;
  if(!belongs&&data[src*4+3]<128)for(let dy=-3;dy<=3&&!belongs;dy++)for(let dx=-3;dx<=3;dx++){const nx=left+x+dx,ny=top+y+dy;if(nx>=0&&nx<w&&ny>=0&&ny<h&&labels[ny*w+nx]===part.id){belongs=true;break;}}
  if(belongs)data.copy(pixels,(y*width+x)*4,src*4,src*4+4);
 }
 await sharp(pixels,{raw:{width,height,channels:4}}).resize({width:widths[i],withoutEnlargement:true}).webp({quality:87,alphaQuality:100,effort:6}).toFile(`${out}/${names[i]}-v1.webp`);
 console.log(names[i],{width,height});
}
