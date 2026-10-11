import {defineConfig} from 'vite';
import {resolve} from 'node:path';
export default defineConfig({root:import.meta.dirname,resolve:{alias:{'@audio-engine':resolve(import.meta.dirname,'../../apps/web/src/sound/engine.ts'),'@baseline-audio':resolve(import.meta.dirname,'../../assets/audio/before-night.mp3')}},publicDir:resolve(import.meta.dirname,'../../apps/web/public'),cacheDir:resolve(import.meta.dirname,'.cache'),server:{host:'127.0.0.1',port:5197,strictPort:true,fs:{allow:[resolve(import.meta.dirname,'../..')]} }});
