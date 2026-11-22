import React from 'react';
import potato from './assets/kitchen/actions/potato.webp';
import fry from './assets/kitchen/actions/fry.webp';
import batter from './assets/kitchen/actions/batter.webp';
import fillet from './assets/kitchen/actions/fillet.webp';
import coated from './assets/kitchen/actions/coated.webp';
import tray from './assets/kitchen/actions/tray.webp';
import oven from './assets/kitchen/actions/oven.webp';
import knife from './assets/kitchen/actions/knife.webp';
import hand from './assets/kitchen/actions/hand.webp';
const images={potato,fry,batter,fillet,coated,tray,oven,knife,hand};
/** Each action uses one isolated image: no nested sprite viewport to leak. */
export function CookingActionArt({id,x=0,y=0,width=100,height=100,className='',opacity=1}){
 const src=images[id];if(!src)return null;
 return <image href={src} x={x} y={y} width={width} height={height} preserveAspectRatio="none" className={`cooking-action-art ${className}`} opacity={opacity} aria-hidden="true"/>;
}
