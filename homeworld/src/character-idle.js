// Use the relaxed upper-body motion supplied with Eve. Keeping hips and legs
// in each character's own rest pose avoids root drift and sliding idle feet.
export function createRelaxedIdle(animations){
 const source=animations.find(clip=>clip.name==='Idle_9')||animations.find(clip=>clip.name==='Idle_03');
 if(!source)throw Error('The relaxed character idle animation is missing.');
 const tracks=source.tracks.filter(track=>track.name.endsWith('.quaternion')&&/mixamorig(?:Spine\d*|Neck|Head|(?:Left|Right)(?:Shoulder|Arm|ForeArm|Hand\w*))\.quaternion$/.test(track.name)).map(track=>({key:track.name.slice(0,-'.quaternion'.length).replace(/[^a-zA-Z0-9]/g,''),sample:track.createInterpolant()}));
 if(!tracks.length)throw Error('The character idle animation has no upper-body motion.');
 return {duration:source.duration,apply(bones,seconds){const time=((seconds%source.duration)+source.duration)%source.duration;for(const {key,sample}of tracks)bones[key]?.quaternion.fromArray(sample.evaluate(time));}};
}
