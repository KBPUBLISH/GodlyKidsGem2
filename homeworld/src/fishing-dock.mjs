export const FISHING_DOCK_LENGTH = 4.2;
export const FISHING_DOCK_WIDTH = 1.25;
export const FISHING_DOCK_START = .25;

/** Shared footprint for the visible fishing pier, navigation, and deck height. */
export function fishingDockLayout(world) {
  const spot = world?.fishingSpots?.[0];
  if (!spot?.position || !spot?.water) return null;
  const sx = spot.position[0], sy = spot.position[1];
  const vx = spot.water[0] - sx, vy = spot.water[1] - sy;
  const length = Math.hypot(vx, vy);
  if (!length) return null;
  return {
    spot, sx, sy,
    dx: vx / length,
    dy: vy / length,
    start: -.35,
    end: FISHING_DOCK_LENGTH + .2,
    halfWidth: FISHING_DOCK_WIDTH / 2 - .08,
  };
}

export function fishingDockContains(layout, x, y) {
  if (!layout) return false;
  const ox = x - layout.sx, oy = y - layout.sy;
  const along = ox * layout.dx + oy * layout.dy;
  const across = -ox * layout.dy + oy * layout.dx;
  return along >= layout.start && along <= layout.end && Math.abs(across) <= layout.halfWidth;
}

export function fishingDockDeckHeight(world, sampleHeight, x, y) {
  const layout = fishingDockLayout(world);
  if (!fishingDockContains(layout, x, y)) return null;
  return Math.max(sampleHeight(layout.sx, layout.sy), layout.spot.water[2] || 0) + .34;
}
export const DOCK_LENGTH=FISHING_DOCK_LENGTH;
export const DOCK_WIDTH=FISHING_DOCK_WIDTH;

/** World-grid footprint of the rendered dock, including a small shore join. */
export function dockWalkArea(spot,point){
  if(!spot?.position||!spot?.water||!point)return null;
  const layout=fishingDockLayout({fishingSpots:[spot]});
  if(!layout)return null;
  const px=point.x-layout.sx,py=point.y-layout.sy;
  return {inside:fishingDockContains(layout,point.x,point.y),along:px*layout.dx+py*layout.dy,lateral:-px*layout.dy+py*layout.dx};
}

export function openDockCells(nav,spot){
  if(!nav||!spot)return;
  for(let row=0;row<nav.height;row++)for(let col=0;col<nav.width;col++){
    if(dockWalkArea(spot,nav.point(col,row))?.inside)nav.blocked[row*nav.width+col]=0;
  }
}
