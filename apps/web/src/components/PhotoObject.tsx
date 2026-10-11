import {useEffect, useState} from 'react';
import {Mesh, type Object3D} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {EquippedItem} from '../api/types';
import {cloneModel} from '../scene/OptionalModel';
import {mediaUrl} from './shared';

export function PhotoObject({item}: {item: EquippedItem}) {
  const [model, setModel] = useState<Object3D | null>(null);
  useEffect(() => {
    let active = true, local: Object3D | undefined;
    const dispose = () => local?.traverse(node => { if (node instanceof Mesh) { node.geometry.dispose(); (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => m.dispose()); } });
    const controller = new AbortController();
    const load = async () => {
      if (!item.glb_url) return;
      const url = await mediaUrl(item.glb_url);
      try {
        const response = await fetch(url, {signal:controller.signal});
        if (!response.ok) return;
        const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '');
        local = cloneModel(gltf.scene, .65);
        gltf.scene.traverse(node => { if (node instanceof Mesh) (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => m.dispose()); });
        if (active) setModel(local); else dispose();
      } finally { if (url.startsWith('blob:')) URL.revokeObjectURL(url); }
    };
    void load().catch(() => {});
    return () => { active = false; controller.abort(); dispose(); };
  }, [item.glb_url]);
  return model ? <primitive object={model}/> : <mesh position={[0,.25,0]}><boxGeometry args={[.45,.5,.12]}/><meshStandardMaterial color={(typeof item.tint === 'string' ? item.tint : item.tint?.primary) ?? '#b5ceac'}/></mesh>;
}
