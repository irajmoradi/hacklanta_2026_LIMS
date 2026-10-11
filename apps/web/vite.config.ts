import { apiProxy } from './apiProxy';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { lamLifecyclePatch } from './lamLifecyclePatch';
import { performanceAssets } from './performanceAssets';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const apiTarget = process.env.VILLAGE_API_URL ?? 'http://localhost:8010';
const supplied = process.env.VILLAGE_ENV_FILE?.replace(/^\/([a-z])\//i, '$1:/');
// Read only public values; never inline process.env or load server secrets.
const publicEnv = supplied ? loadEnv(process.env.NODE_ENV || 'development', dirname(supplied), 'VITE_') : {};
for (const [key, value] of Object.entries(publicEnv)) if (process.env[key] === undefined) process.env[key] = value;

// Vite exposes only VITE_*; envDir also supports the normal repository-root .env.
export default defineConfig({
  envDir: root,
  resolve: { alias: { '@village/lam-renderer': resolve(root, 'packages/lam-renderer/src/index.ts'), 'gaussian-splat-renderer-for-lam': resolve(root, 'apps/web/node_modules/gaussian-splat-renderer-for-lam') } },
  plugins: [lamLifecyclePatch(), react(), performanceAssets(resolve(root, 'apps/web'))],
  optimizeDeps: { exclude: ['gaussian-splat-renderer-for-lam'] },
  server: { allowedHosts: ['.trycloudflare.com'], port: 5173, strictPort: true, proxy: { '/api': apiProxy(apiTarget) } },
  // Public demo via Cloudflare quick tunnel (D-029).
  preview: { allowedHosts: ['.trycloudflare.com', '.sslip.io'], proxy: { '/api': apiProxy(apiTarget) } },
  build: { rollupOptions: { output: { manualChunks: { three: ['three', '@react-three/fiber', '@react-three/drei'] } } } },
});
