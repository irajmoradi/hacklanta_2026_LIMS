import { prepareSeatedRig, seatedAnimator } from './seatedPose';
import { prepareEmoteRig, emoteAnimator, type EmoteRequest } from './emotes';
import { applyHouseSurface } from './surfaceMaterials';
import { staticModel } from './staticModel';
import { staticMaterialLease } from './staticMaterials';
import type { HouseMaterials } from './houseOptions';
import { Cosmetics } from './Cosmetics';
import { GeneratedHead } from './GeneratedHead';
import type { HeadKind } from './headAssets';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { AnimationAction, AnimationMixer, Box3, Color, Group, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AvatarManifest, EquippedItem } from '../api/types';

const failedAt = new Map<string, number>();
const cache = new Map<string, Promise<Object3D | null>>();
declare const __MODEL_REVISION__: string;
export function loadModel(name: string) {
  if (failedAt.has(name) && Date.now() - failedAt.get(name)! > 30000) { cache.delete(name); failedAt.delete(name); }
  if (!cache.has(name)) cache.set(name, (async () => {
    try {
      const version = typeof __MODEL_REVISION__ === 'string' ? `?v=${__MODEL_REVISION__}` : '';
      const response = await fetch(`/models/${name}.glb${version}`, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) return null;
      const bytes = await response.arrayBuffer();
      // Vite can serve index.html for unknown paths. Do not parse it as a GLB.
      if (bytes.byteLength < 12 || new DataView(bytes).getUint32(0, true) !== 0x46546c67) return null;
      const gltf = await new GLTFLoader().parseAsync(bytes, '/models/');
      gltf.scene.animations = gltf.animations;
      return gltf.scene;
    } catch { return null; }
  })());
  const result = cache.get(name)!;
  void result.then(source => { if (!source && !failedAt.has(name)) failedAt.set(name, Date.now()); });
  return result;
}

export function cloneModel(source: Object3D, size: number, colors?: Record<string, string>, authored = false, surfaces?: HouseMaterials, lease?: ReturnType<typeof staticMaterialLease>) {
  const instance = clone(source);
  const materials = new Map<string, MeshStandardMaterial>();
  instance.traverse(node => {
    if (!(node instanceof Mesh)) return;
    node.castShadow = true; node.receiveShadow = true;
    const tint = (material: MeshStandardMaterial) => {
      const key = colors && Object.keys(colors).find(k => 'skin' in colors
        ? `${node.name} ${material.name}`.toLowerCase().includes(k)
        : material.name.toLowerCase() === k);
      const variant = `${material.uuid}:${key ?? ''}`;
      const cached = materials.get(variant);
      if (cached) return cached;
      const make = () => {
        const local = material.clone();
        applyHouseSurface(local, surfaces);
        if (key && local.color) local.color.set(colors![key as keyof typeof colors]);
        return local;
      };
      const shared = lease && !/glass/i.test(`${node.name} ${material.name}`);
      const local = shared ? lease.acquire(`${variant}:${JSON.stringify(colors)}:${JSON.stringify(surfaces)}`, make) : make();
      if (shared) local.userData.sharedStatic = true;
      materials.set(variant, local);
      return local;
    };
    node.material = Array.isArray(node.material) ? node.material.map(tint) : tint(node.material);
  });
  if (authored) { const wrapper = new Group(); wrapper.add(instance); wrapper.scale.setScalar(size); return wrapper; }
  const bounds = new Box3().setFromObject(instance), dimensions = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3());
  const scale = size / Math.max(dimensions.x, dimensions.y, dimensions.z, 0.001);
  instance.position.sub(new Vector3(center.x, bounds.min.y, center.z));
  const wrapper = new Group(); wrapper.add(instance); wrapper.scale.setScalar(scale);
  wrapper.animations = source.animations;
  return wrapper;
}

