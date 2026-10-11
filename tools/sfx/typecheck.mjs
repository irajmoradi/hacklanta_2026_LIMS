import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'../..');
const dependencies=resolve(process.argv[2]??`${root}/apps/web/node_modules`).replaceAll('\\','/');
mkdirSync(`${import.meta.dirname}/.cache`,{recursive:true});
const config={extends:'../../../apps/web/tsconfig.json',compilerOptions:{baseUrl:'../../..',paths:{'@village/lam-renderer':['packages/lam-renderer/src/index.ts'],'*': [dependencies+'/@types/*',dependencies+'/*']},typeRoots:[dependencies+'/@types',dependencies]},include:['../../../apps/web/src/sound/**/*','../../../apps/web/src/scene/**/*','../../../packages/lam-renderer/src/vendor.d.ts']};
const file=`${import.meta.dirname}/.cache/tsconfig.json`;writeFileSync(file,JSON.stringify(config,null,2));
const result=spawnSync(process.execPath,[resolve(import.meta.dirname,'node_modules/typescript/bin/tsc'),'--project',file,'--noEmit'],{stdio:'inherit'});process.exitCode=result.status??1;
