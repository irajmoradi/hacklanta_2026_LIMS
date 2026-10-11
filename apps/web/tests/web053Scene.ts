import { _roots } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { OrbitControls } from 'three-stdlib';
export function inspect() {
  const { scene, camera, controls } = _roots.get(document.querySelector<HTMLCanvasElement>('.scene canvas')!)!.store.getState();
  const statue = scene.getObjectByName('mayor_statue')!;
  return { position: camera.position.toArray(), target: (controls as OrbitControls).target.toArray(), zoom: camera.zoom,
    statue: statue.getWorldPosition(new Vector3()).toArray(), screen: statue.getWorldPosition(new Vector3()).add(new Vector3(0, .8, 0)).project(camera).toArray(), enabled: (controls as OrbitControls).enabled };
}
