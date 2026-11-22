/** Current Creation-pack Adam, bundled locally for offline island arrivals.
 * Source: https://storage.googleapis.com/productiongk/books/bible-map/beginnings/video/1793496889125_adam.glb
 * Verified against story 6ad64f0f2f352263e5b7f449. Newer CMS replacements keep their own URL.
 */
export const ADAM_MODEL_URL='/models/adam-current.glb';
export function adamModelUrl(value){
 const raw=typeof value==='string'?value.trim():'';
 if(!raw)return ADAM_MODEL_URL;
 try{const path=new URL(raw,'https://local.invalid').pathname;
  if(path==='/models/test-character.glb'||/^\/(?:homeworld\/)?assets\/(?:mobile\/)?adam\.glb$/i.test(path))return ADAM_MODEL_URL;
 }catch{}
 return raw;
}
export function currentAdamCharacter(character){
 if(!character||!(character.id==='onboarding-adam'||/^adam$/i.test(String(character.name||'').trim())))return character;
 const modelUrl=adamModelUrl(character.modelUrl);
 return modelUrl===character.modelUrl?character:{...character,modelUrl};
}
