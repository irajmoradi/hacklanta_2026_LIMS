// Render the cached generated object, with its real mesh, using the web app's Three.js.
import {createRequire} from 'node:module';
import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,readdirSync,existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const require=createRequire(`${process.cwd()}/package.json`),{chromium}=require('@playwright/test');
const out=resolve('../trailer/artifacts/scratch');mkdirSync(out,{recursive:true});
const server=spawn('bun',['run','dev','--port','5198'],{env:{...process.env,VILLAGE_API_URL:'http://127.0.0.1:1',VILLAGE_ENV_FILE:'/dev/null'},stdio:'ignore'});
const origin='http://127.0.0.1:5198';
for(let i=0;i<120;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
const base=process.env.PLAYWRIGHT_BROWSERS_PATH||'/opt/playwright',dir=readdirSync(base).filter(x=>x.startsWith('chromium-')).sort().at(-1);
const executablePath=['chrome-linux64/chrome','chrome-linux/chrome'].map(x=>`${base}/${dir}/${x}`).find(existsSync);
const browser=await chromium.launch({executablePath,args:['--use-gl=angle','--use-angle=swiftshader']});
const context=await browser.newContext({viewport:{width:1920,height:1080},recordVideo:{dir:`${out}/raw`,size:{width:1920,height:1080}}});
await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
await context.route('**/plant.glb',r=>r.fulfill({body:readFileSync(resolve('../trailer/public/captures/plant.glb')),contentType:'model/gltf-binary'}));
await context.route('**/turntable',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#e9eee1"><div style="position:absolute;left:80px;top:140px;font:40px sans-serif;color:#244c37">Hunyuan3D<br><small>Existing generated plant</small><p id="label">Textured object</p><p style="font-size:24px">3,000 faces · production CV output<br>Reused without new generation</p></div><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script><script type="module">
import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const r=new T.WebGLRenderer({antialias:true});r.setSize(1920,1080);document.body.appendChild(r.domElement);const s=new T.Scene();s.background=new T.Color('#e9eee1');const c=new T.PerspectiveCamera(35,1920/1080,.01,100);c.position.set(1.25,.8,1.6);c.lookAt(-.3,.3,0);s.add(new T.HemisphereLight(0xffffff,0x62724f,2));const l=new T.DirectionalLight(0xffffff,3);l.position.set(2,3,4);s.add(l);const g=(await new GLTFLoader().loadAsync('/plant.glb')).scene;s.add(g);window.ready=true;let start;window.begin=()=>start=performance.now();function animate(){requestAnimationFrame(animate);const t=start?(performance.now()-start)/1000:0;g.rotation.y=t*.5;g.traverse(o=>{if(o.isMesh){for(const m of Array.isArray(o.material)?o.material:[o.material])m.wireframe=t>2&&t<4;}});document.getElementById('label').textContent=t>2&&t<4?'Mesh / 3,000 faces':'Textured object';r.render(s,c)}animate();</script></body></html>`}));
const page=await context.newPage(),created=Date.now();let start;
try{await page.goto(`${origin}/turntable`);await page.waitForFunction(()=>window.ready,{timeout:60000});start=(Date.now()-created)/1000;await page.evaluate(()=>window.begin());await page.waitForTimeout(6500);await page.screenshot({path:`${out}/object-turntable.png`});}finally{await context.close();await browser.close();server.kill();}
execFileSync('ffmpeg',['-v','error','-y','-ss',String(start),'-i',await page.video().path(),'-t','6','-an','-c:v','libx264','-preset','fast','-crf','17',`${out}/object-turntable.mp4`],{stdio:'inherit'});
