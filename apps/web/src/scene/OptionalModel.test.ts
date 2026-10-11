import { expect, test } from 'bun:test';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { cloneModel, loadModel } from './OptionalModel';

test('GLB loader parses a supplied model once and tolerates 404/HTML assets', async () => {
  const geometry = new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0, 1, 0]);
  const json = JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], buffers: [{ byteLength: geometry.byteLength }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: geometry.byteLength }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-0.5, 0, 0], max: [0.5, 1, 0] }] });
  const encoded = new TextEncoder().encode(json.padEnd(Math.ceil(json.length / 4) * 4, ' '));
  const bytes = new Uint8Array(12 + 8 + encoded.length + 8 + geometry.byteLength), header = new DataView(bytes.buffer);
  header.setUint32(0, 0x46546c67, true); header.setUint32(4, 2, true); header.setUint32(8, bytes.length, true);
  header.setUint32(12, encoded.length, true); header.setUint32(16, 0x4e4f534a, true); bytes.set(encoded, 20);
  header.setUint32(20 + encoded.length, geometry.byteLength, true); header.setUint32(24 + encoded.length, 0x004e4942, true); bytes.set(new Uint8Array(geometry.buffer), 28 + encoded.length);
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async (url: string) => { calls++; return url.includes('missing') ? new Response('', { status: 404 }) : url.includes('html') ? new Response('<html>SPA fallback</html>') : new Response(bytes); }) as unknown as typeof fetch;
  try {
    const [a, b] = await Promise.all([loadModel('synthetic'), loadModel('synthetic')]);
    expect(a).not.toBeNull(); expect(a).toBe(b); expect(calls).toBe(1);
    let meshes = 0; a!.traverse(node => { if (node instanceof Mesh) meshes++; }); expect(meshes).toBe(1);
    expect(await loadModel('missing')).toBeNull(); expect(await loadModel('html')).toBeNull();
  } finally { globalThis.fetch = original; }
});

test('cloned villagers tint independently without changing cached model materials', () => {
  const source = new Group(), material = new MeshStandardMaterial({ color: '#ffffff' }); material.name = 'shirt';
  source.add(new Mesh(new BoxGeometry(1, 2, 1), material));
  const palette = { shirt: '#ff0000', hair: '#000000', pants: '#000000', shoes: '#000000', skin: '#eeeeee' };
  const a = cloneModel(source, 1.8, palette), b = cloneModel(source, 1.8, { ...palette, shirt: '#0000ff' });
  const getMaterial = (group: Group) => ((group.children[0] as Group).children[0] as Mesh).material as MeshStandardMaterial;
  expect(getMaterial(a).color.getHexString()).toBe('ff0000');
  expect(getMaterial(b).color.getHexString()).toBe('0000ff');
  getMaterial(a).color.set('#00ff00');
  expect(getMaterial(b).color.getHexString()).toBe('0000ff');
  expect(material.color.getHexString()).toBe('ffffff');
});

test('material reuse respects node-specific palette variants and instance isolation', () => {
  const source = new Group(), material = new MeshStandardMaterial({color:'#ffffff'});
  for (const name of ['shirt_left', 'shirt_right', 'skin_face']) {
    const mesh = new Mesh(new BoxGeometry(), material); mesh.name = name; source.add(mesh);
  }
  const palette = {skin:'#ffccaa', shirt:'#224466'};
  const first = cloneModel(source, 1, palette), second = cloneModel(source, 1, palette);
  const get = (root: Group, name: string) => (root.getObjectByName(name) as Mesh).material as MeshStandardMaterial;
  expect(get(first, 'shirt_left')).toBe(get(first, 'shirt_right'));
  expect(get(first, 'shirt_left')).not.toBe(get(first, 'skin_face'));
  expect(get(first, 'shirt_left')).not.toBe(get(second, 'shirt_left'));
  expect(get(first, 'skin_face').color.getHexString()).toBe('ffccaa');
  expect(material.color.getHexString()).toBe('ffffff');
});
