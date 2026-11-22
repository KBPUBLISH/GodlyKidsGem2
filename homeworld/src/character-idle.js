import {islandBoneName} from './character-model.js';
// Use each model’s calm upper-body clip. Keeping hips and legs
// in each character's own rest pose avoids root drift and sliding idle feet.
export function createRelaxedIdle(animations){
 const source=animations.find(clip=>clip.name==='Idle_9')||animations.find(clip=>/^idle/i.test(clip.name)&&clip.name!=='Idle_03')||animations.find(clip=>clip.name==='Idle_03');
 if(!source)return {duration:1,apply(){}};
 const tracks=source.tracks.filter(track=>track.name.endsWith('.quaternion')&&/(?:mixamorig[:_]?)?(?:Spine\d*|Neck|Head|(?:Left|Right)(?:Shoulder|Arm|ForeArm|Hand\w*))\.quaternion$/.test(track.name)).map(track=>({key:islandBoneName(track.name.slice(0,-'.quaternion'.length)),sample:track.createInterpolant()}));
 if(!tracks.length)return {duration:1,apply(){}};
 return {duration:source.duration,apply(bones,seconds){const time=((seconds%source.duration)+source.duration)%source.duration;for(const {key,sample}of tracks)bones[key]?.quaternion.fromArray(sample.evaluate(time));}};
}
