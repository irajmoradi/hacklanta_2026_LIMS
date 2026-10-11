import { mergeConfig } from 'vite';
import { resolve } from 'node:path';
import base from './vite.config';

// Test-only synthetic renderer; production continues to load the actual LAM package.
export default mergeConfig(base, {resolve: {alias: {'@village/lam-renderer': resolve('tests/headRenderer.fixture.ts')}}});
