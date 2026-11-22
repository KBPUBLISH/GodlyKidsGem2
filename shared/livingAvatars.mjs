/** Small, deterministic designs shared by onboarding, profile portraits, and the island. */
export const LIVING_AVATARS = [
  {id:'trail', iris:'#663712', name:'Trail Scout', hairStyle:'sweep', skin:'#e5a46d', hair:'#57311c', hairLight:'#824323', shirt:'#169f9e', pants:'#78744d', accent:'#fff0cc'},
  {id:'meadow', iris:'#694027', name:'Meadow Scout', hairStyle:'bob', skin:'#efbc8d', hair:'#5a3324', hairLight:'#854a2d', shirt:'#eee3c6', pants:'#777354', accent:'#638b9a'},
  {id:'sunset', iris:'#698d98', name:'Sunset Scout', hairStyle:'crop', skin:'#f1bc89', hair:'#e4a327', hairLight:'#ffd069', shirt:'#c94c36', pants:'#686f56', accent:'#ffe5b0'},
  {id:'sunshine', iris:'#643717', name:'Sunshine Scout', hairStyle:'braids', skin:'#965a35', hair:'#2b1c18', hairLight:'#503123', shirt:'#f4bd28', pants:'#675442', accent:'#ffda48'},
  {id:'sky', iris:'#66402d', name:'Sky Scout', hairStyle:'hat', skin:'#e2a876', hair:'#35261b', hairLight:'#5a3f2c', shirt:'#6f8848', pants:'#6c6446', accent:'#e9c68c'},
  {id:'berry', iris:'#6c4929', name:'Berry Scout', hairStyle:'waves', skin:'#f1bc93', hair:'#ae5424', hairLight:'#df8b3e', shirt:'#a376bf', pants:'#665977', accent:'#f3d7a5'},
].map(avatar => Object.freeze({...avatar, portrait:`/avatars/adventurers/${avatar.id}.png`}));

export function getLivingAvatar(id) {
  return LIVING_AVATARS.find(avatar => avatar.id === id) || LIVING_AVATARS[0];
}

/** avatarSeed already syncs through the existing profile API, including on another device. */
export function livingAvatarForProfile(profile) {
  return LIVING_AVATARS.find(avatar => avatar.id === profile?.worldAvatarId)
    || LIVING_AVATARS.find(avatar => avatar.portrait === profile?.avatarSeed)
    || LIVING_AVATARS[0];
}

/** Bust only the rendered artwork cache; saved profile identifiers stay stable. */
export function livingAvatarPortraitUrl(src) {
  return typeof src==='string' && /^\/avatars\/adventurers\/(trail|sunshine|meadow|sky|berry|sunset)\.(png|webp)$/.test(src)
    ? `${src.replace(/\.png$/,'.webp')}?v=harbor-4` : src;
}
