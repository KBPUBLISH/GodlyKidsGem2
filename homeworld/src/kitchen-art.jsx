import React from 'react';
import fish_chips from './assets/kitchen/icons/fish_chips.webp';
import pumpkin_stew from './assets/kitchen/icons/pumpkin_stew.webp';
import garden_omelette from './assets/kitchen/icons/garden_omelette.webp';
import pantry from './assets/kitchen/icons/pantry.webp';
import prep from './assets/kitchen/icons/prep.webp';
import pot from './assets/kitchen/icons/pot.webp';
import oven from './assets/kitchen/icons/oven.webp';
import serve from './assets/kitchen/icons/serve.webp';
import pumpkin from './assets/kitchen/icons/pumpkin.webp';
import carrot from './assets/kitchen/icons/carrot.webp';
import egg from './assets/kitchen/icons/egg.webp';
import fish from './assets/kitchen/icons/fish.webp';
import potato from './assets/kitchen/icons/potato.webp';
import chef_hat from './assets/kitchen/icons/chef_hat.webp';
import spoon from './assets/kitchen/icons/spoon.webp';
import star from './assets/kitchen/icons/star.webp';
export const KITCHEN_ART={fish_chips,pumpkin_stew,garden_omelette,pantry,prep,pot,oven,serve,pumpkin,carrot,egg,fish,potato,chef_hat,spoon,star,potato_seed:potato};
export function KitchenArt({id,size=64,className=''}){
 const src=KITCHEN_ART[id];if(!src)return null;
 return <img src={src} width={size} height={size} className={`kitchen-art ${className}`} alt="" aria-hidden="true" draggable="false" style={{objectFit:'contain',flexShrink:0}}/>;
}
