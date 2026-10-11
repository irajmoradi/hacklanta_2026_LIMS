import { expect, test } from 'bun:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { configureHeadControls } from './headControls';
import type { LamHead } from './lamRuntime';

test('orbit configuration clamps distance, disables pan, and resets camera and target', () => {
  const camera = new PerspectiveCamera();
  const controls = {enabled: false, enableZoom: false, enableRotate: false, enablePan: true, minDistance: 0, maxDistance: Infinity, target: new Vector3(), update() {}};
  const head = {_renderer: {viewer: {camera, controls}}} as unknown as LamHead;
  const reset = configureHeadControls(head);
  expect(controls).toMatchObject({enabled: true, enableZoom: true, enableRotate: true, enablePan: false, minDistance: .22, maxDistance: 1.5});
  camera.position.set(1, 2, 3); controls.target.set(4, 5, 6); reset();
  expect(camera.position.toArray()).toEqual([0, 1.66, .62]);
  expect(controls.target.toArray()).toEqual([0, 1.66, 0]);
});
