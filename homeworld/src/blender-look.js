import * as THREE from 'three';
import LOOK from './blender-look.json';

/**
 * Time-of-day look sampled straight out of GodlyKidsMap.blend (see blender-look.json, written by
 * Blender from the HW60 timeline: WORLD_HW_Daylight sky ramp, mist, stars, moon, MAT_HW_Water colour,
 * key-sun colour/energy). Frame 1 is full day, ~720 sunset, ~840 dusk, 1200+ deep night.
 * All colours are linear scene-referred, exactly as Blender stores them.
 */
const FRAMES=LOOK.frames,FIRST=FRAMES[0].f,LAST=FRAMES[FRAMES.length-1].f;
const NUMERIC=['mist','stars','moon','bg','wrough','sunE','moonE','fillE'],VEC=['mistCol','water','sunCol'];

const lerp=(a,b,t)=>a+(b-a)*t;
const lerpArr=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],t));

/** daylight (0.12..1 from island-clock) → Blender timeline progress 0 (day) .. 1 (night). */
export function daylightToProgress(daylight){return THREE.MathUtils.clamp((1-daylight)/.88,0,1);}

/** Interpolated look at progress p (0..1). Returns plain arrays; use `lin()` to pour them into THREE.Colors. */
export function sampleLook(p){
  const x=FIRST+THREE.MathUtils.clamp(p,0,1)*(LAST-FIRST);
  let i=0;while(i<FRAMES.length-2&&FRAMES[i+1].f<=x)i++;
  const a=FRAMES[i],b=FRAMES[i+1],t=THREE.MathUtils.clamp((x-a.f)/(b.f-a.f),0,1),out={f:x,sky:a.sky.map((c,k)=>lerpArr(c,b.sky[k],t))};
  for(const k of NUMERIC)out[k]=lerp(a[k],b[k],t);
  for(const k of VEC)out[k]=lerpArr(a[k],b[k],t);
  return out;
}

/** Write a linear RGB triple into a THREE.Color (keeps Blender's scene-referred values intact). */
export const lin=(arr,target=new THREE.Color())=>target.setRGB(arr[0],arr[1],arr[2],THREE.LinearSRGBColorSpace);

export const RAMP_POSITIONS=LOOK.rampPositions,HORIZON_FALLOFF=LOOK.horizonFalloff,MOON_DIR_BLENDER=LOOK.moonDir,MIST_DRIFT=LOOK.mistDrift,CLOUD=LOOK.cloud,WATER_RIPPLE=LOOK.waterRipple,WATER_BASE=LOOK.waterBase;
/** Planar frame (Blender world metres, x0,x1,y0,y1) the terrain/shore albedo textures were baked in. */
export const BAKE_FRAME=[-80,72,-69,101];
