export const DOCK_LENGTH=4.2;
export const DOCK_WIDTH=1.25;

/** World-grid footprint of the rendered dock, including a small shore join. */
export function dockWalkArea(spot,point){
  if(!spot?.position||!spot?.water||!point)return null;
  const dx=spot.water[0]-spot.position[0],dy=spot.water[1]-spot.position[1],length=Math.hypot(dx,dy)||1;
  const fx=dx/length,fy=dy/length,rx=-fy,ry=fx;
  const px=point.x-spot.position[0],py=point.y-spot.position[1];
  const along=px*fx+py*fy,lateral=px*rx+py*ry;
  return {inside:along>=-.35&&along<=DOCK_LENGTH+.2&&Math.abs(lateral)<=DOCK_WIDTH/2-.08,along,lateral};
}

export function openDockCells(nav,spot){
  if(!nav||!spot)return;
  for(let row=0;row<nav.height;row++)for(let col=0;col<nav.width;col++){
    if(dockWalkArea(spot,nav.point(col,row))?.inside)nav.blocked[row*nav.width+col]=0;
  }
}
