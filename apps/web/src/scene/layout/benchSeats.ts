import { assignSeats } from './studySeats';
import type { XY } from '../worldTypes';
export const BENCH_SEATS = [-3,0,3].map(x => ({offset:[x,6.5] as XY, height:.91, yaw:Math.PI}));
export function assignBenchSeats(slots:number[], reserved?: {slot:number;seat:number}) { return assignSeats(slots,BENCH_SEATS.length,reserved); }
