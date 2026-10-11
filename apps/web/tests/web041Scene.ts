import { _roots } from '@react-three/fiber';
import { Box3 } from 'three';
export function layout() {
  const canvas=document.querySelector<HTMLCanvasElement>('.shop-room canvas')!;
  const scene=_roots.get(canvas)!.store.getState().scene;
  const room=scene.getObjectByName('boutique-interior')!;
  const door=room.getObjectByName('boutique-door')!;
  const rack=room.getObjectByName('clothing-rack')!;
  const shelf=room.getObjectByName('boutique-shelves')!;
  const shopper=scene.getObjectByName('shopper:00000000-0000-4000-8000-000000000001')!;
  scene.updateMatrixWorld(true);
  return {door:door.position.toArray(),rackClear:!new Box3().setFromObject(rack).intersectsBox(new Box3().setFromObject(shelf)),shopperInside:shopper.position.x> -3 && shopper.position.z>1};
}

export function cameraPosition() {
  const canvas=document.querySelector<HTMLCanvasElement>('.shop-room canvas')!;
  return _roots.get(canvas)!.store.getState().camera.position.toArray();
}
