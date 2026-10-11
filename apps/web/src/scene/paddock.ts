import type { HouseStyle } from './houseStyles';
/** Everything stays inside the 10.4m lot interior, away from pavement at +/-5.2.
 * Paddock lots reserve a narrower house envelope for all tiers and styles. */
export function paddockLayout(style: HouseStyle) {
  return { houseX: -1.35, houseScale: .70, center: [3.9, style === 'beach' ? -.4 : 0] as [number,number], width: 2.2, depth: 7.6 };
}
export function animalPose(index: number, time: number, width: number, depth: number) {
  const phase = time * .19 + index * 2.399;
  return { x: Math.sin(phase) * (width/2-.45), z: Math.cos(phase*.73+index) * (depth/2-.55), yaw: Math.atan2(Math.cos(phase), -.73*Math.sin(phase*.73+index)), bob: Math.abs(Math.sin(time*2+index))*.025, peck: Math.max(0,Math.sin(time*1.3+index))*.24 };
}
