import { Group, Mesh, MeshStandardMaterial, SphereGeometry, CylinderGeometry } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { api } from '../src/api/client';
import { createRoot } from 'react-dom/client';
import { WardrobePreview } from '../src/components/Wardrobe';
import { makeFixtures } from '../src/api/fixtures';

// No cached portrait GLBs are present: five synthetic heads exercise different
// export origins, face proportions and neck offsets through the real GLB loader.
api.mode = 'mock';
const blobs: Blob[] = [];
for (let i = 0; i < 5; i++) {
  const head = new Group();
  const material = new MeshStandardMaterial({color: makeFixtures().village.villagers[i].avatar.body.colors.skin});
  const face = new Mesh(new SphereGeometry(1, 32, 24), material);
  face.scale.set(.8 + i * .03, 1.05, .8); face.position.set(0, 1.35, .2 + i * .05); head.add(face);
  const neck = new Mesh(new CylinderGeometry(.32,.32,.5,24), material); neck.position.set(0,.25,-.2);head.add(neck);
  const nose = new Mesh(new SphereGeometry(.15,12,8),material);nose.position.set(0,1.35,1.05 + i*.05);head.add(nose);
  head.position.set(i * 3 - 5, i - 3, 7 - i * 2);
  const bytes = await new GLTFExporter().parseAsync(head,{binary:true}) as ArrayBuffer;
  blobs.push(new Blob([bytes],{type:'model/gltf-binary'}));
}
function decorate(value: any): any {
  if (!value || typeof value !== 'object') return value;
  if (value.avatar?.body && value.user_id) {
    const i = Number(value.user_id.slice(-1)) - 1;
    if (i >= 0 && i < 5) value.avatar.body.head_glb_url = `/api/assets/fix022/${i}.glb`;
  }
  Object.values(value).forEach(decorate); return value;
}
const request = api.request.bind(api);
api.request = async <T,>(method: string, path: string, body?: unknown): Promise<T> => {
  if (path.startsWith('/assets/fix022/')) return blobs[Number(path.split('/').pop()!.split('.')[0])] as T;
  return decorate(await request<T>(method,path,body));
};
(window as any).mountFix022Wardrobe = async (seat: number) => {
  const person = decorate(makeFixtures().village.villagers[seat]);
  const host = document.createElement('div'); host.id='fix022-wardrobe';
  host.style.cssText='position:fixed;left:0;top:0;width:480px;height:600px;z-index:10000;background:#edf0f3';
  document.body.append(host); createRoot(host).render(<WardrobePreview person={person}/>);
};
await import('../src/main');
