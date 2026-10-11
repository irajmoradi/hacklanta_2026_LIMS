import { CatmullRomCurve3, Vector3 } from 'three';
import type { XY } from '../worldTypes';
import type { Lot } from './town';
import {seededRandom} from '../worldTypes';

export type Street = { id: string; kind: 'road' | 'path' | 'drive'; points: XY[]; width: number };
export function clearOfStreets(streets: Street[], point: XY, radius: number): boolean {
  return streets.every(street=>street.points.every((b,i)=>{
    if(!i)return true;
    const a=street.points[i-1],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dz)/(dx*dx+dz*dz||1)));
    return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dz)>radius+street.width/2;
  }));
}
export const PITCH = 21;
const round = (n: number) => Math.round(n * 100000) / 100000;
export function curve(points: XY[], steps = (points.length - 1) * 4): XY[] {
  return new CatmullRomCurve3(points.map(([x,z]) => new Vector3(x,0,z)),false,'centripetal')
    .getPoints(steps).map(p => [round(p.x), round(p.z)]);
}
export function lotEntrance(lot: Lot): XY {
  const distance = lot.memberSlot === undefined ? 6 : 7.8;
  const yaw = lot.memberSlot === undefined ? 0 : lot.yaw;
  return [round(lot.center[0] + Math.sin(yaw)*distance), round(lot.center[1] + Math.cos(yaw)*distance)];
}
export function makeStreets(lots: Lot[], rows: number, cols: number, seed=0, start=0): Street[] {
  const streets: Street[] = [];
  // Half-pitch knots include every intersection AND each lot's access point.
  // Renderer and graph share exact intersections and straight entrance junctions.
  for(let row=start;row<=start+rows;row++) {
    const points=Array.from({length:cols*2+1},(_,i)=>[(start+i/2-3)*PITCH,(row-3)*PITCH] as XY);
    streets.push({id:`east-west:${row}`,kind:row%2?'path':'road',width:row%2?1.5:row===2?5.2:3.2+seededRandom(seed+row*71)()*.5,points});
  }
  for(let col=start;col<=start+cols;col++) {
    const points=Array.from({length:rows*2+1},(_,i)=>[(col-3)*PITCH,(start+i/2-3)*PITCH] as XY);
    streets.push({id:`north-south:${col}`,kind:col%2?'path':'road',width:col%2?1.5:col===2||col===4?5.2:3.2+seededRandom(seed+col*53)()*.5,points});
  }
  for(const lot of lots) {
    const [row,col]=lot.id.split(':').map(Number);
    const door=lotEntrance(lot),junction:XY=[(col-2.5)*PITCH,(row-2)*PITCH];
    const points:XY[]=[door,[door[0],junction[1]],junction];
    streets.push({id:`access:${lot.id}`,kind:'drive',width:1.2,
      points:points.filter((p,i)=>!i||p[0]!==points[i-1][0]||p[1]!==points[i-1][1])});
  }
  // Short edge alley terminates outside every parcel; its root is an existing knot.
  const alleyZ=(seed%2?-2:0)*PITCH;
  streets.push({id:'edge-alley',kind:'path',width:1.4,points:[[(start-3)*PITCH,alleyZ],[(start-3)*PITCH-6,alleyZ]]});
  return streets;
}
