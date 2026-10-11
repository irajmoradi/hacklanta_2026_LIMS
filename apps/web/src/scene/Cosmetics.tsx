import { catalog } from '../../../../packages/catalog/dist/catalog';
import { useEffect } from 'react';
import { Bone, SkinnedMesh, Mesh, MeshStandardMaterial, TextureLoader, SRGBColorSpace, type Object3D, type Texture } from 'three';
import { mediaUrl } from '../components/shared';
import type { EquippedItem } from '../api/types';
import { loadModel } from './OptionalModel';
import { attachCosmetic, fallbackCosmetic } from './cosmeticAssets';
import { disposeHead } from './headAssets';
import { outfitLayers } from './outfitLayers';

export function Cosmetics({ rig, items, crown = false, onReady }: { rig: Object3D; items: EquippedItem[]; crown?: boolean; onReady?: (ids: string[]) => void }) {
  const signature = JSON.stringify(items);
  useEffect(() => {
    let active = true;
    const attachments: NonNullable<ReturnType<typeof attachCosmetic>>[] = [];
    const fallbacks: Object3D[] = [];
    const textures: Texture[] = [];
    const outfit = outfitLayers(JSON.parse(signature) as EquippedItem[], crown);
    onReady?.([]);
    void Promise.all(outfit.map(async item => {
      const authored = catalog.entries.find(entry => entry.id === item.item_id)?.asset?.glb.split('/').pop()?.replace(/\.glb$/, '');
      const model = authored ?? item.asset_key;
      let source = model && /^[a-z0-9_]+$/.test(model) ? await loadModel(model) : null;
      if (!active) return;
      let needsSkeleton = false;
      source?.traverse(node => { if (node instanceof SkinnedMesh) needsSkeleton = true; });
      if (needsSkeleton && !(rig.getObjectByName('Arm_L') instanceof Bone)) source = null;
      const fallback = source ? null : fallbackCosmetic(item, rig);
      if (fallback) fallbacks.push(fallback);
      const attachment = attachCosmetic(rig, source ?? fallback!, item);
      if (attachment) {
        attachments.push(attachment);
        if (item.custom && item.pattern_url) {
          let url = '';
          try {
            url = await mediaUrl(item.pattern_url);
            const texture = await new TextureLoader().loadAsync(url);
            if (!active) { texture.dispose(); return; }
            texture.colorSpace = SRGBColorSpace; textures.push(texture);
            attachment.instance.traverse(node => { if (node instanceof Mesh) for (const material of Array.isArray(node.material) ? node.material : [node.material]) if (material instanceof MeshStandardMaterial) { material.map = texture; material.needsUpdate = true; } });
          } catch { /* The tinted wearable remains visible when its pattern is unavailable. */ }
          finally { if (url.startsWith('blob:')) URL.revokeObjectURL(url); }
        }
      }
      onReady?.(attachments.map(a => a.instance.name.slice(9)));
    }));
    const refit = () => attachments.forEach(a => a.fit());
    rig.addEventListener('headchange' as never, refit);
    return () => { active = false; rig.removeEventListener('headchange' as never, refit); attachments.forEach(a => a.dispose()); fallbacks.forEach(disposeHead); textures.forEach(t => t.dispose()); };
  }, [rig, signature, crown, onReady]);
  return null;
}
