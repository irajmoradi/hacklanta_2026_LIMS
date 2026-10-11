import { cafeObstacle, cafeSeat } from './layout/cafeSeats';
import { boutiqueLayout } from './interior';

/** Boutique floor plus the left doorway; radius keeps the shopper off fixtures. */
export function boutiqueWalkable([x, z]: [number, number], radius = .25) {
  const { door, shelves, rack, counter } = boutiqueLayout;
  if (!Number.isFinite(x + z)) return false;
  const doorway = x >= boutiqueLayout.exit[0] - 1e-9 && x <= -4.5 && Math.abs(z - door.z) <= door.width / 2 - radius;
  if (!doorway && (x < -5 + radius || x > 5 - radius || z < -3.8 + radius || z > 4 - radius)) return false;
  return ![shelves, rack, counter].some(b => Math.abs(x - b.x) < b.width / 2 + radius && Math.abs(z - b.z) < b.depth / 2 + radius);
}

export function moveBoutique(from: [number, number], delta: [number, number]): [number, number] {
  const point: [number, number] = [...from];
  const steps = Math.max(1, Math.ceil(Math.hypot(...delta) / .1));
  for (let i = 0; i < steps; i++) {
    if (boutiqueWalkable([point[0] + delta[0] / steps, point[1]])) point[0] += delta[0] / steps;
    if (boutiqueWalkable([point[0], point[1] + delta[1] / steps])) point[1] += delta[1] / steps;
  }
  return point;
}
import type { EmoteRequest } from './emotes';
import { available } from './registryData';
import { entrance, type Town, type Lot } from './layout/town';
import { route, type Graph } from './layout/navigation';
import type { Activity, WorldState, XY } from './worldTypes';

export const CONTROL_TIMEOUT = 20;
export const ACTIVITY_SECONDS = 120;
export const WHEEL_SPEED = .12;
export const RIDE_SECONDS = 4 * Math.PI / WHEEL_SPEED;
export const TOWN_SCALE = .55;
export type DropTarget = { id: string; label: string; center: XY; point: XY; activity: Activity | 'ride' | 'pet'; yaw?:number; elevation?:number };

