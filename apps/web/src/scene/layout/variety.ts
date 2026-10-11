import type {Town, Lot} from './town';
import {seededRandom, type XY} from '../worldTypes';
import {PITCH} from './streets';

export type Point3 = [number, number, number];
export type Decor = {role: 'tree_a'|'tree_b'|'tree_c'|'hedge'|'streetlight'|'detail'; p: Point3; scale: Point3; rotation: number; shade: string; lean?: number};
export type Bounds = {x: number; z: number; hx: number; hz: number};
export const parcel = (lot: Lot): XY => {
  const [row,col]=lot.id.split(':').map(Number);return [(col-2.5)*PITCH,(row-2.5)*PITCH];
};
/** Conservative rectangles include the full canopy and rotated silhouettes. */
export function decorBounds(d: Decor): Bounds {
  const tree=d.role.startsWith('tree_');
  const radius=tree?Math.hypot(d.scale[0],d.scale[2])*.5+d.scale[1]*Math.abs(d.lean??0):0;
  return {x:d.p[0],z:d.p[2],hx:tree?radius:(Math.abs(Math.cos(d.rotation))*d.scale[0]+Math.abs(Math.sin(d.rotation))*d.scale[2])/2,
    hz:tree?radius:(Math.abs(Math.sin(d.rotation))*d.scale[0]+Math.abs(Math.cos(d.rotation))*d.scale[2])/2};
}
export function overlaps(a: Bounds,b: Bounds,gap=.12) {
  return Math.abs(a.x-b.x)<a.hx+b.hx+gap && Math.abs(a.z-b.z)<a.hz+b.hz+gap;
}
export function reservedBounds(town: Town): Bounds[] {
  // Empty civic/park lawns can host groves. Keep every residential address and
  // every catalog attraction protected, even while unoccupied or locked.
  return town.lots.filter(l=>l.entry || l.district==='residential' || l.memberSlot!==undefined)
    .map(l=>{const [x,z]=parcel(l);return {x,z,hx:7.25,hz:7.25};});
}
/** Inset rounded island, including its corners (the mesh has a 10m corner). */
export function insideIsland(town: Town, b: Bounds): boolean {
  const centerZ=(town.roadsZ[0]+town.roadsZ.at(-1)!)/2;
  const x=Math.abs(b.x)+b.hx,z=Math.abs(b.z-centerZ)+b.hz;
  return x<=town.width/2-2 && z<=town.depth/2-2 &&
    Math.hypot(Math.max(0,x-(town.width/2-10)),Math.max(0,z-(town.depth/2-10)))<=8;
}
export function streetBounds(town: Town): Bounds[] {
  return town.streets.flatMap(s=>s.points.slice(1).map((b,i)=>{
    const a=s.points[i];return {x:(a[0]+b[0])/2,z:(a[1]+b[1])/2,hx:Math.abs(a[0]-b[0])/2+s.width/2,hz:Math.abs(a[1]-b[1])/2+s.width/2};
  }));
}
/** No world state: unlocking a shop cannot suddenly grow a tree through its patio. */
export function townDecor(town: Town): Decor[] {
  const out: Decor[]=[],occupied:Bounds[]=[],reserved=[...reservedBounds(town),...streetBounds(town)];
  const add=(d:Decor)=>{
    const b=decorBounds(d);
    if(!insideIsland(town,b))return false;
    if(reserved.some(r=>overlaps(b,r)) || (d.role.startsWith('tree_') && occupied.some(r=>overlaps(b,r))))return false;
    occupied.push(b);out.push(d);return true;
  };
  const box=(p:Point3,scale:Point3,shade:string,role:Decor['role']='detail',rotation=0)=>add({p,scale,shade,role,rotation});
  for(const lot of town.lots) {
    const [row,col]=lot.id.split(':').map(Number),r=seededRandom(town.seed+row*8191+col*131+2909),[x,z]=parcel(lot);
    const side=r()<.5?-1:1,edge=7.85+r()*.3;
    // Individual short panels leave real gaps and an open south entrance/gate.
    const style=Math.floor(r()*4),height=.5+r()*.55;
    if(style!==3) for(const dz of [-4.8,-2.4,0,2.4,4.8]) {
      if(r()<.2)continue;
      if(style===1) {
        for(const y of [.3,.72])box([x+side*edge,height*y,z+dz],[.14,.12,1.8],'#eee3c9');
        for(const offset of [-.75,-.25,.25,.75])box([x+side*edge,height/2,z+dz+offset],[.22,height,.16],'#eee3c9');
      } else box([x+side*edge,height/2,z+dz],[style===0?.65:.28,height,1.8],style===0?'#b0c08b':'#a6a397',style===0?'hedge':'detail');
    }
    // A pair of gateposts frames the open side of the path, never across it.
    if(style<2) for(const dx of [-2,2]) box([x+dx,.5,z+8],[.22,1,.22],'#d2bd91');
    if(r()<.58) box([x-3,1.8,z+8.2],[.6,3.6,.6],'#ffffff','streetlight');
    // Benches and signposts share the same colored cube batch as fences.
    if(r()<.38) {
      box([x+4,.48,z+8],[1.5,.15,.5],'#a58261');
      box([x+4,.8,z+7.8],[1.5,.5,.12],'#b4926e');
      for(const dx of [-.55,.55]) box([x+4+dx,.22,z+8],[.12,.35,.4],'#6c7770');
    }
    if(r()<.25) {
      box([x-5.8,.7,z+8],[.12,1.4,.12],'#8c765f');
      box([x-5.8,1.55,z+8],[.85,.28,.1],'#dec9a2');
    }
    // Small flower beds stay outside the protected lot interior.
    if(r()<.65) for(let i=0;i<5;i++) box([x-3+i*.35,.15+r()*.12,z-8],[.22,.3,.3],['#d69b9f','#e6cc87','#b2c4a0'][Math.floor(r()*3)]);
  }
  const r=seededRandom(town.seed+4771);
  const tree=(x:number,z:number,height:number,kind?:number)=>{
    const species=kind??Math.floor(r()*3),width=height*(species===1?.43:.66),lean=(r()-.5)*.08;
    return add({role:(['tree_a','tree_b','tree_c'] as const)[species],p:[x,0,z],scale:[width,height,width*(.85+r()*.2)],rotation:r()*Math.PI*2,lean,
      shade:(species===2?['#e9b1b8','#e4c78f','#bacb9a']:['#b5c992','#91b4a3','#d0c28e','#acc39e'])[Math.floor(r()*(species===2?3:4))]});
  };
  // Two staggered, jittered bands make groves rather than a single dotted row.
  // Coherent waves vary density and height; footprint rejection leaves clearings.
  const minZ=town.roadsZ[0],maxZ=town.roadsZ.at(-1)!;
  const west=town.roadsX[0]+63,east=town.roadsX.at(-1)!-63;
  const density=(x:number,z:number)=>.88+.12*Math.sin(x*.19+town.seed)*Math.cos(z*.16-town.seed);
  for(const band of [0,1,2]) {
    for(let x=west-62+band*1.4;x<=east+62;x+=2.8) for(const z of [minZ-4.7-band*2.5,maxZ+4.7+band*2.5]) {
      if(r()<density(x,z))tree(x+(r()-.5)*1.2,z+(r()-.5)*.6,3.6+r()*2.6);
    }
    for(let z=minZ+5+band*1.4;z<maxZ-4;z+=2.8) {
      if(r()<density(west-68,z))tree(west-67.7-band*2.5+(r()-.5)*.6,z+(r()-.5),3.5+r()*2.6);
    }
  }
  // The east creek starts at x=70.5, wandering +/-1.1m with a 1.6m bank.
  // Slender evergreens fit between its conservative bank envelope and the road.
  for(let z=minZ+5;z<maxZ-4;z+=2.5) if(r()<density(east+67,z))
    tree(east+66.55+(r()-.5)*.2,z+(r()-.5),2.6+r()*.6,1);
  for(const lot of town.lots) {
    const [x,z]=parcel(lot),[row]=lot.id.split(':').map(Number);
    // Yard pairs clear even the largest house/paddock envelope. Blossoms
    // frame plazas, while trees along the narrow path verges stay small.
    for(const side of [-1,1]) for(const dx of [4,6,4.5])
      if(tree(x+side*dx,z+(row%2===0?8.5:-8.5),1.5+r()*.35,lot.district==='plaza'?2:dx===4.5?1:undefined))break;
    if(lot.entry || lot.memberSlot!==undefined)continue;
    // Offset clusters in open lawns; leave the central activity/entrance area free.
    for(const side of [-1,1]) {
      const cx=x+side*(3.7+r()),cz=z-2+r()*2;
      for(let i=0;i<18;i++) {
        const angle=r()*Math.PI*2,reach=Math.sqrt(r())*4.2;
        const tx=cx+Math.cos(angle)*reach,tz=cz+Math.sin(angle)*reach;
        if(Math.abs(tx-x)<2.2 && tz>z-2)continue;
        tree(tx,tz,3.2+r()*2.4,lot.district==='plaza'?2:undefined);
      }
    }
  }
  return out;
}
