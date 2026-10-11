import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {mergeConfig, type Plugin} from 'vite';
import base from '../vite.config';

// Only the performance harness can load archived pre-SCALE scene modules.
// Their original module IDs preserve relative imports; production builds never
// load this config or these snapshots.
const baseline: Plugin = {
  name:'scale001-baseline', enforce:'pre',
  load(id) {
    if(process.env.SCALE_LABEL !== 'before') return null;
    for(const name of ['VillageScene.tsx','TownLabel.tsx','LabelSpacing.tsx']) {
      const original=fileURLToPath(new URL(`../src/scene/${name}`,import.meta.url)).replaceAll('\\','/');
      if(id.split('?')[0].replaceAll('\\','/')===original)
        return readFileSync(new URL(`./scale001-baseline/${name}.txt`,import.meta.url),'utf8');
    }
    return null;
  },
};
export default mergeConfig(base,{plugins:[baseline]});