export function acceptsKey(event: Pick<KeyboardEvent, 'code' | 'altKey' | 'ctrlKey' | 'metaKey' | 'isComposing'>, blocked: boolean, editing: boolean) {
  return !blocked && !editing && !event.altKey && !event.ctrlKey && !event.metaKey && !event.isComposing &&
    ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','ShiftLeft','ShiftRight','Space','Digit1','Digit2','Digit3','KeyC'].includes(event.code);
}
export function editingElement(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
}
export function movement(keys: Set<string>): XY {
  const x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  const z = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
  const length = Math.hypot(x,z) || 1;
  return [x/length,z/length];
}
// The rendered grid streets define the playable envelope, including
// added residential rows. Cache it instead of scanning each step.
const bounds = new WeakMap<Town, {minX:number;maxX:number;minZ:number;maxZ:number}>();
export function walkable(town: Town, [x,z]: XY) {
  let edge=bounds.get(town);
  if(!edge){
    edge={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
    for(const street of town.streets) for(const [sx,sz] of street.points){
      const margin=street.width/2;
      edge.minX=Math.min(edge.minX,sx-margin);edge.maxX=Math.max(edge.maxX,sx+margin);
      edge.minZ=Math.min(edge.minZ,sz-margin);edge.maxZ=Math.max(edge.maxZ,sz+margin);
    }
    bounds.set(town,edge);
  }
  if (!Number.isFinite(x+z) || x<edge.minX || x>edge.maxX || z<edge.minZ || z>edge.maxZ) return false;
  return !town.lots.some(lot => {
    const solid = lot.memberSlot !== undefined || (lot.entry && !['garden','fountain','festival_stage','study_nook','fitness_corner'].includes(lot.entry.id));
    if (lot.entry?.id === 'storefront_cafe') return cafeObstacle([x-lot.center[0],z-lot.center[1]]);
    const yaw=lot.memberSlot === undefined ? 0 : lot.yaw;
    const dx=x-lot.center[0],dz=z-lot.center[1];
    return solid && Math.abs(dx*Math.cos(yaw)-dz*Math.sin(yaw)) < 5.35 && Math.abs(dx*Math.sin(yaw)+dz*Math.cos(yaw)) < 5.35;
  });
}
export function moveGround(town: Town, from: XY, delta: XY): XY {
  const point: XY = [...from];
  // Substeps prevent tunnelling even after a long frame or a large requested move.
  const steps = Math.max(1, Math.ceil(Math.hypot(...delta)/.15));
  for(let i=0;i<steps;i++) {
    const x: XY = [point[0]+delta[0]/steps,point[1]];
    if(walkable(town,x)) point[0]=x[0];
    const z: XY = [point[0],point[1]+delta[1]/steps];
    if(walkable(town,z)) point[1]=z[1];
  }
  return point;
}
function clearSegment(town: Town, a: XY, b: XY) {
  const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.15));
  for(let i=0;i<=n;i++) if(!walkable(town,[a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n])) return false;
  return true;
}
export function groundRoute(town: Town, graph: Graph, from: XY, to: XY): XY[] {
  if(!walkable(town,to)) return [];
  if(clearSegment(town,from,to)) return [to];
  const nearest = (p: XY) => [...graph.values()].sort((a,b)=>Math.hypot(a.point[0]-p[0],a.point[1]-p[1])-Math.hypot(b.point[0]-p[0],b.point[1]-p[1])).find(n=>clearSegment(town,p,n.point))?.point;
  const a=nearest(from), b=nearest(to);
  if(!a || !b) return [];
  const path=route(graph,a,b);
  return path.length ? [...path,to] : [];
}
export function dropTargets(town: Town, slot: number, world: WorldState): DropTarget[] {
  const kinds: Record<string, [string, DropTarget['activity']]> = {
    storefront_cafe:['Sit and sip at caf\u00e9','cafe'], ferris_wheel:['Ride Ferris wheel','ride'], festival_stage:['Dance on stage','dance'], fountain:['Sit and read','sit'],
    garden:['Tend garden','kneel'], food_truck:['Grab a bite','eat'], pet_shelter:['Pet a dog','pet'],
    shop:['Visit clothing shop','gather'], study_nook:['Study','study'], farm_store:['Visit farm store','gather'], fitness_corner:['Work out','workout'], colosseum:['Visit colosseum entrance','gather'],
  };
  const result: DropTarget[]=[];
  const add=(lot: Lot,id:string,label:string,activity:DropTarget['activity'])=>result.push({id,label,activity,center:lot.center,point:entrance(lot)});
  for(const lot of town.lots) {
    const e=lot.entry;
    if(e && kinds[e.id] && available(e,world) && world.disaster?.closed_building!==e.id && !(e.id==='pet_shelter' && world.disaster?.kind==='outbreak')) add(lot,e.id,...kinds[e.id]);
    if(!e && lot.memberSlot===undefined && lot.district==='park') add(lot,`garden:${lot.id}`,'Tend garden','kneel');
  }
  if(!result.some(t=>t.id==='colosseum')) {
    const edge=town.streets.filter(s=>s.id.startsWith('north-south:')).at(-1)!;
    const point=edge.points[Math.floor(edge.points.length/2)];
    result.push({id:'colosseum',label:'Visit colosseum entrance',activity:'gather',center:point,point});
  }
  for(const target of result) {
    if(target.activity==='cafe'){const seat=cafeSeat(target.center,slot);target.point=seat.target;target.yaw=seat.yaw;}
    if(target.activity==='workout')target.point=[target.center[0]-3+(slot%4)*2,target.center[1]+3+Math.floor(slot/4)%2*2];
    if(target.activity==='dance'){target.point=[target.center[0],target.center[1]+2];target.elevation=.8;}
    if(target.activity==='kneel')target.point=[target.center[0],target.center[1]+3];
  }
  const home=town.homes.get(slot);
  if(home) add(home,'home','Go inside','wander');
  return result;
}
export function resolveDrop(targets: DropTarget[], point: XY | null) {
  return point ? targets.filter(t=>Math.abs(point[0]-t.center[0])<=6 && Math.abs(point[1]-t.center[1])<=6.8).sort((a,b)=>Math.hypot(point[0]-a.center[0],point[1]-a.center[1])-Math.hypot(point[0]-b.center[0],point[1]-b.center[1]))[0] ?? null : null;
}
export function rideTimeline(elapsed: number) {
  return {angle:Math.min(Math.max(0,elapsed),RIDE_SECONDS)*WHEEL_SPEED, done:elapsed>=RIDE_SECONDS};
}
export type ManualMotion = {x:number;z:number;tx:number;tz:number;path:XY[];activity:Activity};
export type PlayerState = { active:boolean; follow:boolean; dragging:boolean; moving:boolean; running?:boolean; emote:EmoteRequest|null; until:number; lastInput:number; label:string|null; ride: {start:number; target:DropTarget; cabin:number}|null; activity:DropTarget|null; destination:XY|null };
export function playerState(): PlayerState { return {active:false,follow:true,dragging:false,moving:false,emote:null,until:0,lastInput:0,label:null,ride:null,activity:null,destination:null}; }
