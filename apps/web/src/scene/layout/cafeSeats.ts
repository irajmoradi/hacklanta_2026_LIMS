import { assignSeats } from './studySeats';
import type { XY } from '../worldTypes';

// Lot-local metres. Keep the entire patio inside the yard, including canopy edges.
export const CAFE_OFFSET: [number, number, number] = [0, 0, 4.6];
export const CAFE_TABLES = [-3, 0, 3];
export const CAFE_SEATS = CAFE_TABLES.flatMap(x => [-1, 1].map(z => ({
  height: .91, offset: [x, CAFE_OFFSET[2] + z] as XY, yaw: z < 0 ? 0 : Math.PI,
})));
export function cafeSeat(center: XY, slot: number) {
  const seat = CAFE_SEATS[((slot % CAFE_SEATS.length) + CAFE_SEATS.length) % CAFE_SEATS.length];
  return {target: [center[0] + seat.offset[0], center[1] + seat.offset[1]] as XY, yaw: seat.yaw};
}
export function cafeObstacle([x,z]: XY) {
  return (Math.abs(x) < 3.5 && z > -5 && z < 2)
    || (Math.abs(x) > 4.2 && Math.abs(x) < 4.85 && z > 2.8 && z < 6.4)
    || CAFE_TABLES.some(table => Math.hypot(x-table,z-CAFE_OFFSET[2]) < .72);
}
// Six seats per cohort, one minute per ten-minute day (10% of scheduled time).
export const cafeTime = (seconds: number, slot: number) =>
  ((seconds - 420 - (Math.floor(slot / 6) % 10) * 60) % 600 + 600) % 600 < 60;

export function assignCafeSeats(slots: number[], reserved?: {slot:number;seat:number}) {
  return assignSeats(slots,CAFE_SEATS.length,reserved);
}
