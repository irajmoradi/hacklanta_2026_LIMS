import { Mesh } from 'three';
import { _roots } from '@react-three/fiber';
export function colors() {
  const canvas = document.querySelector<HTMLCanvasElement>('.preview-editor canvas');
  const scene = canvas && _roots.get(canvas)?.store.getState().scene;
  const values: string[] = [];
  scene?.traverse(node => {
    if (node instanceof Mesh) for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if ('color' in material) values.push('#' + material.color.getHexString());
    }
  });
  return values;
}
export async function changeAndMeasure(selector: string, color: string) {
  const canvas = document.querySelector<HTMLCanvasElement>('.preview-editor canvas')!;
  const scene = _roots.get(canvas)!.store.getState().scene;
  const restore: (() => void)[] = [];
  let changed = 0;
  // Timestamp the material write itself; software-GL frame completion can lag the update.
  scene.traverse(node => {
    if (node instanceof Mesh) for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!('color' in material)) continue;
      const target = material.color, original = target.set;
      target.set = function(value: any) {
        const result = original.call(this,value);
        if (!changed && '#' + this.getHexString() === color) changed = performance.now();
        return result;
      };
      restore.push(()=>target.set=original);
    }
  });
  const start = performance.now();
  try {
    document.querySelector<HTMLButtonElement>(selector)!.click();
    while (!changed && performance.now() - start < 3000) await new Promise(resolve=>setTimeout(resolve,0));
    return changed ? changed - start : Infinity;
  } finally {restore.forEach(fn=>fn());}
}
