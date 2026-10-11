// Start the disposable API (scripts/feat009_preview.py) and Vite on 5299 first.
// node tests/perf/town.mjs [before|after] [hardware|swiftshader]
import {chromium} from '@playwright/test';
import {mkdirSync, writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
const stage=process.argv[2]??'after', mode=process.argv[3]??'hardware';
const dir=process.env.VILLAGE_PERF_DIR??'artifacts/integ007'; mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:mode!=='hardware',args:mode==='hardware'
  ? ['--enable-gpu','--ignore-gpu-blocklist','--use-angle=d3d11']
  : ['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const errors=[];
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.addInitScript(()=>localStorage.setItem('village:seat:live','13370000-0000-4000-8000-000000000001'));
 page.setDefaultTimeout(60000); page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5299'); await page.bringToFront();
 await page.locator('.scene canvas').waitFor(); await page.waitForTimeout(15000);
 console.log('Town ready');
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Tracing.start',{categories:'devtools.timeline,v8,blink.user_timing',transferMode:'ReturnAsStream'});
 console.log('Trace started');
 const result=await page.evaluate(async()=>{
  const source=await (await fetch('/src/scene/VillageScene.tsx')).text();
  const url=source.match(/from "([^" ]*@react-three_fiber[^" ]*)"/)[1];
  const {_roots}=await import(url);
  const {gl,scene}=_roots.get(document.querySelector('.scene canvas')).store.getState();
  // Capture the scene pass before a compositor's output pass resets gl.info.
  const render=gl.render.bind(gl);let sceneCalls=0,sceneTriangles=0;
  gl.render=(...args)=>{render(...args);if(args[0]===scene){sceneCalls=gl.info.render.calls;sceneTriangles=gl.info.render.triangles;}};
  const frames=[],calls=[]; let previous=performance.now(),start=previous;
  await new Promise(resolve=>{const frame=now=>{frames.push(now-previous);if(sceneCalls)calls.push(sceneCalls);previous=now;if(now-start<10000)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});
  const context=gl.getContext(),ext=context.getExtension('WEBGL_debug_renderer_info');
  const objects=[];scene.traverse(o=>{if(/^(unlocked|home|villager):/.test(o.name)){let meshes=0;o.traverse(n=>{if(n.isMesh)meshes++;});objects.push({name:o.name,meshes});}});
  gl.render=render;
  return {fps:frames.length*1000/(previous-start),p95Ms:[...frames].sort((a,b)=>a-b)[Math.floor(frames.length*.95)],calls:Math.round(calls.reduce((a,b)=>a+b)/calls.length),triangles:sceneTriangles,renderer:ext?context.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown',dpr:gl.getPixelRatio(),shadows:gl.shadowMap.enabled,shadowAutoUpdate:gl.shadowMap.autoUpdate,objects};
 });
 console.log('Sample complete',result.fps);
 const complete=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');
 const {stream}=await complete;let trace='';while(true){const chunk=await cdp.send('IO.read',{handle:stream});trace+=chunk.data;if(chunk.eof)break;}await cdp.send('IO.close',{handle:stream});
 writeFileSync(`${dir}/${stage}-${mode}-trace.json.gz`,gzipSync(trace));
 result.errors=errors; result.viewport={width:1440,height:1000}; result.headed=mode==='hardware';
 writeFileSync(`${dir}/${stage}-${mode}.json`,JSON.stringify(result,null,2));
 await page.screenshot({path:`${dir}/${stage}-${mode}.png`});console.log(JSON.stringify(result,null,2));
 if(errors.length) throw new Error(errors.join('\n'));
 if(stage==='after'&&mode==='hardware'&&(!result.renderer.includes('5090')||result.fps<55))process.exitCode=1;
} finally {await browser.close();}
