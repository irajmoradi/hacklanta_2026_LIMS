import { AmbientLight, Box3, Color, DirectionalLight, Group, OrthographicCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { api } from '../src/api/client';
import { loadModel, cloneModel } from '../src/scene/OptionalModel';
import { acquireHead, attachHead } from '../src/scene/headAssets';
import { attachCosmetic, headBounds } from '../src/scene/cosmeticAssets';
import { geometryBounds } from '../src/scene/headFit';
import { rigAnchor } from '../src/scene/rigAnchors';
import { catalog } from '../../../packages/catalog/dist/catalog';

const canvas = document.querySelector('canvas')!;
const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(1200, 650); renderer.setScissorTest(true);
const scene = new Scene(); scene.background = new Color('#edf0f3');
scene.add(new AmbientLight(0xffffff, 2));
const light = new DirectionalLight(0xffffff, 2.5); light.position.set(3, 5, 4); scene.add(light);
let rig: Group, detach: (() => void) | null, lease: ReturnType<typeof acquireHead>;
let attachment: ReturnType<typeof attachCosmetic>;
const base = await loadModel('villager_base');
if (!base) throw Error('Missing real base rig');

export const items = catalog.entries.filter(e => e.slot === 'head' || e.slot === 'face').map(e => e.id);
export async function person(name: string, seat: number) {
  attachment?.dispose(); detach?.(); lease?.release(); if (rig) scene.remove(rig);
  const manifest = await api.avatar(`13370000-0000-4000-8000-00000000000${seat}`);
  if (!manifest.body.head_glb_url) throw Error(`No generated GLB for ${name}`);
  rig = cloneModel(base!, 1, manifest.body.colors, true) as Group;
  scene.add(rig);
  lease = acquireHead(manifest.body.head_glb_url, 'glb');
  detach = attachHead(rig, await lease.promise);
  if (!detach) throw Error('No head bone');
  rig.userData.person = name;
}
export async function outfit(id: string) {
  attachment?.dispose();
  const entry = catalog.entries.find(e => e.id === id)!;
  const key = entry.asset!.glb.split('/').pop()!.replace('.glb', '');
  const source = await loadModel(key);
  if (!source) throw Error(`Missing authored cosmetic ${key}`);
  attachment = attachCosmetic(rig, source, {item_id: id, slot: entry.slot as 'head' | 'face', asset_key: key});
  if (!attachment) throw Error('Cosmetic attachment failed');
  document.querySelector('#label')!.textContent = `${rig.userData.person} / ${id}`;
  const bone = rigAnchor(rig, 'Head')!;
  const bounds = headBounds(bone), headSize = bounds.getSize(new Vector3());
  const neck = geometryBounds(rig, bone, n => n.name === 'neck');
  const body = new Box3().setFromObject(rig), height = body.getSize(new Vector3()).y;
  // Include torso and neck for proportional QA, with head large enough to inspect.
  const bottom = body.min.y + height * 0.3, top = body.max.y + 0.05;
  const target = new Vector3(0, (bottom + top) / 2, 0);
  const span = Math.max((top - bottom) * 1.08, body.getSize(new Vector3()).x * 650 / 400 * 1.08);
  for (const [i, direction] of [new Vector3(0, 0, 1), new Vector3(1, 0, 0), new Vector3(0, 0, -1)].entries()) {
    const camera = new OrthographicCamera(-span * 400 / 650 / 2, span * 400 / 650 / 2, span / 2, -span / 2, 0.01, 100);
    camera.position.copy(target).addScaledVector(direction, 4); camera.lookAt(target); camera.updateMatrixWorld();
    renderer.setViewport(i * 400, 0, 400, 650); renderer.setScissor(i * 400, 0, 400, 650); renderer.render(scene, camera);
  }
  const cosmetic = geometryBounds(attachment.instance, bone);
  return { neckGap: bounds.min.y - neck.max.y, headHeight: headSize.y,
    head: {min: bounds.min.toArray(), max: bounds.max.toArray()},
    cosmetic: {min: cosmetic.min.toArray(), max: cosmetic.max.toArray()},
    widthRatio: cosmetic.getSize(new Vector3()).x / bone.children.find(n => n.userData.generatedHead)!.userData.fitFrame.faceWidth };
}
(window as any).fitReview = { person, outfit, items };
