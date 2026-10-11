import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({plugins:[react()],resolve:{alias:{'@village/lam-renderer':resolve('tests/fix016-renderer.ts')}},server:{host:'127.0.0.1',port:5198,strictPort:true}});
