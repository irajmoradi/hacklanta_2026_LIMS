import { state } from './overworld-tools';
import { Box3, Mesh, Vector3 } from 'three';

export function inspectTown() {
  const {scene, camera, gl} = state();
  const houses: {name:string; meshes:number; detailed:boolean; inFrame:boolean}[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse(object => {
    if (!object.name.startsWith('home:')) return;
    const materials = new Set<string>(); let meshes = 0;
    object.traverse(n => {if (n instanceof Mesh) {meshes++; for (const m of Array.isArray(n.material) ? n.material : [n.material]) materials.add(m.name);}});
    const box = new Box3().setFromObject(object);
    let inFrame = true;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const p = new Vector3(x,y,z).project(camera);
      inFrame &&= Math.abs(p.x) < 1 && Math.abs(p.y) < 1;
    }
    houses.push({name:object.name, meshes, detailed: materials.has('wall') && materials.has('roof'), inFrame});
  });
  const context = gl.getContext(), debug = context.getExtension('WEBGL_debug_renderer_info');
  return {houses, calls:gl.info.render.calls, triangles:gl.info.render.triangles,
    renderer:debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unknown', zoom:camera.zoom};
}

export function homeScreenPoint() {
  const {scene, camera, size, gl} = state();
  const home = scene.getObjectByName('home:lab-neighbor-1')!;
  const p = home.localToWorld(new Vector3(0,3,0)).project(camera), rect = gl.domElement.getBoundingClientRect();
  return {x: rect.left + (p.x+1)*size.width/2, y:rect.top+(1-p.y)*size.height/2};
}
