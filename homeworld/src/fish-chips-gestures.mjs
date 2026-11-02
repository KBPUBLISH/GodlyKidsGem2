// Coordinates match the 400 × 300 activity illustration, on every screen size.
export const fryCutX = index => .325 + Math.min(2, Math.max(0, index)) * .1;
export function cutFry(start,end,index){
 if(!start||!end||index>=3||end.y-start.y<.3||start.y>.35||end.y<.7)return false;
 const t=(.5-start.y)/(end.y-start.y),x=start.x+(end.x-start.x)*t;
 return Math.abs(x-fryCutX(index))<=.065;
}
export const onCrumbBowl=p=>!!p&&p.x>=.68&&p.x<=.96&&p.y>=.68&&p.y<=.98;
export const overFillet=p=>!!p&&p.x>=.2&&p.x<=.75&&p.y>=.2&&p.y<=.62;
export const onBakingTray=p=>!!p&&p.x>=.12&&p.x<=.88&&p.y>=.68&&p.y<=.98;
export const insideOven=p=>!!p&&p.x>=.23&&p.x<=.77&&p.y>=.2&&p.y<=.49;
export const dragCentre=(start,end,origin)=>({x:origin.x+end.x-start.x,y:origin.y+end.y-start.y});
