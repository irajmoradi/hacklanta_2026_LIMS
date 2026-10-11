import * as THREE from 'three';
import type {Town} from './town';
import {seededRandom} from '../worldTypes';

export function colored(geometry: THREE.BufferGeometry, color: string) {
  const shade=new THREE.Color(color),colors=new Float32Array(geometry.attributes.position.count*3);
  for(let i=0;i<colors.length;i+=3)shade.toArray(colors,i);
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));return geometry;
}
const tile=(x:number,z:number,w:number,d:number,color:string,y=.032)=>colored(new THREE.PlaneGeometry(w,d).rotateX(-Math.PI/2).translate(x,y,z),color);
/** All paving, crossings and plazas are baked into the existing road draw call. */
export function roadDetails(town: Town) {
  const parts:THREE.BufferGeometry[]=[];
  for(const street of town.streets.filter(s=>s.kind==='road')) {
    const r=seededRandom(town.seed+street.id.split('').reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0)|0,0));
    for(let i=1;i<street.points.length;i+=2) {
      const a=street.points[i-1],b=street.points[Math.min(i+1,street.points.length-1)];
      const horizontal=a[1]===b[1],length=Math.hypot(b[0]-a[0],b[1]-a[1])-street.width-1;
      const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,style=Math.floor(r()*5);
      if(style>2)continue;
      const width=street.width-.2;
      parts.push(tile(x,z,horizontal?length:width,horizontal?width:length,['#b2a58b','#a9aaa0','#b88e79'][style]));
      if(style===0)continue; // Quiet dirt lane; stone and brick have staggered joints.
      const step=style===1?.85:.7;
      for(let along=-length/2+.5;along<length/2-.5;along+=step) for(let across=-width/2+.42;across<width/2-.3;across+=.65) {
        const u=along+(Math.round(across/.65)%2)*.13,v=across;
        parts.push(tile(x+(horizontal?u:v),z+(horizontal?v:u),horizontal?step-.08:.55,horizontal?.55:step-.08,
          style===1?(r()<.5?'#bfc0b2':'#aaa99b'):(r()<.5?'#c6a28c':'#b79683'),.036));
      }
    }
  }
  // A flush paved square leaves both intersecting avenues fully walkable.
  for(const x of [-21,...(town.seed%2?[21]:[])]) {
    const z=-21;
    parts.push(tile(x,z,5.1,5.1,'#d1bfa1',.04));
    parts.push(tile(x,z,3.5,3.5,'#bdad93',.042));
    for(const side of [-1,1]) for(let stripe=-1.6;stripe<=1.6;stripe+=.8)
      parts.push(tile(x+stripe,z+side*4,.42,1.5,'#eee9d4',.042));
  }
  return parts;
}
