import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { Box3, Frustum, Matrix4, Mesh, OrthographicCamera, Raycaster, SkinnedMesh, SphereGeometry, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { cloneModel } from './OptionalModel';
import { prepareEmoteRig } from './emotes';
import { attachHead } from './headAssets';
import { bodyVisibility } from '../../tests/bodyVisibility';

test('a pre-render head fit and pointer raycast cannot cull the body at its town position', async () => {
  const bytes = readFileSync(new URL('../../public/models/villager_base.glb', import.meta.url));
  const source = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const rig = cloneModel(source.scene, 1.8);
  prepareEmoteRig(rig);
  const baseHeight = bodyVisibility(rig).height;
  rig.position.set(-6, 0, -24);
  const head = new Mesh(new SphereGeometry(.5));
  const detach = attachHead(rig, head)!;
  // Pointer events can arrive after asynchronous fitting but before the next draw.
  new Raycaster(new Vector3(-6, 2, -20), new Vector3(0, 0, -1)).intersectObject(rig, true);
  rig.updateMatrixWorld(true);
  const camera = new OrthographicCamera(-2, 2, 2, -2, .1, 20);
  camera.position.set(-6, 1, -20); camera.lookAt(-6, 1, -24); camera.updateMatrixWorld();
  const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  for (const name of ['torso', 'leg_L', 'leg_R']) {
    const mesh = rig.getObjectByName(name) as SkinnedMesh;
    const actual = new Box3().setFromObject(mesh, true);
    expect(frustum.intersectsBox(actual), `${name} actually in view`).toBe(true);
    expect(!mesh.frustumCulled || frustum.intersectsObject(mesh), `${name} submitted to renderer`).toBe(true);
  }
  const body = bodyVisibility(rig);
  expect(body.parts.sort()).toEqual(['leg_L', 'leg_R', 'torso']);
  expect(body.height).toBeGreaterThanOrEqual(baseHeight * .8);
  detach();
});
