/** Small, deterministic designs shared by onboarding, profile portraits, and the island. */
export const LIVING_AVATARS = [
  {id:'trail', iris:'#6b482d', name:'Trail Scout', hairStyle:'sweep', skin:'#c88f68', hair:'#493125', hairLight:'#61402d', shirt:'#368e88', pants:'#77704d', accent:'#f1d7a0'},
  {id:'sunshine', iris:'#744520', name:'Sunshine Scout', hairStyle:'puffs', skin:'#965d3d', hair:'#29201d', hairLight:'#493128', shirt:'#f2bc48', pants:'#67594d', accent:'#e9a4a0'},
  {id:'meadow', iris:'#65814a', name:'Meadow Scout', hairStyle:'bob', skin:'#efc39d', hair:'#965331', hairLight:'#b96d40', shirt:'#83a45d', pants:'#676c4e', accent:'#ffe4aa'},
  {id:'sky', iris:'#497284', name:'Sky Scout', hairStyle:'crop', skin:'#d8a17c', hair:'#292e36', hairLight:'#46505b', shirt:'#609ab9', pants:'#56617a', accent:'#f4dfad'},
  {id:'berry', iris:'#7b512e', name:'Berry Scout', hairStyle:'curls', skin:'#75472e', hair:'#241b18', hairLight:'#493129', shirt:'#9c78b7', pants:'#62586c', accent:'#f3cc86'},
  {id:'sunset', iris:'#629279', name:'Sunset Scout', hairStyle:'ponytail', skin:'#f2c6a4', hair:'#c69243', hairLight:'#e8b660', shirt:'#dc8556', pants:'#697361', accent:'#ffdf9d'},
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
    ? `${src}?v=sculpted-2` : src;
}
