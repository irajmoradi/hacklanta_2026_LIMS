/** Tiny, synthetic self-contained GLB generated in memory; no real portrait/model assets. */
export function headFixture(rig = false): Buffer {
  const geometry = new Float32Array([-0.35, 0, 0, 0.35, 0, 0, 0, 0.65, 0]);
  const json = JSON.stringify({asset: {version: '2.0'}, scene: 0, scenes: [{nodes: [0]}],
    nodes: rig ? [{children: [1, 2]}, {mesh: 0, name: 'shirt'}, {name: 'Head', translation: [0, 0.7, 0], children: [3]}, {mesh: 0, name: 'head'}] : [{mesh: 0, name: 'synthetic-head'}],
    ...(rig ? {skins: [{joints: [2]}]} : {}),
    meshes: [{primitives: [{attributes: {POSITION: 0}, material: 0}]}], materials: [{doubleSided: true, pbrMetallicRoughness: {baseColorFactor: [0.9, 0.55, 0.3, 1], metallicFactor: 0}}],
    buffers: [{byteLength: geometry.byteLength}], bufferViews: [{buffer: 0, byteOffset: 0, byteLength: geometry.byteLength}],
    accessors: [{bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-0.35, 0, 0], max: [0.35, 0.65, 0]}]});
  const encoded = Buffer.from(json.padEnd(Math.ceil(json.length / 4) * 4, ' '));
  const bytes = Buffer.alloc(28 + encoded.length + geometry.byteLength);
  bytes.writeUInt32LE(0x46546c67, 0); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(encoded.length, 12); bytes.writeUInt32LE(0x4e4f534a, 16); encoded.copy(bytes, 20);
  bytes.writeUInt32LE(geometry.byteLength, 20 + encoded.length); bytes.writeUInt32LE(0x004e4942, 24 + encoded.length);
  Buffer.from(geometry.buffer).copy(bytes, 28 + encoded.length); return bytes;
}
