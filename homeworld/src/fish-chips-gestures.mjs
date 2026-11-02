// Coordinates match the 400 × 300 activity illustration, on every screen size.
export const fryCutX = index => .325 + Math.min(2, Math.max(0, index)) * .1;
export function cutFry(start,end,index){
 if(!start||!end||index>=3||end.y-start.y<.3||start.y>.35||end.y<.7)return false;
 const t=(.5-start.y)/(end.y-start.y),x=start.x+(end.x-start.x)*t;
 return Math.abs(x-fryCutX(index))<=.065;
}
export const onFillet=p=>!!p&&p.x>=.25&&p.x<=.75&&p.y>=.28&&p.y<=.6;
export const inBatter=p=>!!p&&((p.x-.5)/.32)**2+((p.y-.48)/.28)**2<=1;
export const coatInBatter=(start,end)=>onFillet(start)&&inBatter(end)&&Math.abs(end.x-start.x)>=.2&&Math.abs(end.y-start.y)<=.22;
export const onBakingTray=p=>!!p&&p.x>=.12&&p.x<=.88&&p.y>=.68&&p.y<=.98;
export const insideOven=p=>!!p&&p.x>=.23&&p.x<=.77&&p.y>=.2&&p.y<=.49;
export const dragCentre=(start,end,origin)=>({x:origin.x+end.x-start.x,y:origin.y+end.y-start.y});
