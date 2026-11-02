import React from 'react';
import atlas from './assets/kitchen/kitchen-icons.webp';

// One shared transparent atlas keeps lighting and materials consistent. SVG
// viewports isolate each cell without stretching the artwork in narrow cards.
export const KITCHEN_ART = {
 fish_chips:[0,0],pumpkin_stew:[1,0],garden_omelette:[2,0],pantry:[3,0],
 prep:[0,1],pot:[1,1],oven:[2,1],serve:[3,1],
 pumpkin:[0,2],carrot:[1,2],egg:[2,2],fish:[3,2],
 potato:[0,3],potato_seed:[0,3],chef_hat:[1,3],spoon:[2,3],star:[3,3],
};

export function KitchenArt({id,size=64,className=''}){
 const cell=KITCHEN_ART[id];if(!cell)return null;
 return <svg width={size} height={size} viewBox={`${cell[0]} ${cell[1]} 1 1`} className={`kitchen-art ${className}`} aria-hidden="true" focusable="false" style={{overflow:'hidden',flexShrink:0}}><image href={atlas} width="4" height="4"/></svg>;
}
