export type LabelRect = {left:number;right:number;top:number;bottom:number};
export const labelsOverlap = (a:LabelRect,b:LabelRect) => a.left<b.right+4 && a.right+4>b.left && a.top<b.bottom+4 && a.bottom+4>b.top;
export function labelOffset(base:LabelRect,bounds:LabelRect,occupied:LabelRect[],steps=20):number|null {
  const min=bounds.top+8-base.top, max=bounds.bottom-8-base.bottom;
  if(min>max) return null;
  for(const candidate of [0,...Array.from({length:steps},(_,i)=>[-(i+1)*12,(i+1)*12]).flat()]) {
    const offset=Math.max(min,Math.min(max,candidate));
    const box={...base,top:base.top+offset,bottom:base.bottom+offset};
    if(!occupied.some(other=>labelsOverlap(box,other))) return offset;
  }
  return null;
}
