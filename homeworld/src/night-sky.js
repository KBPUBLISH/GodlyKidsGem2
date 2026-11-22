import * as THREE from 'three';
import {terrainType} from './core.mjs';
import {sampleLook,daylightToProgress,lin,RAMP_POSITIONS,HORIZON_FALLOFF,MOON_DIR_BLENDER,MIST_DRIFT,WATER_BASE} from './blender-look.js';

/**
 * Night sky for the island: a gradient sky dome that follows the camera, twinkling stars,
 * a moon, and star/moon glints lying on the water so the sky reads in its reflection.
 * Everything is driven by `daylight` (0..1) from island-clock; by day the dome matches the
 * reference's blue sky: deep blue overhead fading to a pale haze at the horizon.
 */
const DOME_RADIUS=180,STAR_RADIUS=170,MOON_DISTANCE=160;
/**
 * Daytime grade over the Blender look, linear RGB. The .blend's day water is a deep teal and its
 * horizon sky is nearly as pale, so the two read as one wash. By day the sky is pulled down to a
 * medium blue (horizon → mid → overhead) and the water lifted to a light, bright turquoise, so the
 * white clouds and the sea both stand off the sky. Fades out through sunset so the night look is untouched.
 */
// Daytime look: a pale, hazy sky (near white at the horizon, soft blue overhead) with puffy white clouds
// over a deep, saturated blue sea, so the horizon reads as a clear line. Linear RGB.
const DAY_GRADE={sky:[[.64,.8,.97],[.3,.58,.94],[.11,.38,.85]],water:[.012,.17,.62],mist:.3,weight:.9,waterReflect:.22};
const gradeMix=(c,target,w)=>c.lerp(new THREE.Color().setRGB(target[0],target[1],target[2],THREE.LinearSRGBColorSpace),w);
/** Moon direction from the Blender world shader (HW60_MoonDirection), Blender (x,y,z) → three (x,z,-y). */
const MOON_DIR=new THREE.Vector3(MOON_DIR_BLENDER[0],MOON_DIR_BLENDER[2],-MOON_DIR_BLENDER[1]).normalize();
const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const rand=(seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;})(20251027);

// The island camera is orthographic: every view ray is parallel, so a real dome would be one flat colour.
// For that camera the sky direction is faked from the screen position (a ~40° window above the horizon)
// so clouds and the sunset ramp still spread across the sky. Perspective cameras use the true direction.
// uHorizon is the screen (NDC y) height of the sea's far edge, so the sky ramp always starts pale right at the
// waterline and deepens toward the top of the screen, whatever the tilt.
const SKY_VERT=`uniform float uOrtho,uAspect,uHorizon;uniform vec3 uRight,uFwd;varying vec3 vDir;
void main(){vec4 clip=projectionMatrix*modelViewMatrix*vec4(position,1.);vec3 d=position;
if(uOrtho>.5){vec2 n=clip.xy/max(abs(clip.w),1e-4);float t=clamp((n.y-uHorizon)/max(1.-uHorizon,.05),0.,1.);d=uRight*(n.x*uAspect*.8)+uFwd+vec3(0.,t*t*.85+.01,0.);}
vDir=d;gl_Position=clip;}`;
/**
 * Port of WORLD_HW_Daylight (GodlyKidsMap.blend): HW60_DaySunsetNight colour ramp (EASE, stops 0/.42/1) over a
 * horizon falloff of the view ray's height, then the HW_Cloud mist layer (noise on xy/(z+.2), ramp .34→.66,
 * density 1.15, fades in over the first .18 of elevation) mixed in with the timeline's mist opacity/colour.
 * Colours are linear; tone mapping + sRGB happen at the end like every other material.
 */
