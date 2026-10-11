import type { XY } from '../worldTypes';

// Authored metres, shared by the fallback, layout and seat routing. GLB uses the same anchors.
export const STUDY_TABLES = [-2.8, 0, 2.8];
export const STUDY_SEATS = STUDY_TABLES.flatMap(x => [-1, 1].flatMap(z =>
  [-.55, .55].map(dx => ({height: 1.03, offset: [x + dx, z] as XY, aisle: x + (dx < 0 ? -1.25 : 1.25), yaw: z < 0 ? 0 : Math.PI}))));

export function assignSeats(slots: number[], capacity: number, reserved?: {slot:number;seat:number}): Map<number,number> {
  const result=new Map<number,number>();
  if(reserved && reserved.seat>=0 && reserved.seat<capacity)result.set(reserved.slot,reserved.seat);
  const free=Array.from({length:capacity},(_,i)=>i).filter(i=>i!==reserved?.seat);
  for(const slot of [...new Set(slots)].sort((a,b)=>a-b)) {
    if(result.has(slot))continue;
    const seat=free.shift();if(seat===undefined)break;result.set(slot,seat);
  }
  return result;
}
export function assignStudySeats(slots: number[], reserved?: {slot:number;seat:number}) {
  return assignSeats(slots,STUDY_SEATS.length,reserved);
}
export const activityPhase = (seconds: number, slot: number) => ((seconds + slot * 137) % 600 + 600) % 600;
