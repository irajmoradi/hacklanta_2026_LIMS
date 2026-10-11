import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { seededRandom } from './worldTypes';
import { loadModel } from './OptionalModel';
import { staticModel } from './staticModel';

type Tree = { x: number; z: number; scale: number; shade: string; rotation?: number; lean?: number; stretch?: [number,number,number] };
type Part = { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; matrix: THREE.Matrix4 };
function Batch({ trees, part, name, foregroundScale = .65 }: { trees: Tree[]; part: Part; name: string; foregroundScale?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const placement = new THREE.Matrix4(), rotation = new THREE.Quaternion(), position = new THREE.Vector3(), scale = new THREE.Vector3();
    const euler=new THREE.Euler(),color=new THREE.Color();
    trees.forEach((tree, i) => { const size = tree.scale * (tree.z > 3.5 ? foregroundScale : 1);
      rotation.setFromEuler(euler.set(tree.lean??0,tree.rotation??0,0));
      scale.fromArray(tree.stretch??[1,1,1]).multiplyScalar(size);
      placement.compose(position.set(tree.x, 0, tree.z), rotation, scale); placement.multiply(part.matrix);
      ref.current!.setMatrixAt(i, placement);ref.current!.setColorAt(i,color.set(tree.shade)); });
    ref.current!.instanceMatrix.needsUpdate = true;
    if(ref.current!.instanceColor)ref.current!.instanceColor.needsUpdate=true;
    ref.current!.computeBoundingSphere();
  }, [trees, part, foregroundScale]);
  return <instancedMesh name={name} ref={ref} args={[part.geometry, part.material, trees.length]} receiveShadow dispose={null} />;
}
export function TreeKind({ trees, name, size = 3.3, foregroundScale = .65, fitBounds=false }: { trees: Tree[]; name: string; size?: number; foregroundScale?: number; fitBounds?: boolean }) {
  const [parts, setParts] = useState<Part[] | null>(null);
  const fallback = useMemo(() => {
    const part = (geometry: THREE.BufferGeometry, color: string, y: number) => ({ geometry, material: new THREE.MeshStandardMaterial({color}), matrix: new THREE.Matrix4().makeTranslation(0, y, 0) });
    if (name.startsWith('rock')) return [part(new THREE.DodecahedronGeometry(size * .5, 0), '#a4a494', size * .25)];
    if (name === 'bush_a') return [part(new THREE.IcosahedronGeometry(size * .5, 1), '#839c75', size * .3)];
    if (name === 'mushroom_cluster') return [part(new THREE.CylinderGeometry(size * .08, size * .1, size * .4, 5), '#decaaa', size * .2), part(new THREE.ConeGeometry(size * .4, size * .25, 7), '#b58772', size * .45)];
    const result=[part(new THREE.CylinderGeometry(size * .04, size * .06, size * .55, 6), '#927353', size * .27), part(name==='tree_b'?new THREE.ConeGeometry(size*.33,size*.8,7):new THREE.IcosahedronGeometry(size * .33, 1), name === 'flowers_a' ? '#dfa5aa' : name === 'tree_c' ? '#d9b2bd' : '#8ca579', size * .68)];
    if(fitBounds) for(const p of result)p.matrix.premultiply(new THREE.Matrix4().makeScale(1/(size*.66),1/(size*1.1),1/(size*.66)));
    return result;
  }, [name, size, fitBounds]);
  useEffect(() => {
    let active = true;
    let loaded = false;
    const attempt = () => { if (loaded) return; void loadModel(name).then(source => {
      if (!source || !active) return;
      source = staticModel(source);
      loaded = true; source.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(source), dimensions = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
      const factor = size / Math.max(dimensions.x, dimensions.y, dimensions.z, 0.001);
      const normalize = new THREE.Matrix4().makeScale(fitBounds?1/Math.max(dimensions.x,.001):factor,fitBounds?1/Math.max(dimensions.y,.001):factor,fitBounds?1/Math.max(dimensions.z,.001):factor).multiply(new THREE.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z));
      const next: Part[] = [];
      source.traverse(node => { if (node instanceof THREE.Mesh) next.push({geometry: node.geometry, material: node.material, matrix: normalize.clone().multiply(node.matrixWorld)}); });
      if (next.length) setParts(next);
    }); };
    attempt(); const retry = setInterval(attempt, 35000);
    return () => { active = false; clearInterval(retry); };
  }, [name, size, fitBounds]);
  useEffect(() => () => { fallback.forEach(p => { p.geometry.dispose(); p.material.dispose(); }); }, [fallback]);
  return <>{(parts ?? fallback).map((part, i) => <Batch key={i} name={`trees:${name}:${i}`} part={part} trees={trees} foregroundScale={foregroundScale} />)}</>;
}
export function InstancedTrees({ trees }: { trees: Tree[] }) {
  const groups = useMemo(() => [trees.filter(t => t.x > 0), trees.filter(t => t.x <= 0)], [trees]);
  return <><TreeKind trees={groups[0]} name="tree_a" /><TreeKind trees={groups[1]} name="tree_b" /></>;
}

export function InstancedNature({ seed }: { seed: number }) {
  const groups = useMemo(() => {
    const random = seededRandom(seed + 77);
    return ['rock_a', 'rock_b', 'bush_a', 'flowers_a', 'mushroom_cluster', 'tree_c'].map((name, kind) => ({name, trees: Array.from({length: kind === 5 ? 8 : 18}, (_, i) => {
      const a = random() * Math.PI * 2, r = kind === 3 ? 3 + random() * 2 : 16.7 + random();
      return { x: kind === 3 ? -7 + Math.cos(a) * r : Math.cos(a) * r, z: kind === 3 ? 9 + Math.sin(a) * r : Math.sin(a) * r, scale: .55 + random() * .4, shade: '#8ca579' };
    })}));
  }, [seed]);
  return <>{groups.map(g => <TreeKind key={g.name} name={g.name} trees={g.trees} size={g.name === 'tree_c' ? 3 : g.name === 'flowers_a' ? .45 : .8} />)}</>;
}
