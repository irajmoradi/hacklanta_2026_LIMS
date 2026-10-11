import { BENCH_SEATS } from './benchSeats';
import { CAFE_SEATS } from './cafeSeats';
import { STUDY_SEATS } from './studySeats';
import { entrance, type Town } from './town';
import type { XY } from '../worldTypes';
export type Graph = Map<string, { point: XY; neighbors: Set<string> }>;
const key = (p: XY) => p.join(',');
export function sidewalkGraph(town: Town): Graph {
  const graph: Graph = new Map();
  const add = (p: XY) => { const id = key(p); if (!graph.has(id)) graph.set(id, {point: p, neighbors: new Set()}); return id; };
  const link = (a: XY,b: XY) => { const x=add(a), y=add(b); graph.get(x)!.neighbors.add(y); graph.get(y)!.neighbors.add(x); };
  for(const street of town.streets) for(let i=1;i<street.points.length;i++) link(street.points[i-1],street.points[i]);
  for (const lot of town.lots.filter(l => l.entry?.id === 'fountain')) {
    for(const seat of BENCH_SEATS) link(entrance(lot),[lot.center[0]+seat.offset[0],lot.center[1]+seat.offset[1]]);
  }
  for (const lot of town.lots.filter(l => l.entry?.id === 'study_nook')) {
    const [x,z] = lot.center;
    link(entrance(lot),[x,z+4]);
    for (const seat of STUDY_SEATS) {
      link([x,z+4],[x+seat.aisle,z+4]);
      link([x+seat.aisle,z+4],[x+seat.aisle,z+seat.offset[1]]);
      link([x+seat.aisle,z+seat.offset[1]],[x+seat.offset[0],z+seat.offset[1]]);
    }
  }
  for (const lot of town.lots.filter(l => l.entry?.id === 'fitness_corner')) {
    const [x,z] = lot.center;
    link(entrance(lot),[x,z+6]);
    for (const dx of [-3,-1,1,3]) {
      link([x,z+6],[x+dx,z+6]);
      link([x+dx,z+6],[x+dx,z+5]);
      link([x+dx,z+5],[x+dx,z+3]);
    }
  }
  for (const lot of town.lots.filter(l => l.entry?.id === 'storefront_cafe')) {
    const [x,z] = lot.center;
    for (const seat of CAFE_SEATS) {
      const aisle=x+seat.offset[0]+.95;
      link(entrance(lot), [aisle, z + 6.4]);
      link([aisle, z + 6.4], [aisle, z + seat.offset[1]]);
      link([aisle, z + seat.offset[1]], [x + seat.offset[0], z + seat.offset[1]]);
    }
  }
  return graph;
}
// Euclidean distance is an admissible lower bound along the grid.
const distance = (a: XY,b: XY) => Math.hypot(a[0]-b[0],a[1]-b[1]);
export function route(graph: Graph, from: XY, to: XY): XY[] {
  const nearest=(p: XY)=>[...graph.keys()].reduce((best,id)=>distance(graph.get(id)!.point,p)<distance(graph.get(best)!.point,p)?id:best);
  if(!graph.size)return [];
  const start=nearest(from),end=nearest(to),open=new Set([start]),cost=new Map([[start,0]]),parent=new Map<string,string>();
  while(open.size){
    const current=[...open].reduce((a,b)=>(cost.get(a)!+distance(graph.get(a)!.point,to))<(cost.get(b)!+distance(graph.get(b)!.point,to))?a:b);
    if(current===end){const path=[current];while(parent.has(path[0]))path.unshift(parent.get(path[0])!);return path.map(id=>graph.get(id)!.point);}
    open.delete(current);
    for(const next of graph.get(current)!.neighbors){const score=cost.get(current)!+distance(graph.get(current)!.point,graph.get(next)!.point);if(score<(cost.get(next)??Infinity)){parent.set(next,current);cost.set(next,score);open.add(next);}}
  }
  return [];
}
