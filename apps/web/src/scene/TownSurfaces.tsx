import {useEffect, useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {Town} from './layout/town';
import {curve} from './layout/streets';
import type {XY} from './worldTypes';
import {colored, roadDetails} from './layout/roadDetails';
import {parcel} from './layout/variety';
import {seededRandom} from './worldTypes';

/** A continuous ribbon: no individual road-tile meshes or per-frame allocations. */
function ribbon(points: XY[], width: number, y: number) {
  const positions:number[]=[], indices:number[]=[];
  points.forEach(([x,z],i)=>{
    const a=points[Math.max(0,i-1)], b=points[Math.min(points.length-1,i+1)];
    const length=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
    const nx=-(b[1]-a[1])/length*width/2, nz=(b[0]-a[0])/length*width/2;
    positions.push(x+nx,y,z+nz,x-nx,y,z-nz);
    if(i) {const n=i*2;indices.push(n-2,n,n-1,n-1,n,n+1);}
  });
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setIndex(indices);g.computeVertexNormals();return g;
}
function merge(parts: THREE.BufferGeometry[]) {
  // Normalize attributes/indexing across circle, shape and ribbon primitives.
  const normalized=parts.map(g=>{const n=g.index?g.toNonIndexed():g.clone();n.deleteAttribute('uv');return n;});
  const result=mergeGeometries(normalized);
  [...parts,...normalized].forEach(g=>g.dispose());return result;
}
export function TownSurfaces({town}:{town:Town}) {
  const surfaces=useMemo(()=>{
    const road:THREE.BufferGeometry[]=[], path:THREE.BufferGeometry[]=[], green:THREE.BufferGeometry[]=[];
    for(const street of town.streets) {
      const geometry=ribbon(street.points,street.width,street.kind==='road'?.025:.045);
      (street.kind==='road'?road:path).push(street.kind==='road'?colored(geometry,'#92978b'):geometry);

    }
    road.push(...roadDetails(town));
    for(const lot of town.lots.filter(l=>l.district==='park'||l.memberSlot!==undefined)) {
      const [x,z]=parcel(lot),r=seededRandom(town.seed+x*131+z*71);
      green.push(new THREE.PlaneGeometry(13+r()*2,13+r()*2).rotateX(-Math.PI/2)
        .translate(x,.012,z));
    }
    const bank=town.roadsX.at(-1)!+7.5;
    const creek=curve(Array.from({length:13},(_,i):XY=>[bank+Math.sin(i*.9+town.seed)*1.1,
      town.roadsZ[0]+5+i/12*(town.depth-30)]),96);
    return {road:merge(road),path:merge(path),green:green.length?merge(green):null,
      bank:ribbon(creek,3.2,.016),water:ribbon(creek,2,.022)};
  },[town]);
  useEffect(()=>()=>Object.values(surfaces).forEach(g=>g?.dispose()),[surfaces]);
  return <group name="town-surfaces">
    <mesh geometry={surfaces.road} receiveShadow><meshStandardMaterial vertexColors roughness={1}/></mesh>
    <mesh geometry={surfaces.path} receiveShadow><meshStandardMaterial color="#d8c6a2" roughness={1}/></mesh>
    {surfaces.green&&<mesh geometry={surfaces.green} receiveShadow><meshStandardMaterial color="#a8be89" roughness={1}/></mesh>}
    <mesh geometry={surfaces.bank} receiveShadow><meshStandardMaterial color="#a9b393" roughness={1}/></mesh>
    <mesh geometry={surfaces.water}><meshStandardMaterial color="#7dabb5" roughness={.35}/></mesh>
  </group>;
}
