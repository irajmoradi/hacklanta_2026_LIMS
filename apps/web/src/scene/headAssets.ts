import { Box3, Vector3, Mesh, MeshStandardMaterial, Object3D, Sprite, SpriteMaterial, Texture, TextureLoader, SRGBColorSpace } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { api } from '../api/client';
import type { AvatarManifest } from '../api/types';
import { rigAnchor } from './rigAnchors';
import { geometryBounds, geometryPoints, headFrame, normalizedHeadFit } from './headFit';

export type HeadKind = 'glb' | 'card' | 'preset';
const names = new Set(['head', 'hair_cap', 'eye', 'eye001', 'eye.001', 'nose']);

/** Only call with an owned rig clone. Preserve any originally hidden nodes. */
export function attachHead(rig: Object3D, head: Object3D) {
  const bone = rigAnchor(rig, 'Head');
  if (!bone) return null;
  const previousPosition = head.position.clone(), previousScale = head.scale.clone();
  // The base face and neck are often skinned siblings of the skeleton.
  const base = geometryBounds(rig, bone, node => node.name.toLowerCase() === 'head');
  if (base.isEmpty()) base.copy(new Box3(new Vector3(-0.36, 0, -0.3), new Vector3(0.36, 0.72, 0.3)));
  const neck = geometryBounds(rig, bone, node => node.name.toLowerCase() === 'neck');
  // Measure actual visible vertices in the incoming parent's frame, preserving
  // exported rotation/scale without inheriting an unrelated world transform.
  const points = head instanceof Sprite ? [] : geometryPoints(head, head).map(p => p.applyMatrix4(head.matrix));
  const own = new Box3().setFromPoints(points);
  if (!(head instanceof Sprite) && !own.isEmpty() && own.getSize(new Vector3()).y > 0.001) {
    // A tiny overlap seals sloped scanned neck bottoms against the flat body neck.
    const neckTop = neck.isEmpty() ? base.min.y : neck.max.y - base.getSize(new Vector3()).y * 0.01;
    const socket = (neck.isEmpty() ? base : neck).getCenter(new Vector3());
    const fit = normalizedHeadFit(own, base, neckTop, socket, points);
    head.scale.multiplyScalar(fit.scale);
    head.position.multiplyScalar(fit.scale).add(fit.offset);
  }
  const hidden: [Object3D, boolean][] = [];
  const hidePreset = (node: Object3D) => {
    if (node.userData.cosmetic || node.userData.generatedHead) return;
    if (node instanceof Mesh && names.has(node.name.toLowerCase())) {
      hidden.push([node, node.visible]); node.visible = false;
    }
    node.children.forEach(hidePreset);
  };
  hidePreset(rig);
  // Keep +Z as the exported face direction; normalize only size and translation.
  const previousMarker = head.userData.generatedHead;
  const previousFrame = head.userData.fitFrame;
  head.userData.generatedHead = true;
  bone.add(head);
  if (!(head instanceof Sprite) && !own.isEmpty()) {
    const points = geometryPoints(head, bone);
    head.userData.fitFrame = headFrame(new Box3().setFromPoints(points), points);
  }
  rig.dispatchEvent({ type: 'headchange' } as never);
  return () => { head.removeFromParent();
    head.position.copy(previousPosition); head.scale.copy(previousScale);
    if (previousFrame === undefined) delete head.userData.fitFrame;
    else head.userData.fitFrame = previousFrame;
    if (previousMarker === undefined) delete head.userData.generatedHead;
    else head.userData.generatedHead = previousMarker;
    for (const [node, visible] of hidden) node.visible = visible;
    rig.dispatchEvent({ type: 'headchange' } as never);
  };
}

export async function headFallback<T>(body: AvatarManifest['body'], load: (url: string, kind: 'glb' | 'card') => Promise<T>): Promise<{kind: HeadKind; value?: T}> {
  for (const [kind, url] of [['glb', body.head_glb_url], ['card', body.head_card_url]] as const) {
    if (!url) continue;
    try { return {kind, value: await load(url, kind)}; } catch { /* Try the next representation. */ }
  }
  return {kind: 'preset'};
}

export function disposeHead(root: Object3D) {
  const textures = new Set<Texture>();
  root.traverse(node => {
    if (!(node instanceof Mesh || node instanceof Sprite)) return;
    if (node instanceof Mesh) node.geometry.dispose();
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
      material.dispose();
    }
  });
  textures.forEach(texture => texture.dispose());
}

async function loadHead(url: string, kind: 'glb' | 'card') {
  const parsed = new URL(url, location.origin);
  const trusted = [location.origin, 'http://localhost:8010', 'http://127.0.0.1:8010', 'http://localhost:8000', 'http://127.0.0.1:8000'];
  // Never send authorization to arbitrary manifest-provided origins.
  if (!trusted.includes(parsed.origin) || !parsed.pathname.startsWith('/api/assets/')) throw new Error('Unsupported head asset URL');
  const blob = await api.request<Blob>('GET', parsed.pathname.slice(4) + parsed.search);
  const objectUrl = URL.createObjectURL(blob);
  try {
    if (kind === 'card') {
      const texture = await new TextureLoader().loadAsync(objectUrl); texture.colorSpace = SRGBColorSpace;
      const sprite = new Sprite(new SpriteMaterial({map: texture, transparent: true, alphaTest: 0.05}));
      sprite.position.y = 0.3; sprite.scale.set(0.85, 0.85, 1);
      return sprite;
    }
    // Self-contained GLB only: block external dependencies from carrying untrusted requests.
    const loader = new GLTFLoader();
    loader.manager.setURLModifier(value => {
      if (value === objectUrl || value.startsWith('blob:') || value.startsWith('data:')) return value;
      throw new Error('Head GLB must embed its resources');
    });
    const result = await loader.loadAsync(objectUrl);
    if (!result.scene.children.length) throw new Error('Empty head GLB');
    result.scene.traverse(node => {
      if (!(node instanceof Mesh)) return;
      node.castShadow = true;
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        if (material instanceof MeshStandardMaterial) {
          material.emissive.copy(material.color); material.emissiveMap = material.map; material.emissiveIntensity = 0.28;
        }
      }
    });
    return result.scene;
  } finally { URL.revokeObjectURL(objectUrl); }
}

type Entry = {users: number; promise: Promise<Object3D>};
const cache = new Map<string, Entry>();
/** Shared source resources live exactly as long as their consumers, including pending loads. */
export function acquireHead(url: string, kind: 'glb' | 'card') {
  const key = `${api.user}:${kind}:${url}`;
  let entry = cache.get(key);
  if (!entry) { entry = {users: 0, promise: loadHead(url, kind)}; cache.set(key, entry); }
  entry.users++;
  const current = entry;
  let released = false;
  return {
    promise: current.promise.then(source => clone(source)),
    release() {
      if (released) return; released = true;
      if (--current.users === 0) {
        cache.delete(key);
        void current.promise.then(disposeHead).catch(() => {});
      }
    },
  };
}
