import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {useDemoSeat} from './demoSeat';
useDemoSeat();
for(const seed of [1337,42,19,24109]) test(`seed ${seed}: alternating woodland performance`,async({page})=>{
  await page.route('**/src/api/fixtures.ts',async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:(await response.text()).replace(/seed: 24109/g,`seed: ${seed}`)});
  });
  await page.goto('/'); await page.bringToFront();
  await expect(page.getByTestId('villager-Iraj')).toBeVisible();
  await page.waitForTimeout(16000);
  await page.getByRole('button',{name:'Reset camera'}).click();
  const measurements=await page.evaluate(async(seed)=>{
    const apiPath='/src/api/client.ts';
    if((await import(/* @vite-ignore */ apiPath)).api.mode!=='mock')throw new Error('Mock mode required');
    const sceneSource=await(await fetch('/src/scene/VillageScene.tsx')).text();
    const fiberPath=sceneSource.match(/from "([^" ]*@react-three_fiber[^" ]*)"/)![1];
    const treeSource=await(await fetch('/src/scene/InstancedTrees.tsx')).text();
    const threePath=treeSource.match(/import \* as THREE from "([^"]+)"/)![1];
    const THREE=await import(/* @vite-ignore */ threePath);
    const {_roots}=await import(/* @vite-ignore */ fiberPath);
    const state=_roots.get(document.querySelector('.scene canvas')).store.getState();
    const {scene,gl,camera,controls,clock}=state;
    const townPath='/src/scene/layout/town.ts',decorPath='/src/scene/layout/variety.ts';
    const baselinePath='/tests/web050-history/main-variety.ts',registryPath='/src/scene/registry.ts';
    const {createTown}=await import(/* @vite-ignore */ townPath);
    const entries=(await import(/* @vite-ignore */ registryPath)).registry;
    const town=createTown(seed,entries,[0,1,2,3,4]);
    const layouts={
      before:(await import(/* @vite-ignore */ baselinePath)).townDecor(town),
      after:(await import(/* @vite-ignore */ decorPath)).townDecor(town),
    };
    type Tree={role:string;p:number[];scale:number[];rotation:number;lean?:number;shade:string};
    const placement=(d:Tree)=>new THREE.Matrix4().compose(new THREE.Vector3(d.p[0],0,d.p[2]),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(d.lean??0,d.rotation,0)),new THREE.Vector3(...d.scale));
    const batches:Array<{mesh:any;role:string;part:any;setMatrix:any;setColor:any}>=[];
    scene.getObjectByName('grid-town').traverse((mesh:any)=>{
      if(!mesh.isInstancedMesh || !mesh.name.startsWith('trees:'))return;
      const role=mesh.name.split(':')[1],trees=layouts.after.filter((d:Tree)=>d.role===role);
      if(mesh.count!==trees.length)throw new Error(`Unexpected ${role} count: rendered ${mesh.count}, expected ${trees.length}`);
      const original=new THREE.Matrix4();mesh.getMatrixAt(0,original);
      // The live instance is placement * normalized model-part matrix. Recover
      // the latter so both layouts use exactly the same loaded GLB geometry.
      const part=placement(trees[0]).invert().multiply(original);
      const setMatrix=mesh.setMatrixAt.bind(mesh),setColor=mesh.setColorAt.bind(mesh);
      batches.push({mesh,role,part,setMatrix,setColor});
      // Keep background React refreshes from replacing the controlled matrices.
      mesh.setMatrixAt=()=>{};mesh.setColorAt=()=>{};
    });
    if(new Set(batches.map(b=>b.role)).size!==3)throw new Error('All three tree species must be loaded');
    const apply=(stage:'before'|'after')=>{
      for(const {mesh,role,part,setMatrix,setColor} of batches) {
        const trees=layouts[stage].filter((d:Tree)=>d.role===role);
        if(trees.length>mesh.instanceMatrix.count)throw new Error('Instance capacity exceeded');
        mesh.count=trees.length;
        trees.forEach((d:Tree,i:number)=>{setMatrix(i,placement(d).multiply(part));setColor(i,new THREE.Color(d.shade));});
        mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();
      }
    };
    const originalDelta=clock.getDelta;
    clock.getDelta=()=>0; // Same stationary actors and animation pose in each sample.
    controls.enableDamping=false;
    const context=gl.getContext(),ext=context.getExtension('WEBGL_debug_renderer_info');
    const renderer=ext?context.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown';
    const measurements=[];
    try {
      for(const view of ['overview','street']) {
        if(view==='street') {
          const home=scene.getObjectByName('home:00000000-0000-4000-8000-000000000001');
          const target=home.getWorldPosition(camera.position.clone());target.y=0;
          controls.target.copy(target);camera.position.copy(target).add({x:14,y:12,z:20});
          camera.zoom=23;camera.updateProjectionMatrix();controls.update();
        }
        const samples:Array<{stage:string;frames:number;milliseconds:number;fps:number;calls:number;dpr:number;shadows:boolean}>=[];
        // Prime both layouts after every camera move before measuring. On the
        // software renderer the first camera window can take twice as long.
        for(const stage of ['before','after'] as const) {
          apply(stage);await new Promise<void>(resolve=>setTimeout(resolve,10000));
        }
        // Balanced ABBA cancels linear drift; each layout gets 30 timed seconds.
        const order=view==='overview'?['before','after','after','before'] as const
          :['after','before','before','after'] as const;
        for(const stage of order) {
          apply(stage);
          await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
          const calls:number[]=[];const start=performance.now();let end=start;
          await new Promise<void>(resolve=>{
            const frame=(now:number)=>{end=now;calls.push(gl.info.render.calls);
              if(now-start<15000)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);
          });
          samples.push({stage,frames:calls.length,milliseconds:end-start,fps:calls.length*1000/(end-start),
            calls:calls.sort((a,b)=>a-b)[Math.floor(calls.length/2)],dpr:gl.getPixelRatio(),shadows:gl.shadowMap.enabled});
        }
        const summary=(stage:string)=>{
          const selected=samples.filter(s=>s.stage===stage);
          return {fps:selected.reduce((n,s)=>n+s.frames,0)*1000/selected.reduce((n,s)=>n+s.milliseconds,0),
            calls:Math.max(...selected.map(s=>s.calls))};
        };
        measurements.push({view,renderer,before:summary('before'),after:summary('after'),samples});
      }
    } finally {
      apply('after');clock.getDelta=originalDelta;
      for(const {mesh,setMatrix,setColor} of batches){mesh.setMatrixAt=setMatrix;mesh.setColorAt=setColor;}
    }
    return measurements;
  },seed);
  mkdirSync('artifacts/web050',{recursive:true});
  writeFileSync(`artifacts/web050/paired-${seed}-performance.json`,JSON.stringify(measurements,null,2));
  for(const m of measurements) {
    expect.soft(new Set(m.samples.map(s=>`${s.dpr}:${s.shadows}`)).size).toBe(1);
    expect.soft(m.after.calls,`${seed} ${m.view}: calls`).toBeLessThanOrEqual(m.before.calls*1.05);
    expect.soft(m.after.fps,`${seed} ${m.view}: FPS`).toBeGreaterThanOrEqual(m.before.fps*.95);
  }
});
