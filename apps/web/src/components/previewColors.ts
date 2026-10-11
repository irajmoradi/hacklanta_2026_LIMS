import { Mesh, MeshStandardMaterial, type Object3D } from 'three';
import type { EquippedItem, HouseColors } from '../api/types';
import { materialColor } from '../scene/itemColors';

/** Preview instances own their materials; recolor them without rebuilding attachments. */
export function paintOutfitPreview(root: Object3D, items: EquippedItem[]) {
  for (const item of items) {
    if (!item.colors) continue;
    const object = root.getObjectByName(`cosmetic:${item.item_id}`);
    if (!object) continue;
    const materials = new Set<MeshStandardMaterial>();
    object.traverse(node => {
      if (node instanceof Mesh) for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        if (material instanceof MeshStandardMaterial) materials.add(material);
      }
    });
    const named = [...materials].some(material => material.name === 'primary');
    for (const material of materials) {
      const color = materialColor(material.name, item.colors, named);
      if (color && `#${material.color.getHexString()}` !== color.toLowerCase()) material.color.set(color);
    }
  }
}

export function paintHousePreview(root: Object3D, colors: HouseColors) {
  root.traverse(node => {
    if (node instanceof Mesh) for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      const color = colors[material.name.toLowerCase() as keyof HouseColors];
      if (color && material instanceof MeshStandardMaterial && `#${material.color.getHexString()}` !== color.toLowerCase()) material.color.set(color);
    }
  });
}
