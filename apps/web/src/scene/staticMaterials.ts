import type { MeshStandardMaterial } from 'three';

const pool = new Map<string, {material: MeshStandardMaterial; users: number}>();
/** One lease per model. Glass stays private because gaming/blackout animate it. */
export function staticMaterialLease() {
  const keys = new Set<string>();
  return {
    acquire(key: string, make: () => MeshStandardMaterial) {
      let entry = pool.get(key);
      if (!entry) {entry = {material: make(), users: 0}; pool.set(key, entry);}
      if (!keys.has(key)) {keys.add(key); entry.users++;}
      return entry.material;
    },
    release() {
      for (const key of keys) {
        const entry = pool.get(key)!;
        if (--entry.users === 0) {entry.material.dispose(); pool.delete(key);}
      }
      keys.clear();
    },
  };
}
