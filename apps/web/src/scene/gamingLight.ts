import { Color, Mesh, MeshStandardMaterial, type Object3D } from 'three';

const originals = new WeakMap<MeshStandardMaterial, {color: Color; intensity: number}>();
export function gamingLight(model: Object3D, seconds: number, active: boolean, blackout = false, reduced = false) {
  model.traverse(node => {
    if (!(node instanceof Mesh)) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!(material instanceof MeshStandardMaterial) || !/glass/i.test(`${node.name} ${material.name}`)) continue;
      if (active || blackout) {
        if (!originals.has(material)) originals.set(material, {color:material.emissive.clone(), intensity:material.emissiveIntensity});
        material.emissive.set(blackout ? '#ffd59a' : '#77bcff');
        material.emissiveIntensity = blackout ? .8 + (reduced ? 0 : .08*Math.sin(seconds*1.7)) : 1.5 + .35*Math.sin(seconds*5) + .15*Math.sin(seconds*11);
      } else {
        const original = originals.get(material);
        if (original) { material.emissive.copy(original.color); material.emissiveIntensity = original.intensity; originals.delete(material); }
      }
    }
  });
}
