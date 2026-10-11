import { AmbientLight, Box3, Color, DirectionalLight, Frustum, Group, Matrix4, Mesh, OrthographicCamera, Raycaster, Scene, Vector3, WebGLRenderer } from 'three';
import { api } from '../src/api/client';
import { loadModel, cloneModel } from '../src/scene/OptionalModel';
import { acquireHead, attachHead } from '../src/scene/headAssets';
import { attachCosmetic } from '../src/scene/cosmeticAssets';
import { geometryBounds, geometryPoints, headFrame } from '../src/scene/headFit';
import { rigAnchor } from '../src/scene/rigAnchors';
import { outfitLayers } from '../src/scene/outfitLayers';
import type { EquippedItem } from '../src/api/types';
import { catalog } from '../../../packages/catalog/dist/catalog';
import { hatOpening } from '../src/scene/hatFit';
import { prepareEmoteRig } from '../src/scene/emotes';
import { bodyVisibility } from './bodyVisibility';


const renderer = new WebGLRenderer({ canvas: document.querySelector('canvas')!, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(480, 360); renderer.setScissorTest(true);
const scene = new Scene(); scene.background = new Color('#edf0f3');
scene.add(new AmbientLight(0xffffff, 2));
const light = new DirectionalLight(0xffffff, 2.5); light.position.set(3, 5, 4); scene.add(light);
const base = await loadModel('villager_base');
if (!base) throw Error('Missing villager_base');
let rig = cloneModel(base, 1.8) as Group;
prepareEmoteRig(rig);
const baseBodyHeight = bodyVisibility(rig).height;
scene.add(rig);
const entries = catalog.entries.filter(e => ['torso', 'head', 'face', 'neck'].includes(e.slot ?? ''));
const sources = new Map(await Promise.all(entries.map(async e => {
  const source = await loadModel(e.asset!.glb.split('/').pop()!.replace('.glb', ''));
  if (!source) throw Error(`Missing ${e.id}`);
  return [e.id, source] as const;
})));
const serial = (b: Box3) => ({min:b.min.toArray(), max:b.max.toArray()});
// Cover every pair of factor values, including bare slots, every neck item and mantle layering.
const factors = ['torso', 'head', 'face', 'neck'].map(slot => ['', ...entries.filter(e => e.slot === slot).map(e=>e.id)]);
factors.push(['', 'champion_mantle']);
const pairs = (row: string[]) => row.flatMap((v,i)=>row.slice(i+1).map((w,j)=>JSON.stringify([i,v,i+j+1,w])));
const uncovered = new Set<string>();
for(let i=0;i<factors.length;i++) for(let j=i+1;j<factors.length;j++) for(const a of factors[i]) for(const b of factors[j]) uncovered.add(JSON.stringify([i,a,j,b]));
const requiredPairs = uncovered.size;
const combinations: string[][] = [];
while(uncovered.size) {
  const [i,a,j,b] = JSON.parse(uncovered.values().next().value!);
  const row = factors.map(()=> ''); row[i]=a; row[j]=b;
  for(let k=0;k<factors.length;k++) if(k!==i&&k!==j) {
    let best=-1, choice='';
    for(const value of factors[k]) {
      row[k]=value;
      const score=pairs(row).filter(p=>uncovered.has(p)).length;
      if(score>best){best=score;choice=value;}
    }
    row[k]=choice;
  }
  combinations.push([...row]); pairs(row).forEach(p=>uncovered.delete(p));
}
// Explicit no-outfit and R-94 loadout; non-wearables must never cover the body.
combinations.push(['', '', '', '', '']);
combinations.push(['', 'hat_festival', '', '', '', 'decor_flowers', 'house_backyard', 'pet_dog']);
let attachments: NonNullable<ReturnType<typeof attachCosmetic>>[] = [];
let detach: (()=>void)|null = null, lease: ReturnType<typeof acquireHead>|null = null;
const petSource = await loadModel('pet_dog');
let pet: Group | null = null;
async function person(seat: number) {
  attachments.forEach(a=>a.dispose());attachments=[];detach?.();lease?.release();scene.remove(rig);
  api.user='13370000-0000-4000-8000-000000000001';
  const manifest=seat ? await api.avatar(`13370000-0000-4000-8000-00000000000${seat}`) : undefined;
  rig=cloneModel(base!,1.8,manifest?.body.colors) as Group;scene.add(rig);
  prepareEmoteRig(rig);
  rig.position.set(-6, 0, -24);
  detach=null;lease=null;
  if(manifest) {
    if(!manifest.body.head_glb_url)throw Error(`Missing generated head for seat ${seat}`);
    lease=acquireHead(manifest.body.head_glb_url,'glb');
    const source=await lease.promise;
    let vertices=0;const hashes:string[]=[];
    const positions:Float32Array[]=[];
    source.traverse(n=>{if(n instanceof Mesh){vertices+=n.geometry.getAttribute('position').count;positions.push(new Float32Array(n.geometry.getAttribute('position').array));}});
    for(const array of positions) hashes.push(Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',array.buffer as ArrayBuffer))).map(v=>v.toString(16).padStart(2,'0')).join(''));
    detach=attachHead(rig,source);
    if(!detach)throw Error('Missing head bone');
    // Reproduce a pointer arriving between the async head fit and the next draw.
    new Raycaster(new Vector3(-6,2,-20),new Vector3(0,0,-1)).intersectObject(rig,true);
    return {headUrl:manifest.body.head_glb_url,vertices,hashes};
  }
  return {headUrl:'villager_base',vertices:0,hashes:[]};
}
function outfit(row: string[]) {
  attachments.forEach(a=>a.dispose());attachments=[];
  const ids=[...new Set(row.filter(Boolean))];
  if(pet) {scene.remove(pet);pet.traverse(n=>{if(n instanceof Mesh)(Array.isArray(n.material)?n.material:[n.material]).forEach(m=>m.dispose());});pet=null;}
  if(ids.includes('pet_dog')) {
    if(!petSource)throw Error('Missing pet_dog');
    pet=cloneModel(petSource,.65) as Group;
    pet.position.copy(rig.position).add(new Vector3(.65,.05,-.35));scene.add(pet);
  }
  const items=ids.map(id=>{const e=catalog.entries.find(e=>e.id===id)!;return {item_id:id,slot:e.slot as EquippedItem['slot'],asset_key:e.asset!.glb.split('/').pop()!.replace('.glb','')};});
  for(const item of outfitLayers(items)) {const a=attachCosmetic(rig,sources.get(item.item_id)!,item);if(!a)throw Error(`Cannot attach ${item.item_id}`);attachments.push(a);}
  const head=rigAnchor(rig,'Head')!, spine=rigAnchor(rig,'Spine')!;
  const generated=head.children.find(n=>n.userData.generatedHead);
  const actualHead=generated ? geometryBounds(generated,head) : geometryBounds(rig,head,n=>['head','nose','eye','eye001','hair_cap'].includes(n.name));
  const frame=generated?.userData.fitFrame ?? headFrame(actualHead,geometryPoints(rig,head,n=>['head','hair_cap'].includes(n.name.toLowerCase())));
  if(!generated) {const eyes=geometryBounds(rig,head,n=>/^eye/.test(n.name));frame.eyeLine=eyes.getCenter(new Vector3()).y;}
  const face=new Box3(new Vector3(frame.center.x-frame.faceWidth*.28,frame.eyeLine-frame.size.y*.18,frame.front-frame.size.z*.22),new Vector3(frame.center.x+frame.faceWidth*.28,frame.eyeLine+frame.size.y*.09,frame.front+frame.size.z*.03));
  // The torso envelope includes its arms: sleeve geometry must not be squeezed into the chest.
  const torso=geometryBounds(rig,spine,n=>['torso','sleeve_L','sleeve_R','forearm_L','forearm_R'].includes(n.name));
  const envelope=torso.clone().expandByVector(torso.getSize(new Vector3()).multiplyScalar(.125));
  const measurements=attachments.map(a=>{
    const id=a.instance.name.slice(9),e=entries.find(e=>e.id===id)!;
    const b=geometryBounds(a.instance,head), sb=geometryBounds(a.instance,spine);
    const failures:string[]=[];
    // Whole item AABB is the gate; component boxes identify offending geometry.
    const collisions:string[]=[];
    a.instance.traverse(n=>{if(n instanceof Mesh && geometryBounds(n,head).intersectsBox(face))collisions.push(n.name);});
    if(e.slot!=='face' && b.intersectsBox(face))failures.push('face-intersection');
    if(e.slot==='torso' && !envelope.containsBox(sb))failures.push('torso-envelope');
    let eyeError:number|undefined,earError:number|undefined;
    if(e.slot==='face') {const c=b.getCenter(new Vector3());eyeError=Math.max(Math.abs(c.y-frame.eyeLine)/frame.size.y,Math.abs(c.x-frame.center.x)/frame.faceWidth);if(eyeError>.05)failures.push('eye-line');}
    if(id==='hat_headphones') {
      const cups:Vector3[]=[];a.instance.traverse(n=>{if(n instanceof Mesh && /^ear_cushion/.test(n.name))cups.push(geometryBounds(n,head).getCenter(new Vector3()));});cups.sort((a,b)=>a.x-b.x);
      earError=cups.length<2 ? 1 : Math.max(cups[0].distanceTo(frame.ears[0]),cups.at(-1)!.distanceTo(frame.ears[1]))/frame.earWidth;
      if(earError>.1)failures.push('ear-points');
    }
    let seating: unknown;
    if (e.slot === 'head' && id !== 'hat_headphones') {
      const opening = hatOpening(a.instance, id);
      a.instance.updateMatrix();
      const points = opening.map(p => p.applyMatrix4(a.instance.matrix));
      const band = new Box3().setFromPoints(points), center = band.getCenter(new Vector3());
      const skull = frame.skull;
      const centerError = Math.max(Math.abs(center.x-skull.center.x)/frame.size.x, Math.abs(center.z-skull.center.z)/frame.size.z);
      const crownExcess = (b.max.y-skull.top)/skull.height;
      const brimHeight = (center.y-frame.bottom)/skull.height;
      // Raycast the actual head surface, not overlapping whole-item bounding boxes.
      // Cast down through the inner opening center; negative gap is seated intersection.
      const origin = head.localToWorld(new Vector3(center.x, frame.top + frame.size.y, center.z));
      const direction = new Vector3(0,-1,0).transformDirection(head.matrixWorld);
      const ray = new Raycaster(origin, direction);
      const meshes: Mesh[] = [];
      (generated ?? rig).traverse(n => { if(n instanceof Mesh && n.visible && !n.parent?.userData.cosmetic && (generated || ['head','hair_cap'].includes(n.name))) meshes.push(n); });
      const hits = ray.intersectObjects(meshes, false);
      const surface = hits.length ? head.worldToLocal(hits[0].point.clone()).y : -Infinity;
      const radialGaps: number[] = [];
      for (const p of points.filter((_,i)=>i%Math.max(1,Math.floor(points.length/32))===0)) {
        const radial = new Vector3(p.x-center.x,0,p.z-center.z);
        const radius = radial.length(); if(radius<.001)continue;
        radial.normalize();
        const start = new Vector3(center.x,p.y,center.z).addScaledVector(radial,frame.size.length()*2);
        const contactRay = new Raycaster(head.localToWorld(start),radial.clone().negate().transformDirection(head.matrixWorld));
        const contact = contactRay.intersectObjects(meshes,false)[0];
        if(contact) {
          const hit = head.worldToLocal(contact.point.clone());
          radialGaps.push(Math.max(0,radius-Math.hypot(hit.x-center.x,hit.z-center.z))/skull.height);
        }
      }
      // At least one point of the inner band must touch the actual skull/hair surface.
      const gap = radialGaps.length ? Math.min(...radialGaps) : Infinity;
      if(gap>.02)failures.push('seat-gap');
      if(centerError>.04)failures.push('seat-center');
      if(band.min.y<=frame.eyeLine+frame.size.y*.09 || center.y>=skull.top || brimHeight<.80 || brimHeight>.85)failures.push('brim-height');
      if(crownExcess>.06)failures.push('crown-clearance');
      seating={gap,radialSamples:radialGaps.length,maxRadialGap:Math.max(...radialGaps),verticalGap:Math.max(0,band.min.y-surface)/skull.height,centerError,crownExcess,brimHeight,band:serial(band),surface,skull};
    }
    const anchor=e.slot==='torso' ? torso : e.slot==='neck' ? geometryBounds(rig,spine,n=>n.name==='neck') : actualHead;
    const box=e.slot==='torso'||e.slot==='neck'?sb:b;
    const gap=new Vector3(Math.max(0,anchor.min.x-box.max.x,box.min.x-anchor.max.x),Math.max(0,anchor.min.y-box.max.y,box.min.y-anchor.max.y),Math.max(0,anchor.min.z-box.max.z,box.min.z-anchor.max.z)).length();
    if(gap>.1)failures.push('detached');
    return {id,bounds:serial(b),eyeError,earError,seating,anchorGap:gap,collisions,failures};
  });
  const target=new Vector3(0,1.0,0).add(rig.position),span=2.3;
  const culledBody: string[] = [];
  for(const [i,direction] of [new Vector3(0,0,1),new Vector3(1,0,0)].entries()) {
    const camera=new OrthographicCamera(-span/3,span/3,span/2,-span/2,.01,100);camera.position.copy(target).addScaledVector(direction,4);camera.lookAt(target);camera.updateMatrixWorld();
    const frustum=new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    for(const name of ['torso','leg_L','leg_R']) {
      const mesh=rig.getObjectByName(name)!;
      if(mesh.frustumCulled&&!frustum.intersectsObject(mesh))culledBody.push(`${i}:${name}`);
    }
    renderer.setViewport(i*240,0,240,360);renderer.setScissor(i*240,0,240,360);renderer.render(scene,camera);
  }
  const body = bodyVisibility(rig);
  const bodyFailures = body.parts.length !== 3 || body.height < baseBodyHeight * .8 || culledBody.length ? [{id:'base-body',check:'visible-torso-and-legs'}] : [];
  return {ids,measurements,body:{...body,baseBodyHeight,culledBody},failures:[...bodyFailures,...measurements.flatMap(m=>m.failures.map(check=>({id:m.id,check})))],image:renderer.domElement.toDataURL('image/png')};
}
(window as any).fitMatrix = {person,outfit,combinations,requiredPairs, hats: entries.filter(e=>e.slot==='head').map(e=>e.id), inspect: () => {
  const head = rigAnchor(rig, 'Head')!;
  return {frame: head.children.find(n => n.userData.generatedHead)?.userData.fitFrame,
    hats: [...sources].filter(([id]) => entries.find(e => e.id === id)?.slot === 'head').map(([id, root]) => {
      const meshes: unknown[] = []; root.traverse(n => { if (n instanceof Mesh && !/[.]\d+$/.test(n.name)) meshes.push({name:n.name, bounds:serial(geometryBounds(n,root))}); }); return {id, meshes};
    })};
}};
