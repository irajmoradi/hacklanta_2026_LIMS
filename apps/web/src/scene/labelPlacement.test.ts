import {expect,test} from 'bun:test';
import {labelOffset,labelsOverlap,type LabelRect} from './labelPlacement';
test('dense name tags stay in bounds, and impossible placements are culled',()=>{
  const bounds={left:0,right:600,top:0,bottom:400}, occupied:LabelRect[]=[];
  let hidden=0;
  for(let i=0;i<100;i++) {
    const base={left:200,right:320,top:150+i%5,bottom:190+i%5};
    const offset=labelOffset(base,bounds,occupied,8);
    if(offset===null) {hidden++;continue;}
    const placed={...base,top:base.top+offset,bottom:base.bottom+offset};
    expect(placed.top).toBeGreaterThanOrEqual(8);
    expect(placed.bottom).toBeLessThanOrEqual(392);
    expect(occupied.some(other=>labelsOverlap(placed,other))).toBe(false);
    occupied.push(placed);
  }
  expect(hidden).toBeGreaterThan(0);
  expect(occupied.length).toBeGreaterThan(1);
});
