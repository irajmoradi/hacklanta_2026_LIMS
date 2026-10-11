import {BufferGeometry, Group, Mesh, Object3D, SkinnedMesh} from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const cache=new WeakMap<Object3D,Object3D>();
/** Opt-in for static town buildings only; cached source geometries/materials remain shared.
 * Animated rigs, multi-material meshes and morph targets retain their original hierarchy. */
export function staticModel(source:Object3D):Object3D {
  const cached=cache.get(source);if(cached)return cached;
  let unsafe=source.animations.length>0;
  source.traverse(node=>{if(node instanceof SkinnedMesh||node.animations.length||node instanceof Mesh&&
    (Array.isArray(node.material)||Object.keys(node.geometry.morphAttributes).length))unsafe=true;});
  if(unsafe){cache.set(source,source);return source;}
  source.updateMatrixWorld(true);
  const groups=new Map<string,{mesh:Mesh;parts:BufferGeometry[]}>();
  source.traverseVisible(node=>{
    if(!(node instanceof Mesh)||Array.isArray(node.material))return;
    const attributes=Object.keys(node.geometry.attributes).sort().join(',');
    const key=`${node.material.uuid}:${attributes}`;
    if(!groups.has(key))groups.set(key,{mesh:node,parts:[]});
    const geometry=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();
    groups.get(key)!.parts.push(geometry.applyMatrix4(node.matrixWorld));
  });
  const result=new Group();result.name=source.name;
  for(const {mesh,parts} of groups.values()) {
    const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());
    const merged=new Mesh(geometry,mesh.material);merged.name=mesh.name;
    merged.castShadow=true;merged.receiveShadow=true;result.add(merged);
  }
  cache.set(source,result);return result;
}
