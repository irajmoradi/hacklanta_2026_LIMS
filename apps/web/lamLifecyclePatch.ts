import type { Plugin } from 'vite';

// 0.0.9-alpha.1 returns getInstance before addSplatScene settles and leaves its
// rejection unhandled. Await the scene so our mount queue owns the whole load.
// Kept here because the shared renderer package is outside FIX-003's scope.
export function lamLifecyclePatch(): Plugin {
  return {
    name: 'lam-await-scene',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/gaussian-splat-renderer-for-lam/build/gaussian-splat-renderer-for-lam.module.js')) return;
      const source = /renderer\.viewer\s*\.addSplatScene\(offsetFileUrl,/g;
      if ([...code.matchAll(source)].length !== 1) throw new Error('LAM load patch needs review for this renderer version');
      return { code: code.replace(source, 'yield renderer.viewer.addSplatScene(offsetFileUrl,'), map: null };
    },
  };
}
