import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, TorusGeometry, type BufferGeometry } from 'three';

// Shared by the offline fallback and deterministic GLB export. No generated assets required.
export function fitnessAsset() {
  const group = new Group(); group.name = 'fitness_corner';
  const materials = ['#839a80', '#344a50', '#c39564', '#668ca3'].map(color => new MeshStandardMaterial({color, roughness:.8}));
  const add = (geometry: BufferGeometry, p: number[], material: number) => {
    const mesh = new Mesh(geometry, materials[material]); mesh.position.set(p[0],p[1],p[2]); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  const box = (s: number[], p: number[], m: number) => add(new BoxGeometry(...s as [number,number,number]),p,m);
  box([8,.1,7],[0,.05,0],0);
  for (const x of [-3,-.2]) box([.16,3.6,.16],[x,1.8,-2],1);
  box([3.2,.16,.16],[-1.6,3.6,-2],1);
  box([2.8,.18,.9],[2,1,-1.8],2);
  for (const x of [1,3]) box([.2,.9,.7],[x,.45,-1.8],1);
  box([2.8,.07,1.6],[-1.6,.14,1],3);
  for (const x of [1.4,2.6]) {
    add(new CylinderGeometry(.28,.4,.45,8),[x,.35,.7],1);
    add(new TorusGeometry(.22,.065,4,8),[x,.67,.7],1);
  }
  return group;
}
