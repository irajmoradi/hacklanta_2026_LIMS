import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { Mesh } from 'three';
import { fitnessAsset } from '../src/scene/fitnessAsset';

// The exporter expects the browser FileReader API, even for a binary-only export.
globalThis.FileReader = class {
  result: ArrayBuffer | null = null;
  onloadend?: () => void;
  async readAsArrayBuffer(blob: Blob) { this.result = await blob.arrayBuffer(); this.onloadend?.(); }
} as unknown as typeof FileReader;
const model = fitnessAsset();
let triangles = 0;
model.traverse(node => { if (node instanceof Mesh) triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count)/3; });
if (triangles > 4000) throw new Error(`Fitness asset exceeds budget: ${triangles}`);
const bytes = await new GLTFExporter().parseAsync(model, {binary:true});
await Bun.write(new URL('../public/models/fitness_corner.glb', import.meta.url), bytes as ArrayBuffer);
console.log(`fitness_corner: ${triangles} triangles`);