const SKY_FRAG=`uniform float uTime,uMist,uFalloffLo,uFalloffHi,uRampMid;uniform vec3 uSky0,uSky1,uSky2,uMistCol;uniform vec2 uDrift;varying vec3 vDir;
vec2 hash2(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return -1.+2.*fract(sin(p)*43758.5453);}
float pnoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(dot(hash2(i),f),dot(hash2(i+vec2(1,0)),f-vec2(1,0)),u.x),mix(dot(hash2(i+vec2(0,1)),f-vec2(0,1)),dot(hash2(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5,n=0.;for(int k=0;k<4;k++){v+=a*pnoise(p);n+=a;p=p*2.0+vec2(31.,17.);a*=.5;}return .5+.5*v/n;}
void main(){vec3 dir=normalize(vDir);float z=dir.y;
float fac=clamp((z-uFalloffLo)/(uFalloffHi-uFalloffLo),0.,1.);
vec3 col=fac<uRampMid?mix(uSky0,uSky1,smoothstep(0.,1.,fac/uRampMid)):mix(uSky1,uSky2,smoothstep(0.,1.,(fac-uRampMid)/(1.-uRampMid)));
if(z>0.){vec2 uv=dir.xz/(z+.2)+uDrift*(1.+uTime*.03);
float n=fbm(uv*1.3+.2*fbm(uv*2.6));
float body=clamp(smoothstep(.44,.58,n)*1.4,0.,1.);
float fade=smoothstep(.03,.3,z);
float lit=smoothstep(.5,.8,n);
vec3 cloud=mix(uMistCol*.8,uMistCol*1.2+vec3(.08),lit);
col=mix(col,cloud,body*fade*clamp(uMist*1.9,0.,.96));}
gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;

const STAR_VERT=`attribute float aSize,aPhase,aSpeed,aWarm;uniform float uTime,uNight,uPixelRatio;varying float vAlpha,vWarm;
void main(){float tw=.62+.38*sin(uTime*aSpeed+aPhase);vAlpha=uNight*tw;vWarm=aWarm;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=aSize*uPixelRatio*(.85+.15*tw);gl_Position=projectionMatrix*mv;}`;
const STAR_FRAG=`varying float vAlpha,vWarm;
void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float a=smoothstep(.5,.12,d);vec3 col=mix(vec3(.78,.86,1.),vec3(1.,.9,.72),vWarm);gl_FragColor=vec4(col*a*vAlpha,a*vAlpha);
#include <colorspace_fragment>
}`;

const GLINT_VERT=`attribute float aSize,aPhase,aSpeed,aDriftX,aDriftZ;uniform float uTime,uNight,uPixelRatio,uFogNear,uFogFar;varying float vAlpha;
void main(){vec3 p=position;p.x+=sin(uTime*.45+aDriftX)*.05;p.z+=cos(uTime*.38+aDriftZ)*.05;float tw=.5+.5*sin(uTime*aSpeed+aPhase);tw*=tw;vec4 mv=modelViewMatrix*vec4(p,1.);float fog=1.-smoothstep(uFogNear,uFogFar,-mv.z);vAlpha=uNight*(.2+.8*tw)*fog;gl_PointSize=aSize*uPixelRatio*(.75+.45*tw);gl_Position=projectionMatrix*mv;}`;
const GLINT_FRAG=`uniform vec3 uColor;varying float vAlpha;
void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float a=smoothstep(.5,.18,d);gl_FragColor=vec4(uColor*a*vAlpha,a*vAlpha);
#include <colorspace_fragment>
}`;

function moonTexture(){
  const size=128,c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');
  const glow=ctx.createRadialGradient(size/2,size/2,size*.17,size/2,size/2,size/2);glow.addColorStop(0,'rgba(255,244,214,.55)');glow.addColorStop(.45,'rgba(220,225,255,.16)');glow.addColorStop(1,'rgba(200,210,255,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,size,size);
  const disc=ctx.createRadialGradient(size*.46,size*.45,size*.03,size/2,size/2,size*.19);disc.addColorStop(0,'#fffdf2');disc.addColorStop(.7,'#f6ecc9');disc.addColorStop(1,'rgba(240,228,190,.92)');ctx.fillStyle=disc;ctx.beginPath();ctx.arc(size/2,size/2,size*.19,0,Math.PI*2);ctx.fill();
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}

export class NightSky {
  constructor(game){
    this.game=game;this.scene=game.scene;this.time=rand()*100;
    this.horizon=new THREE.Color();this.fogColor=new THREE.Color();this.sky0=new THREE.Color();this.sky1=new THREE.Color();this.sky2=new THREE.Color();this.mistCol=new THREE.Color();this.waterColor=new THREE.Color();this.sunColor=new THREE.Color();
    this.rig=new THREE.Group();this.rig.name='NightSky';this.rig.matrixAutoUpdate=true;this.scene.add(this.rig);
    this.buildDome();this.buildStars();this.buildMoon();this.findWater();this.buildGlints();this.buildEnvironment();
  }
  buildDome(){
    const geo=new THREE.SphereGeometry(DOME_RADIUS,32,20);
    this.domeMaterial=new THREE.ShaderMaterial({vertexShader:SKY_VERT,fragmentShader:SKY_FRAG,side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false,uniforms:{uOrtho:{value:0},uAspect:{value:1},uHorizon:{value:-.2},uRight:{value:new THREE.Vector3(1,0,0)},uFwd:{value:new THREE.Vector3(0,0,-1)},uTime:{value:0},uMist:{value:.48},uFalloffLo:{value:HORIZON_FALLOFF[0]},uFalloffHi:{value:HORIZON_FALLOFF[1]},uRampMid:{value:RAMP_POSITIONS[1]},uSky0:{value:this.sky0},uSky1:{value:this.sky1},uSky2:{value:this.sky2},uMistCol:{value:this.mistCol},uDrift:{value:new THREE.Vector2(MIST_DRIFT[0],MIST_DRIFT[1])}}});
    this.dome=new THREE.Mesh(geo,this.domeMaterial);this.dome.renderOrder=-1;this.dome.frustumCulled=false;this.rig.add(this.dome);
    const fwd=new THREE.Vector3(),right=new THREE.Vector3();
    this.dome.onBeforeRender=(renderer,scene,camera)=>{const u=this.domeMaterial.uniforms;if(camera.isOrthographicCamera){camera.getWorldDirection(fwd);fwd.y=0;if(fwd.lengthSq()<1e-6)fwd.set(0,0,-1);fwd.normalize();right.crossVectors(fwd,new THREE.Vector3(0,1,0)).normalize();u.uOrtho.value=1;u.uAspect.value=(camera.right-camera.left)/Math.max(1e-4,camera.top-camera.bottom);u.uRight.value.copy(right);u.uFwd.value.copy(fwd);}else u.uOrtho.value=0;};
  }
  /**
   * The Blender water is metallic (.22) and glossy (.2) so it mirrors the sky; glTF can't carry that reflection,
   * so render the sky dome into a small PMREM environment and give it to the water material only. Re-baked as
   * the time of day moves (cheap: a handful of times across dusk).
   */
  buildEnvironment(){
    this.pmrem=new THREE.PMREMGenerator(this.game.renderer);this.envScene=new THREE.Scene();
    this.envDome=new THREE.Mesh(this.dome.geometry,this.domeMaterial);this.envDome.onBeforeRender=()=>{this.domeMaterial.uniforms.uOrtho.value=0;};this.envScene.add(this.envDome);this.envProgress=-1;this.envRT=null;
  }
  refreshEnvironment(p){
    if(!this.waterMaterial||Math.abs(p-this.envProgress)<.012&&this.envRT)return;
    this.envProgress=p;const rt=this.pmrem.fromScene(this.envScene,0,1,400);
    if(this.envRT)this.envRT.dispose();this.envRT=rt;this.waterMaterial.envMap=rt.texture;this.waterMaterial.envMapIntensity=this.waterMaterial.envMapIntensity||.45;this.waterMaterial.needsUpdate=true;
  }
  buildStars(){
    const count=900,bright=25,milky=420,total=count+bright+milky,pos=new Float32Array(total*3),size=new Float32Array(total),phase=new Float32Array(total),speed=new Float32Array(total),warm=new Float32Array(total);
    const dir=new THREE.Vector3(),axis=new THREE.Vector3(.55,.6,-.58).normalize(),u=new THREE.Vector3(),v=new THREE.Vector3();
    u.set(0,1,0).cross(axis).normalize();v.crossVectors(axis,u);
    let i=0;
    const place=(d,s,sp,w)=>{pos[i*3]=d.x*STAR_RADIUS;pos[i*3+1]=d.y*STAR_RADIUS;pos[i*3+2]=d.z*STAR_RADIUS;size[i]=s;phase[i]=rand()*Math.PI*2;speed[i]=sp;warm[i]=w;i++;};
    const upper=()=>{do{dir.set(rand()*2-1,rand(),rand()*2-1).normalize();}while(dir.y<.03);return dir;};
    for(let n=0;n<count;n++)place(upper(),1.8+rand()*1.7,.8+rand()*2.2,rand()<.3?rand()*.8:0);
    for(let n=0;n<bright;n++)place(upper(),3.6+rand()*1.2,.5+rand()*1.2,rand()<.4?.6:0);
    for(let n=0;n<milky;n++){const a=rand()*Math.PI*2,spread=(rand()+rand()+rand()-1.5)*.22;dir.copy(u).multiplyScalar(Math.cos(a)).addScaledVector(v,Math.sin(a)).addScaledVector(axis,spread).normalize();if(dir.y<.04){n--;continue;}place(dir,.9+rand()*1.1,1.2+rand()*2,.2);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('aSize',new THREE.BufferAttribute(size,1));geo.setAttribute('aPhase',new THREE.BufferAttribute(phase,1));geo.setAttribute('aSpeed',new THREE.BufferAttribute(speed,1));geo.setAttribute('aWarm',new THREE.BufferAttribute(warm,1));
    this.starMaterial=new THREE.ShaderMaterial({vertexShader:STAR_VERT,fragmentShader:STAR_FRAG,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,uniforms:{uTime:{value:0},uNight:{value:0},uPixelRatio:{value:this.game.renderer.getPixelRatio()}}});
    this.stars=new THREE.Points(geo,this.starMaterial);this.stars.renderOrder=-1;this.stars.frustumCulled=false;this.stars.visible=false;this.rig.add(this.stars);
  }
  buildMoon(){
    this.moonTexture=moonTexture();
    this.moonMaterial=new THREE.SpriteMaterial({map:this.moonTexture,transparent:true,depthWrite:false,fog:false,toneMapped:false,opacity:0});
    this.moon=new THREE.Sprite(this.moonMaterial);this.moon.scale.setScalar(26);this.moon.position.copy(MOON_DIR).multiplyScalar(MOON_DISTANCE);this.moon.renderOrder=-1;this.moon.visible=false;this.rig.add(this.moon);
  }
  findWater(){
    const isOcean=m=>m&&!Array.isArray(m)&&/Ocean|Water/i.test(m.name||'')&&!/Foam|Shallow|Farm|Barrel/i.test(m.name||'');
    let mesh=(this.game.staticMeshes||[]).find(m=>isOcean(m.material))||null;
    if(!mesh)this.scene.traverse(o=>{if(!mesh&&o.isMesh&&isOcean(o.material))mesh=o;});
    this.water=mesh;this.waterMaterial=mesh?.material||null;
    if(this.waterMaterial){const m=this.waterMaterial;this.waterDay={color:m.color.clone(),roughness:m.roughness,metalness:m.metalness,emissive:m.emissive?m.emissive.clone():null,emissiveIntensity:m.emissiveIntensity,normalScale:m.normalScale?.clone()};m.metalness=WATER_BASE.metallic;this.waterNightEmissive=new THREE.Color('#0d1d3f');}
  }
  buildGlints(){
    const world=this.game.world,level=(world?.waterLevel??-.39)+.02,g=world?.grid;
    const minX=g?g.origin[0]-14:-54,maxX=g?g.origin[0]+g.columns+14:54,minY=g?g.origin[1]-14:-54,maxY=g?g.origin[1]+g.rows+14:66;
    const cx=(minX+maxX)/2,cy=(minY+maxY)/2,mx=MOON_DIR.x,my=-MOON_DIR.z,ml=Math.hypot(mx,my)||1,dx=mx/ml,dy=my/ml;
    const scatter=1100,path=140,total=scatter+path,pos=new Float32Array(total*3),size=new Float32Array(total),phase=new Float32Array(total),speed=new Float32Array(total),driftX=new Float32Array(total),driftZ=new Float32Array(total);
    const isWater=(x,y)=>!world||terrainType(world,x,y)===0;
    const shore=this.shoreDistance(g);
    /** Glints crowd the water near the beach (where the player looks) and thin out toward open sea. */
    const keep=(x,y)=>{if(!isWater(x,y))return false;const dist=shore?shore(x,y):30;return rand()<.12+.88*Math.exp(-dist/6);};
    let i=0;
    const place=(x,y,s,sp)=>{pos[i*3]=x;pos[i*3+1]=level;pos[i*3+2]=-y;size[i]=s;phase[i]=rand()*Math.PI*2;speed[i]=sp;driftX[i]=rand()*Math.PI*2;driftZ[i]=rand()*Math.PI*2;i++;};
    for(let n=0,guard=0;n<scatter&&guard<scatter*80;guard++){const x=minX+rand()*(maxX-minX),y=minY+rand()*(maxY-minY);if(!keep(x,y))continue;place(x,y,2.6+rand()*2.6,1.1+rand()*2.4);n++;}
    for(let n=0,guard=0;n<path&&guard<path*60;guard++){const t=6+rand()*64,w=1.2+t*.07,x=cx+dx*t+(rand()+rand()-1)*w*-dy,y=cy+dy*t+(rand()+rand()-1)*w*dx;if(!isWater(x,y))continue;place(x,y,3+rand()*3,1.6+rand()*2.6);n++;}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('aSize',new THREE.BufferAttribute(size,1));geo.setAttribute('aPhase',new THREE.BufferAttribute(phase,1));geo.setAttribute('aSpeed',new THREE.BufferAttribute(speed,1));geo.setAttribute('aDriftX',new THREE.BufferAttribute(driftX,1));geo.setAttribute('aDriftZ',new THREE.BufferAttribute(driftZ,1));geo.setDrawRange(0,i);
    this.glintMaterial=new THREE.ShaderMaterial({vertexShader:GLINT_VERT,fragmentShader:GLINT_FRAG,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,uniforms:{uTime:{value:0},uNight:{value:0},uPixelRatio:{value:this.game.renderer.getPixelRatio()},uFogNear:{value:40},uFogFar:{value:120},uColor:{value:new THREE.Color('#dfe9ff')}}});
    this.glints=new THREE.Points(geo,this.glintMaterial);this.glints.renderOrder=2;this.glints.frustumCulled=false;this.glints.visible=false;this.scene.add(this.glints);
  }
  /** Distance (in cells) from each water cell to the nearest land cell, via one breadth-first pass over the grid. */
  shoreDistance(g){
    if(!g?.mask)return null;const cols=g.columns,rows=g.rows,n=cols*rows,dist=new Uint8Array(n).fill(255),queue=new Int32Array(n);let head=0,tail=0;
    for(let k=0;k<n;k++)if(g.mask[k]!==0){dist[k]=0;queue[tail++]=k;}
    while(head<tail){const k=queue[head++],d=dist[k]+1,c=k%cols,r=(k-c)/cols;if(d>60)continue;const near=[c>0?k-1:-1,c<cols-1?k+1:-1,r>0?k-cols:-1,r<rows-1?k+cols:-1];for(const m of near)if(m>=0&&dist[m]>d){dist[m]=d;queue[tail++]=m;}}
    return (x,y)=>{const c=Math.floor(x-g.origin[0]),r=Math.floor(y-g.origin[1]);if(c<0||r<0||c>=cols||r>=rows){const ox=c<0?-c:c>=cols?c-cols+1:0,oy=r<0?-r:r>=rows?r-rows+1:0;return 20+Math.hypot(ox,oy);}return dist[r*cols+c];};
  }
  /** daylight 0..1 from islandLight; cameraPosition is the active camera's world position. */
  update(dt,daylight,cameraPosition){
    const d=THREE.MathUtils.clamp(daylight??1,0,1),p=daylightToProgress(d),look=sampleLook(p);this.look=look;this.progress=p;
    const night=THREE.MathUtils.clamp(look.stars,0,1);
    this.time+=dt;
    if(cameraPosition)this.rig.position.copy(cameraPosition);
    lin(look.sky[0],this.sky0);lin(look.sky[1],this.sky1);lin(look.sky[2],this.sky2);lin(look.mistCol,this.mistCol);lin(look.water,this.waterColor);lin(look.sunCol,this.sunColor);
    // Full grade through the day, gone by dusk (daylight .55 is late sunset).
    const grade=THREE.MathUtils.clamp((d-.55)/.4,0,1)*DAY_GRADE.weight;
    if(grade>0){gradeMix(this.sky0,DAY_GRADE.sky[0],grade);gradeMix(this.sky1,DAY_GRADE.sky[1],grade);gradeMix(this.sky2,DAY_GRADE.sky[2],grade);gradeMix(this.waterColor,DAY_GRADE.water,grade);}
    // Thinner cloud cover by day, so blue sky shows between the clouds instead of one white haze.
    const u=this.domeMaterial.uniforms;u.uTime.value=this.time;u.uMist.value=THREE.MathUtils.lerp(look.mist,Math.min(look.mist,DAY_GRADE.mist),grade/DAY_GRADE.weight);
    this.horizon.copy(this.sky0);
    if(this.scene.background?.isColor)this.scene.background.copy(this.horizon);
    // Blender has no fog; keep ours thin and tinted between the sea and the sky so the horizon keeps its contrast.
    if(this.scene.fog)this.scene.fog.color.copy(this.waterColor).lerp(this.sky0,grade>0?.08:.22);
    const pr=this.game.renderer.getPixelRatio();
    this.starMaterial.uniforms.uTime.value=this.time;this.starMaterial.uniforms.uNight.value=night;this.starMaterial.uniforms.uPixelRatio.value=pr;
    const gu=this.glintMaterial.uniforms;gu.uTime.value=this.time;gu.uNight.value=night;gu.uPixelRatio.value=pr;if(this.scene.fog){gu.uFogNear.value=this.scene.fog.near;gu.uFogFar.value=this.scene.fog.far;}
    const moon=THREE.MathUtils.clamp(look.moon,0,1);
    this.stars.visible=night>.002;this.glints.visible=night>.002;this.moon.visible=moon>.002;this.moonMaterial.opacity=moon;
    const m=this.waterMaterial;
    if(m&&this.waterDay){m.color.copy(this.waterColor).multiplyScalar(1.25);m.color.b=Math.min(1,m.color.b*1.1);if(m.envMap)m.envMapIntensity=THREE.MathUtils.lerp(.45,DAY_GRADE.waterReflect,grade/DAY_GRADE.weight);m.roughness=look.wrough+.18;m.metalness=.12+.2*night;if(m.emissive){m.emissive.lerpColors(this.waterDay.emissive,this.waterNightEmissive,night);m.emissiveIntensity=this.waterDay.emissiveIntensity+(1-this.waterDay.emissiveIntensity)*night;}}
    this.refreshEnvironment(p);
  }
  dispose(){
    this.scene.remove(this.rig);this.scene.remove(this.glints);
    this.dome.geometry.dispose();this.domeMaterial.dispose();this.stars.geometry.dispose();this.starMaterial.dispose();this.glints.geometry.dispose();this.glintMaterial.dispose();this.moonMaterial.dispose();this.moonTexture.dispose();
    const m=this.waterMaterial,w=this.waterDay;
    if(m&&w){m.color.copy(w.color);m.roughness=w.roughness;m.metalness=w.metalness;m.envMap=null;if(m.emissive&&w.emissive){m.emissive.copy(w.emissive);m.emissiveIntensity=w.emissiveIntensity;}}
    if(this.envRT)this.envRT.dispose();this.pmrem?.dispose();
  }
}
