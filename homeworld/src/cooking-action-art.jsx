import React from 'react';
import atlas from './assets/kitchen/cooking-actions.webp';

const cells={potato:[0,0],fry:[1,0],batter:[2,0],fillet:[0,1],coated:[1,1],tray:[2,1],oven:[0,2],knife:[1,2],hand:[2,2]};
/** Texture sprites inside an interactive SVG; the scene still owns hit areas. */
export function CookingActionArt({id,x=0,y=0,width=100,height=100,className='',opacity=1}){
 const [col,row]=cells[id];
 return <svg x={x} y={y} width={width} height={height} viewBox={`${col} ${row} 1 1`} preserveAspectRatio="none" overflow="hidden" className={`cooking-action-art ${className}`} opacity={opacity} aria-hidden="true"><image href={atlas} width="3" height="3"/></svg>;
}
