import { Mesh } from 'three';
import { _roots } from '@react-three/fiber';
export function previewHas(id: string) {
  const canvas = document.querySelector<HTMLCanvasElement>('.try-on-pane canvas');
  const scene = canvas && _roots.get(canvas)?.store.getState().scene;
  return !!scene?.getObjectByName(`cosmetic:${id}`);
}
export function shopPreview() {
  const canvas = document.querySelector<HTMLCanvasElement>('.shop-room canvas')!;
  const scene = _roots.get(canvas)!.store.getState().scene;
  const shopper = scene.getObjectByName('shopper:00000000-0000-4000-8000-000000000001');
  return {mirror:!!scene.getObjectByName('fitting-mirror'), x:shopper?.position.x, pet:!!scene.getObjectByName('try-on-pet:pet_cat_tabby')};
}

export function previewColors(id: string) {
  const canvas = document.querySelector<HTMLCanvasElement>('.try-on-pane canvas');
  const scene = canvas && _roots.get(canvas)?.store.getState().scene;
  const colors: string[] = [];
  scene?.getObjectByName(`cosmetic:${id}`)?.traverse(node => {
    if (node instanceof Mesh) for (const mat of Array.isArray(node.material) ? node.material : [node.material]) {
      if ('color' in mat) colors.push('#' + mat.color.getHexString());
    }
  });
  return colors;
}
