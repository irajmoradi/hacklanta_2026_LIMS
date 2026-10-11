import { lowerBodyFallback, coverLowerBody } from './lowerBody';
import { articulateSleeves } from './emotes';
import { catalog } from '../../../../packages/catalog/dist/catalog';
import { materialColor } from './itemColors';
import { Box3, BoxGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, SkinnedMesh, Skeleton, Bone, Object3D, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { EquippedItem } from '../api/types';
import { rigAnchor } from './rigAnchors';
import { geometryBounds, geometryPoints, headFrame } from './headFit';
import { fitNeck, fitTorso } from './bodyFit';
import { entriesById } from '../../../../packages/catalog/dist/catalog';
import { compressCrown, fitHat } from './hatFit';

/** Measure visible face geometry in bone space, excluding already attached clothes. */
export function headBounds(head: Object3D): Box3 {
  head.updateWorldMatrix(true, true);
  const inverse = new Matrix4().copy(head.matrixWorld).invert(), bounds = new Box3();
  const visit = (node: Object3D) => {
    if (!node.visible || node.userData.cosmetic) return;
    if (node instanceof Mesh) {
      const position = node.geometry.getAttribute('position');
      for (let i = 0; position && i < position.count; i++) {
        bounds.expandByPoint(node.getVertexPosition(i, new Vector3()).applyMatrix4(node.matrixWorld).applyMatrix4(inverse));
      }
    } else if (node.type === 'Sprite') {
      bounds.expandByPoint(new Vector3(-0.425, -0.125, 0.02)); bounds.expandByPoint(new Vector3(0.425, 0.725, 0.02));
    }
    node.children.forEach(visit);
  };
  // A generated head is authoritative; ignore any leftover preset geometry.
  visit(head.children.find(node => node.userData.generatedHead) ?? head);
  return bounds.isEmpty() ? new Box3(new Vector3(-0.36, 0, -0.3), new Vector3(0.36, 0.72, 0.33)) : bounds;
}

/** All values are in the owning Head bone's local space, independent of town/preview scale. */
export function headAnchors(bounds: Box3) {
  return headFrame(bounds);
}

export function fallbackCosmetic(item: EquippedItem, rig?: Object3D): Object3D {
  if (['bottoms', 'shoes'].includes(item.slot)) return lowerBodyFallback(item.slot, rig);
  const root = new Group();
  const material = new MeshStandardMaterial({ color: item.slot === 'torso' ? '#557ca7' : item.asset_key === 'hat_crown' ? '#f3c65e' : '#bc6651' });
  material.name = 'primary';
  const add = (geometry: BoxGeometry | TorusGeometry | SphereGeometry, x = 0, y = 0, z = 0) => { const mesh = new Mesh(geometry, material); mesh.position.set(x, y, z); root.add(mesh); };
  if (item.slot === 'face') { add(new TorusGeometry(0.11, 0.018, 6, 16), -0.14); add(new TorusGeometry(0.11, 0.018, 6, 16), 0.14); add(new BoxGeometry(0.1, 0.025, 0.03)); }
  else if (item.asset_key === 'hat_headphones') {
    add(new BoxGeometry(0.09, 0.29, 0.24), -0.344, 0.15); root.children.at(-1)!.name = 'ear_cushion';
    add(new BoxGeometry(0.09, 0.29, 0.24), 0.344, 0.15); root.children.at(-1)!.name = 'ear_cushion.001';
    add(new TorusGeometry(0.36, 0.035, 6, 16, Math.PI), 0, 0.2);
  }
  else if (item.slot === 'torso') add(new BoxGeometry(0.57, 0.5, 0.46), 0, 0.24);
  else if (item.slot === 'neck') add(new BoxGeometry(0.45, 0.16, 0.4), 0, 0.2);
  else add(new SphereGeometry(0.37, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.02);
  root.userData.ownedGeometry = true;
  return root;
}

/** Clone materials as well as nodes. Cached sources and other villagers stay untouched. */
export function attachCosmetic(rig: Object3D, source: Object3D, item: EquippedItem) {
  const entry = catalog.entries.find(entry => entry.id === item.item_id);
  const slot: string = entry?.slot ?? item.slot;
  const lower = ['bottoms','shoes'].includes(slot);
  const bone = rigAnchor(rig, slot === 'torso' ? 'Spine' : 'Head');
  if (!bone) return null;
  const instance = new Group(), materials = new Set<MeshStandardMaterial>();
  instance.add(lower && source.userData.ownedGeometry ? source : clone(source));
  instance.name = `cosmetic:${item.item_id}`; instance.userData.cosmetic = true;
  let named = false;
  source.traverse(node => { if (node instanceof Mesh && (Array.isArray(node.material) ? node.material : [node.material]).some(m => m.name === 'primary')) named = true; });
  instance.traverse(node => {
    if (!(node instanceof Mesh)) return;
    node.castShadow = true;
    const localMaterial = (material: MeshStandardMaterial) => {
      const local = (lower && source.userData.ownedGeometry ? material : material.clone()) as MeshStandardMaterial;
      if (local.name === 'jacket') local.color.set('#557ca7');
      const tint = materialColor(local.name, item.colors, named) ?? (typeof item.tint === 'string' ? item.tint : item.tint?.primary);
      // Primitive fallbacks use a primary material, independent of authored GLB names.
      if (tint && (source.userData.ownedGeometry || !entry?.asset?.tint_materials?.length || entry.asset.tint_materials.includes(local.name))) local.color.set(tint);
      materials.add(local); return local;
    };
    node.material = Array.isArray(node.material) ? node.material.map(localMaterial) : localMaterial(node.material);
  });
  // Skinned wearables were authored in villager model space, not Head/Spine space.
  // Reuse the living bones while retaining the clothing's authored inverse binds.
  let skinned = false;
  const skeletons = new Set<Skeleton>();
  instance.traverse(node => {
    if (!(node instanceof SkinnedMesh)) return;
    const bones = node.skeleton.bones.map(b => rig.getObjectByName(b.name));
    if (bones.every(b => b instanceof Bone)) {
      const skeleton = new Skeleton(bones as Bone[], node.skeleton.boneInverses.map(m => m.clone()));
      const previousSkeleton = node.skeleton;
      node.bind(skeleton, node.bindMatrix.clone());
      if (lower && source.userData.ownedGeometry) previousSkeleton.dispose();
      if (!lower) articulateSleeves(node, rig);
      if (lower) node.frustumCulled = false;
      skeletons.add(node.skeleton); if (node.skeleton !== skeleton) skeleton.dispose(); skinned = true;
    }
  });
  if (skinned) {
    // Keep cached source bones from shadowing the avatar's attachment lookups.
    instance.traverse(node => { if (node instanceof Bone) node.name = `clothing:${node.name}`; });
    (rig.getObjectByName('VillagerRig')?.parent ?? rig).add(instance);
  } else if (lower) {
    (rig.getObjectByName('VillagerRig')?.parent ?? rig).add(instance);
  } else bone.add(instance);
  const restoreLower = lower ? coverLowerBody(rig, slot) : undefined;
  // Exposed calves/feet follow the avatar skin color, independently of dye channels.
  if (lower) {
    let skin: MeshStandardMaterial | undefined;
    const findSkin = (node: Object3D) => {
      if (node.userData.cosmetic || node.userData.generatedHead) return;
      if (node instanceof Mesh) for (const m of Array.isArray(node.material) ? node.material : [node.material]) if (m.name === 'skin') skin = m as MeshStandardMaterial;
      node.children.forEach(findSkin);
    };
    findSkin(rig);
    if (skin) instance.traverse(node => { if (node instanceof Mesh) for (const m of Array.isArray(node.material) ? node.material : [node.material]) if (m.name === 'skin') (m as MeshStandardMaterial).color.copy(skin!.color); });
  }
  // The base shirt has box-shaped sleeves; their corners otherwise protrude
  // through every round authored sleeve. Restore them when this top is removed.
  const covered: Object3D[] = [];
  if (skinned && instance.getObjectByName('torso')) {
    const cover = (node: Object3D) => {
      if (node.userData.cosmetic || node.userData.generatedHead) return;
      if (node instanceof Mesh && ['sleeve_L', 'sleeve_R'].includes(node.name)) {
        if (!node.userData.coveringTops) node.userData.uncoveredVisibility = node.visible;
        node.userData.coveringTops = (node.userData.coveringTops ?? 0) + 1;
        node.visible = false; covered.push(node);
      }
      node.children.forEach(cover);
    };
    cover(rig);
  }
  let restoreCrown: (() => void) | undefined;
  const fit = () => {
    restoreCrown?.(); restoreCrown = undefined;
    if (skinned || lower) return;
    instance.position.set(0, 0, 0); instance.scale.setScalar(1); instance.rotation.set(0, 0, 0);
    if (slot === 'torso') { const offset = entry?.asset?.attach?.offset; if (offset && item.item_id === 'auditor_badge') instance.position.fromArray(offset); else instance.position.y = -0.065; fitTorso(instance, rig, bone, item.item_id === 'champion_mantle'); return; }
    if (slot === 'neck') { fitNeck(instance, rig, bone); return; }
    const generated = bone.children.find(node => node.userData.generatedHead);
    const preset = geometryBounds(rig, bone, n => ['head', 'hair_cap', 'eye', 'eye001', 'eye.001', 'nose'].includes(n.name.toLowerCase()));
    const anchor: ReturnType<typeof headFrame> = generated?.userData.fitFrame ?? headFrame(preset.isEmpty() ? headBounds(bone) : preset,
      geometryPoints(rig, bone, n => ['head','hair_cap'].includes(n.name.toLowerCase())));
    if (!generated) {
      const eyes = geometryBounds(rig, bone, n => /^eye(?:[._]?\d+)?$/.test(n.name));
      if (!eyes.isEmpty()) anchor.eyeLine = eyes.getCenter(new Vector3()).y;
    }
    {
      const override = generated ? entriesById.get(item.item_id)?.fit?.generated : undefined;
      const headphones = item.asset_key === 'hat_headphones';
      if (slot === 'head' && !headphones) {
        fitHat(instance, bone, item.item_id, anchor, override?.scale, override?.offset);
        if (generated && !['perfect_week_halo', 'competition_laurels', 'outfit_flower_crown', 'outfit_bow', 'outfit_earmuffs'].includes(item.item_id)) {
          restoreCrown = compressCrown(generated, bone, anchor, item.item_id === 'hat_party');
        }
        return;
      }
      const own = geometryBounds(instance, bone), size = own.getSize(new Vector3()), center = own.getCenter(new Vector3());
      if (own.isEmpty()) return;
      const factor = override?.scale ?? [1, 1, 1];
      const width = item.slot === 'face' ? anchor.faceWidth * 0.9 : anchor.earWidth * 1.08;
      const fittedScale = new Vector3().setScalar(width / Math.max(size.x, 0.001));
      let origin = center.clone(), target = anchor.center.clone();
      if (item.slot === 'face') {
        origin.z = own.max.z;
        target.y = anchor.eyeLine;
        // The new pack has real lenses behind its front rim. The legacy
        // inset puts those lenses through the preset's protruding eyes.
        target.z = anchor.front - anchor.size.z * (entry?.tags?.includes('asset013') ? 0 : 0.08);
      } else if (headphones) {
        // Named cushions supply the authored ear frame, independent of GLB units.
        const cups: Vector3[] = [];
        instance.traverse(node => {
          if (node instanceof Mesh && /^ear_cushion(?:[._]\d+)?$/.test(node.name)) {
            cups.push(geometryBounds(node, bone).getCenter(new Vector3()));
          }
        });
        if (cups.length >= 2) {
          cups.sort((a, b) => a.x - b.x);
          origin = cups[0].clone().add(cups.at(-1)!).multiplyScalar(0.5);
          fittedScale.setScalar(anchor.earWidth / Math.max(cups.at(-1)!.x - cups[0].x, 0.001));
        } else {
          // Procedural band-and-cup fallback has ear centers at 25% of its height.
          origin.y = own.min.y + size.y * 0.25;
        }
        fittedScale.y = (anchor.top - target.y + anchor.size.y * 0.04) / Math.max(own.max.y - origin.y, 0.001);
      } else {
        origin.y = own.min.y;
        target.y = anchor.top - anchor.size.y * 0.18;
      }
      instance.scale.copy(fittedScale).multiply(new Vector3(...factor));
      origin.multiply(instance.scale);
      instance.position.copy(target.sub(origin));
      // Offsets are fractions of head width/height/depth in the +Z head frame.
      if (override?.offset) instance.position.add(new Vector3(...override.offset).multiply(anchor.size));
      return;
    }

  };
  fit();
  return { instance, fit, dispose() {
    restoreCrown?.(); restoreCrown = undefined; restoreLower?.();
    instance.traverse(node => { if (node instanceof SkinnedMesh && node.userData.emoteSkin) node.geometry.dispose(); });
    instance.removeFromParent(); materials.forEach(m => m.dispose()); skeletons.forEach(s => s.dispose());
    covered.splice(0).forEach(node => {
      if (--node.userData.coveringTops === 0) {
        node.visible = node.userData.uncoveredVisibility;
        delete node.userData.coveringTops; delete node.userData.uncoveredVisibility;
      }
    });
  } };
}
