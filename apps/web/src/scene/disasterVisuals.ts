import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {Disaster} from '../api/types';
import type {Town} from './layout/town';

// All props and particles share one instanced primitive atlas and one material.
// The vertex shader collapses unused atlas shapes; no texture/model downloads.
// Shapes: box, faceted sphere, ground ring, soft billboard, cone, heart, sparkle.
// Motion ids: 1 rain, 2 ember, 3 wisp, 4 ripple, 5 cloud, 6 glow,
// 7 meteor, 8 celebration, 9 shockwave, 10 flash, 11 scaffold, 12 wilt, 13 bug.
export type VfxPart = {shape:number; p:[number,number,number]; s:[number,number,number]; color:string; fx?:number; phase?:number; alpha?:number; yaw?:number};
export const repairProgress = (d:Disaster) => Math.min(1,Math.max(0,Math.min(d.checkins/Math.max(1,d.target_checkins),d.people/Math.max(1,d.target_people))));
export const lightningIntensity = (seconds:number, reduced:boolean) => reduced ? 0 : Math.max(0,1-Math.abs((seconds%12)-4)/.65)*.65;
export function effectCenter(d:Disaster|undefined|null,town:Town):[number,number] {
  return (town.lots.find(l=>!!d?.closed_building&&l.entry?.id===d.closed_building) ?? town.lots.find(l=>d?.kind==='blight'?l.district==='park':l.entry?.id==='pet_shelter'))?.center ?? [0,0];
}
export function primitiveAtlas() {
  const heart=new THREE.Shape();heart.moveTo(0,-.5);heart.bezierCurveTo(-1,.1,-.5,.8,0,.35);heart.bezierCurveTo(.5,.8,1,.1,0,-.5);
  const star=new THREE.Shape();for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?.13:.5;const px=Math.sin(a)*r,py=Math.cos(a)*r;if(i===0)star.moveTo(px,py);else star.lineTo(px,py);}star.closePath();
  const shapes=[new THREE.BoxGeometry(1,1,1),new THREE.IcosahedronGeometry(.5,1),new THREE.RingGeometry(.8,1,24).rotateX(-Math.PI/2),new THREE.PlaneGeometry(1,1),new THREE.ConeGeometry(.5,1,8),new THREE.ShapeGeometry(heart),new THREE.ShapeGeometry(star)];
  const parts=shapes.map((source,i)=>{const g=source.index?source.toNonIndexed():source.clone();g.setAttribute('shapeId',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(i),1));if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));source.dispose();return g;});
  const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());geometry.clearGroups();return geometry;
}
export function disasterParts(d:Disaster|null|undefined,town:Town,low:boolean,celebrate=false,celebrationCenter?:[number,number]):VfxPart[] {
  const out:VfxPart[]=[];const [x,z]=effectCenter(d,town);
  const add=(shape:number,p:VfxPart['p'],s:VfxPart['s'],color:string,fx=0,phase=0,alpha=1,yaw=0)=>out.push({shape,p,s,color,fx,phase,alpha,yaw});
  const box=(p:VfxPart['p'],s:VfxPart['s'],c:string,fx=0)=>add(0,p,s,c,fx);
  if(celebrate) {
    const [x,z]=celebrationCenter??effectCenter(d,town);
    for(let i=0;i<(low?30:90);i++)add(i%4===0?5:i%4===1?6:0,[x+Math.sin(i*2.4)*5,2+(i%6)*.6,z+Math.cos(i*2.4)*5],[.18,.3,.07],['#ffd488','#8cdec7','#f5a9bf','#fff4d7'][i%4],8,i*.73);
  }
  if(!d)return out;
  if(d.kind==='scorch') {
    const cx=x+4,cz=z+4;
    add(1,[cx,.08,cz],[8,.2,7],'#6a5553',0,0,.7);
    add(1,[cx,.18,cz],[5.4,.35,4.8],'#50374b');
    add(2,[cx,.43,cz],[1.4,1,1.2],'#ef955e',6,0,.7);
    for(let i=0;i<16;i++){const a=i*Math.PI/8;add(1,[cx+Math.cos(a)*2.2,.4,cz+Math.sin(a)*1.9],[1.2,.8,1.1],i%3?'#483b50':'#655069');add(0,[cx+Math.cos(a)*1.7,.38,cz+Math.sin(a)*1.5],[.2,.035,.8],'#ffb15e',6,i,1,-a);}
    for(let i=0;i<(low?10:24);i++)add(1,[cx+Math.sin(i*2.3)*1.6,.5,cz+Math.cos(i*2.3)*1.3],[.14,.2,.14],'#ffcb79',2,i*.71);
    for(let i=0;i<(low?3:8);i++)add(3,[cx+Math.sin(i)*.8,1,cz],[3+i*.2,3+i*.2,1],'#cbb9b5',3,i*.8,.35);
    add(1,[cx,1,cz],[1.2,1.2,1.2],'#ffe0a0',7);
    for(let i=1;i<12;i++)add(3,[cx,1,cz],[1.5+i*.12,1.5+i*.12,1],'#ffbb7b',7,i*.06,.45);
    add(2,[cx,.23,cz],[1,1,1],'#ffd49a',9,0,.7);
    add(3,[cx,.6,cz],[13,13,1],'#ffca80',10,0,.75);
    // A little wooden repair gate, with scaffold height driven by both quotas.
    for(const dx of [-2.8,2.8])box([x+dx,1,z+5],[.24,2,.25],'#8f634a');
    box([x,1.3,z+5],[6,.35,.22],'#c59565');box([x,.65,z+5],[6,.25,.22],'#dfb580');
    box([x,1.65,z+5.04],[2.4,.8,.15],'#f0d5a0');
    const progress=repairProgress(d);
    for(let level=0;level<Math.ceil(progress*4);level++){const h=1+level*1.1;for(const dx of [-3.3,3.3])box([x+dx,h/2,z+1],[.15,h,.15],'#b99774',11);box([x,h,z+1],[7,.15,.7],'#dbc398',11);}
  }
  if(d.kind==='outbreak') {
    const vx=x+4,vz=z+4;
    add(1,[vx,1.25,vz],[3.1,2.4,4.8],'#faf0d6');
    box([vx,.85,vz],[2.6,.75,4.1],'#76b8ad');box([vx,1.55,vz+1.65],[2.05,.75,.13],'#597e92');
    box([vx,1.5,vz+1.74],[.08,.85,.04],'#f8ecd5');
    for(const dx of [-1.25,1.25])for(const dz of [-1.35,1.35]){add(1,[vx+dx,.48,vz+dz],[.5,.9,.9],'#4d4a5a');add(1,[vx+dx*1.04,.48,vz+dz],[.52,.4,.4],'#e5d8b7');}
    add(1,[vx,2.55,vz],[.75,.3,.55],'#ffd8a1',6);
    box([vx,1.3,vz-2.12],[.8,.2,.06],'#fff7df');box([vx,1.3,vz-2.12],[.2,.8,.06],'#fff7df');
    for(let i=0;i<4;i++){const px=x-3+i*1.6;box([px,.12,z+6],[.6,.12,.6],'#e9c5a0');add(4,[px,.52,z+6],[.5,.8,.5],'#eaa775');add(2,[px,.6,z+6],[.16,1,.16],'#fff0cb');}
    // Paw decals continue to the island edge when the pets are away.
    const steps=d.pets_away?26:7;
    for(let i=0;i<steps;i++){const px=x-2+Math.sin(i*.8)*.5,pz=z+3+i*(d.pets_away?Math.max(1.15,(town.depth/2-z+6)/25):1.15);const opacity=d.pets_away?.42:.65;add(1,[px,.13,pz],[.34,.035,.3],'#ffe0b2',d.pets_away?6:0,i,opacity);for(let j=0;j<3;j++)add(1,[px+(j-1)*.17,.14,pz+.23],[.13,.025,.13],'#ffe0b2',0,0,opacity);}
  }
  if(d.kind==='blackout') {
    for(let i=0;i<(low?65:180);i++)add(0,[((i*17)%97)-48,0,((i*23)%83)-40],[.035,.8+(i%3)*.2,.035],'#bad7e0',1,i*.79,.55);
    for(let i=0;i<(low?6:16);i++)add(2,[((i*17)%79)-39,.16,((i*29)%67)-33],[1,1,1],'#b5d4d5',4,i*.8,.36);
    for(let i=0;i<(low?9:18);i++){const cluster=Math.floor(i/3),lobe=i%3;add(1,[-33+(cluster%3)*31+lobe*3.2,18+(lobe===1?1:0),-27+Math.floor(cluster/3)*45],[10+lobe*2,3.4,8],lobe===1?'#c7c2d4':'#aaaec6',5,cluster*2,.35);}
    for(const lot of town.homes.values())for(const dx of [-1.2,1.2])add(3,[lot.center[0]+dx,1.7,lot.center[1]+2],[.7,.9,1],'#ffd9a0',6,0,.42);
  }
  if(d.kind==='blight') {
    const gardens=town.lots.filter(l=>l.entry?.id==='garden'||l.district==='park'&&!l.entry);
    for(const lot of gardens){const [gx,gz]=lot.center;add(1,[gx,.08,gz],[9,.15,8],'#c6ae7d',0,0,.55);
      for(let i=0;i<7;i++){const px=gx-3+i, pz=gz+Math.sin(i*2)*2;box([px,.48,pz],[.09,.8,.09],'#ac976b');add(1,[px+.15,.8,pz],[.7,.16,.4],'#ceba87',12,i);}
      for(let i=0;i<(low?3:7);i++){const px=gx+Math.sin(i*2.7)*3,pz=gz+Math.cos(i*2.7)*2;add(1,[px,.34,pz],[.48,.3,.65],'#a77863',13,i);for(const dx of [-.13,.13])add(1,[px+dx,.48,pz+.22],[.12,.12,.12],'#fff2cd',13,i);}
      for(let i=0;i<(low?2:5);i++)add(3,[gx+Math.sin(i*3)*3,.7,gz+Math.cos(i)*2],[3,1.5,1],'#dbc599',3,i,.13);
    }
  }
  return out;
}
export const vfxVertex = `
attribute float shapeId;
attribute vec4 effect;
uniform float time;
uniform float age;
uniform float still;
varying vec3 shade;
varying vec2 tex;
varying float alpha;
varying float soft;
void main(){
  float fx=effect.y, phase=effect.z;
  float selectedShape=1.-step(.1,abs(shapeId-effect.x));
  vec3 p=position; vec3 offset=vec3(0.); float fade=1.;
  float t=time*(1.-still);
  if(fx==1.) { offset.y=18.-mod(t*10.+phase*13.,18.);offset.x=-mod(t*2.+phase,3.); }
  if(fx==2. || fx==3.) {float h=mod(t*.65+phase,5.);offset=vec3(sin(h+phase)*.5,h,0.);fade=sin(h/5.*3.14159);if(fx==3.)p*=1.+h*.28;}
  if(fx==4.) {float h=fract(t*.4+phase);p*=.3+h*1.8;fade=1.-h;}
  if(fx==5.)offset.x=sin(t*.12+phase)*3.;
  if(fx==6.)fade=.78+.22*sin(t*1.7+phase);
  if(fx==7.) {float h=max(0.,1.-age+phase);offset=vec3(-h*16.,h*23.,-h*8.);fade=(1.-step(1.,age))* (1.-still);}
  if(fx==8.) {offset=vec3(sin(phase)*age,age*2.-age*age*.3,cos(phase)*age)*(1.-still);fade=mix(max(0.,1.-age/4.),1.,still);}
  if(fx==9.) {p*=1.+max(0.,age-1.)*12.;fade=max(0.,1.-(age-1.)/.8)*step(1.,age)*(1.-still);}
  if(fx==10.)fade=max(0.,1.-abs(age-1.08)/.24)*(1.-still);
  if(fx==11.)p.y*=mix(min(1.,age*1.5),1.,still);
  if(fx==12.) {p.x+=p.y*.6+sin(t*.7+phase)*.08;p.y*=.8;}
  if(fx==13.)offset=vec3(sin(t*.6+phase)*.35,0.,cos(t*.6+phase)*.25);
  vec4 local=instanceMatrix*vec4(p,1.); local.xyz+=offset;
  vec4 mv=modelViewMatrix*local;
  if(effect.x==3. || effect.x==5. || effect.x==6.) {vec4 center=modelViewMatrix*vec4(instanceMatrix[3].xyz+offset,1.);mv=center;mv.xy+=p.xy*vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz))*length(modelMatrix[0].xyz);}
  gl_Position=projectionMatrix*mv;
  if(selectedShape<.5)gl_Position=vec4(2.,2.,2.,1.);
  float light=.8+.2*max(0.,dot(normalize(normal),normalize(vec3(-.4,1.,.5))));
  shade=instanceColor*(fx==2.||fx==6.||fx==7.||fx==10.?1.25:light);
  soft=step(2.9,effect.x)*(1.-step(3.1,effect.x));tex=uv;alpha=effect.w*fade*selectedShape;
}`;
export const vfxFragment = `
varying vec3 shade;varying vec2 tex;varying float alpha;varying float soft;

void main(){
  float a=alpha*mix(1.,pow(max(0.,1.-length(tex-.5)*2.),2.),soft);
  gl_FragColor=vec4(shade,a);
  if(a<.015)discard;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
