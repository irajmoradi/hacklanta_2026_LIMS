import type { Movement } from '../api/movement';
import { bounds, furniture, type Item } from './interior';

export type Point = { x: number; z: number };
export type InteriorPosition = Movement & { floor: number; y?: number };
export type InteriorPeer = Partial<InteriorPosition> & { name: string; item?: string };
export const door = { x: 0, z: 1.9 };
export const stairs = [{ x: 3, z: 3, direction: 1 }, { x: -3, z: 3, direction: -1 }];
export function stairAt(p: Point, floor: number, floors: number, radius = .5) {
  return stairs.find(s => floor + s.direction >= 0 && floor + s.direction < floors && Math.hypot(p.x-s.x,p.z-s.z) < radius);
}
export const FLOOR_HEIGHT = 3.4;
export const stairLabel = (direction: number) => direction > 0 ? 'Upstairs \u2191' : 'Downstairs \u2193';
export const stairOpening = { minX: -3, maxX: 3, minZ: 2.5, maxZ: 3.5 };
export function inStairwell(p: Point) {
  return p.x > stairOpening.minX && p.x < stairOpening.maxX && p.z > stairOpening.minZ && p.z < stairOpening.maxZ;
}
export function stairPoint(lower: number, progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  return {x: 3 - 6*t, z: 3, y: (lower+t)*FLOOR_HEIGHT};
}
// The API already relays x/z/floor. Reserved stair coordinates reconstruct height
// even on servers that discard the optional y extension.
export function positionHeight(p: Partial<InteriorPosition>, floors: number) {
  if (Number.isFinite(p.y)) return p.y!;
  const floor = p.floor ?? 0;
  return floor < floors-1 && p.x !== undefined && p.z !== undefined && inStairwell({x:p.x,z:p.z})
    ? stairPoint(floor, (3-p.x)/6).y : floor*FLOOR_HEIGHT;
}
export function blocksStairwell(i: Item) {
  if (i.stashed) return false;
  const [w,d] = bounds(i);
  return i.x+w > -3.5 && i.x-w < 3.5 && i.z+d > 2.5 && i.z-d < 3.5;
}
export function walkable(p: Point, items: Item[], floor: number) {
  return Math.abs(p.x) <= 3.75 && Math.abs(p.z) <= 3.75 && !items.some(i => {
    if (i.stashed || (i.floor ?? 0) !== floor || ['rug','wall','disco'].includes(furniture.find(c=>c.id===i.kind)?.shape ?? 'object')) return false;
    const [w,d] = bounds(i);
    return Math.abs(p.x-i.x) < w+.2 && Math.abs(p.z-i.z) < d+.2;
  });
}
// Quarter-unit grid A*, four neighbors: no diagonal corner cutting.
export function interiorPath(start: Point, end: Point, items: Item[], floor: number, reserveStairs = false): Point[] {
  const grid = (p:Point) => ({x:Math.round(p.x*4)/4,z:Math.round(p.z*4)/4});
  const key = (p:Point) => `${p.x},${p.z}`;
  const a=grid(start), b=grid(end);
  if (!walkable(b,items,floor)) return [];
  const open=[a], costs=new Map([[key(a),0]]), previous=new Map<string,Point>();
  const heuristic=(p:Point)=>Math.abs(p.x-b.x)+Math.abs(p.z-b.z);
  while(open.length) {
    open.sort((p,q)=>costs.get(key(p))!+heuristic(p)-costs.get(key(q))!-heuristic(q));
    const p=open.shift()!;
    if(key(p)===key(b)) {
      const path:Point[]=[]; let n=p;
      while(key(n)!==key(a)) {path.unshift(n);n=previous.get(key(n))!;}
      return path;
    }
    for(const [dx,dz] of [[.25,0],[-.25,0],[0,.25],[0,-.25]]) {
      const n={x:p.x+dx,z:p.z+dz}, cost=costs.get(key(p))!+.25;
      if((reserveStairs && inStairwell(n)) || !walkable(n,items,floor) || cost >= (costs.get(key(n)) ?? Infinity)) continue;
      previous.set(key(n),p);costs.set(key(n),cost);open.push(n);
    }
  }
  return [];
}