/** Missing, malformed, or offline assets leave the original geometry mounted. */
export function OptionalModel({ charred = false, name, size, colors, surfaces, authored = false, batchStatic = false, shareStaticMaterials = false, animation, animationTime, emote, head, onHeadKind, equipment = [], crown, onCosmetics, children, hero = true, animate }: { charred?:boolean; animationTime?: () => number | undefined; name: string; size: number; batchStatic?: boolean; shareStaticMaterials?: boolean; surfaces?: HouseMaterials; equipment?: EquippedItem[]; crown?: boolean; onCosmetics?: (ids: string[]) => void; hero?: boolean; animate?: (model: Object3D, time: number) => void; colors?: Record<string, string>; authored?: boolean; head?: AvatarManifest['body']; onHeadKind?: (kind: HeadKind) => void; emote?: () => EmoteRequest | null; animation?: () => 'idle' | 'walk' | 'sit' | 'study' | 'dance' | 'wave' | 'kneel' | 'eat'; children: ReactNode }) {
  const [fallbackRig, setFallbackRig] = useState<Group | null>(null);
  const [model, setModel] = useState<Object3D | null>(null);
  const palette = colors ? JSON.stringify(colors) : '';
  const surfaceKey = JSON.stringify(surfaces ?? {});
  const playback = useMemo(() => {
    if (!model?.animations.length) return null;
    const mixer = new AnimationMixer(model);
    const idle = model.animations.find(clip => clip.name.toLowerCase() === 'idle');
    const walk = model.animations.find(clip => clip.name.toLowerCase() === 'walk') ?? idle;
    return { mixer, idle: idle ? mixer.clipAction(idle) : null, walk: walk ? mixer.clipAction(walk) : null, legs: [model.getObjectByName('Leg_L'), model.getObjectByName('Leg_R')], active: null as AnimationAction | null };
  }, [model]);
  useEffect(() => () => { if (playback && model) { playback.mixer.stopAllAction(); playback.mixer.uncacheRoot(model); } }, [playback, model]);
  useEffect(() => () => { model?.traverse(node => { if (node instanceof Mesh && node.userData.emoteSkin) { node.geometry.dispose(); (node as import('three').SkinnedMesh).skeleton.dispose(); } }); }, [model]);
  useEffect(()=>{
    if(!model)return;
    const originals: {material:MeshStandardMaterial;color:import('three').Color}[]=[];
    model.traverse(node=>{if(node instanceof Mesh)for(const material of Array.isArray(node.material)?node.material:[node.material])if(material instanceof MeshStandardMaterial){originals.push({material,color:material.color.clone()});if(charred)material.color.lerp(new Color('#544352'),.7);}});
    return()=>originals.forEach(({material,color})=>material.color.copy(color));
  },[model,charred]);
  const sitter = useMemo(() => model ? seatedAnimator(model) : null, [model]);
  const emoter = useMemo(() => model ? emoteAnimator(model) : null, [model]);
  useFrame(({ clock }, delta) => {
    const sharedTime=animationTime?.();
    const time=sharedTime ?? clock.elapsedTime;
    emoter?.reset(); sitter?.reset();
    if (!playback || !model || !animation) { if (model && ['sit','study'].includes(animation?.() ?? '')) sitter?.apply(); if (animate && (model || fallbackRig)) animate((model || fallbackRig)!, time); return; }
    const wanted = animation();
    const next = playback[wanted === 'walk' ? 'walk' : 'idle'];
    if (!next) { if (wanted === 'sit' || wanted === 'study') sitter?.apply(); animate?.(model,time); return; }
    if (playback.active !== next) {
      if(sharedTime===undefined){playback.active?.fadeOut(0.2);next.reset().fadeIn(0.2).play();}
      else {playback.active?.stop();next.reset().setEffectiveWeight(1).play();}
      playback.active = next;
    }
    if(sharedTime===undefined) playback.mixer.update(Math.min(delta, 0.05));
    else playback.mixer.setTime(Math.max(0,sharedTime));
    if (wanted === 'kneel' || wanted === 'eat') { for(const name of ['Arm_L','Arm_R']) {const arm=model.getObjectByName(name);if(arm)arm.rotation.x=-1+Math.sin(time*3)*.12;} }
    if (wanted === 'study') {
      for (const [name, phase] of [['Arm_L', 0], ['Arm_R', 1]] as const) {
        const arm = model.getObjectByName(name);
        if (arm) arm.rotation.x = Math.PI - 1 + Math.sin(time * 4 + phase) * .09;
      }
    }
    if (wanted === 'sit' || wanted === 'study') sitter?.apply();
    if (animate) animate(model, time);
    const request = emote?.();
    if (request) emoter?.apply(request.kind, performance.now() / 1000 - request.start);
  });
  useEffect(() => {
    let active = true;
    const ownedMaterials = new Set<MeshStandardMaterial>();
    const lease = shareStaticMaterials && batchStatic ? staticMaterialLease() : undefined;
    setModel(null);
    let loaded = false;
    const attempt = () => { if (loaded) return; void loadModel(name).then(source => { if (!active || !source) return; loaded = true; const instance = cloneModel(batchStatic ? staticModel(source) : source, size, palette ? JSON.parse(palette) : undefined, authored, JSON.parse(surfaceKey), lease);
      instance.traverse(node => { if (node instanceof Mesh) { node.castShadow = hero; for (const material of Array.isArray(node.material) ? node.material : [node.material]) if (!material.userData.sharedStatic) ownedMaterials.add(material); } });
      if (name === 'villager_base') { prepareEmoteRig(instance); prepareSeatedRig(instance); }
      setModel(instance); }).catch(() => { /* Invalid models retain the procedural fallback. */ }); };
    attempt(); const retry = setInterval(attempt, 35000);
    return () => { active = false; clearInterval(retry); ownedMaterials.forEach(material => material.dispose()); lease?.release(); };
  }, [name, size, palette, surfaceKey, hero, authored, batchStatic, shareStaticMaterials]);
  return model ? <><Cosmetics rig={model} items={equipment} crown={crown} onReady={onCosmetics} /><primitive object={model} dispose={null} />{head && <GeneratedHead rig={model} body={head} onKind={onHeadKind} />}</> : <group ref={setFallbackRig}>{children}{name === 'villager_base' && <><group name="Head" position={[0, 0.98, 0]} /><group name="Spine" position={[0, 0.7, 0]} />{fallbackRig && <Cosmetics rig={fallbackRig} items={equipment} crown={crown} onReady={onCosmetics} />}</>}</group>;
}
