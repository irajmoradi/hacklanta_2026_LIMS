import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('pre-render pointer reproduces the missing body with Lance’s real head and loadout', async ({page})=>{
  const baseline=process.env.FIX015_BASELINE==='1';
  await page.route('**/api/**',r=>r.request().method()==='GET'?r.continue():r.abort());
  if(baseline)await page.route('**/src/scene/headFit.ts*',async route=>{
    const response=await route.fetch(); const source=await response.text();
    expect(source).toContain('root.updateMatrixWorld(true)');
    // Replay the original implementation in this browser only, without editing
    // production files or interrupting another test's Vite session.
    await route.fulfill({response,body:source.replace('root.updateWorldMatrix(true, false)', 'root.updateWorldMatrix(true, true)').replace('root.updateMatrixWorld(true);','')});
  });
  await page.goto('/tests/fix008.html');
  await page.waitForFunction(()=>(window as any).fitMatrix,null,{timeout:120000});
  const result=await page.evaluate(async()=>{
    const matrix=(window as any).fitMatrix;
    await matrix.person(2);
    return matrix.outfit(['','hat_festival','','','','decor_flowers','house_backyard','pet_dog']);
  });
  const output='artifacts/fix015';await mkdir(output,{recursive:true});
  await writeFile(`${output}/${baseline?'before':'after'}-lance.png`,Buffer.from(result.image.split(',')[1],'base64'));
  delete result.image;
  await writeFile(`${output}/${baseline?'before':'after'}-lance.json`,JSON.stringify(result,null,2));
  expect(result.body.parts.sort()).toEqual(['leg_L','leg_R','torso']);
  expect(result.body.height).toBeGreaterThanOrEqual(result.body.baseBodyHeight*.8);
  if(baseline)expect(result.body.culledBody).toHaveLength(6);
  else expect(result.failures).toEqual([]);
});

test('live town retains all five bodies, including Lance without a torso item', async ({page}) => {
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',r=>r.request().method()==='GET'?r.continue():r.abort());
  await page.addInitScript(()=>{
    localStorage.setItem('village:seat:live','13370000-0000-4000-8000-000000000001');
    Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>4});
  });
  await page.goto('/');
  console.log('live town loaded');
  await expect(page.locator('[data-head-kind="glb"]')).toHaveCount(5,{timeout:60000});
  console.log('five generated heads ready');
  await expect(page.getByTestId('villager-Lance')).toHaveAttribute('data-cosmetics',/hat_festival/);
  await page.waitForTimeout(2000);
  const output='artifacts/fix015'; await mkdir(output,{recursive:true});
  const measurements=await page.evaluate(async()=>{
    const {_roots}=await import('/node_modules/.vite/deps/@react-three_fiber.js' as string);
    const {bodyVisibility}=await import('/tests/bodyVisibility.ts' as string);
    const {cloneModel,loadModel}=await import('/src/scene/OptionalModel.tsx' as string);
    const {api}=await import('/src/api/client.ts' as string);
    const {Frustum,Matrix4}=await import('/node_modules/.vite/deps/three.js' as string);
    const state=_roots.get(document.querySelector('.scene canvas')).store.getState();
    const reference=bodyVisibility(cloneModel(await loadModel('villager_base'),1.8)).height;
    const frustum=new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(state.camera.projectionMatrix,state.camera.matrixWorldInverse));
    const villagers:any[]=[];
    state.scene.traverse((node:any)=>{
      if(!node.name.startsWith('villager:'))return;
      // Gaming intentionally hides the character. Inspect its mounted body and
      // restore visibility immediately; the matrix guards every standing loadout.
      const bodyGroup=node.children[1],visible=bodyGroup.visible;
      bodyGroup.visible=true;
      const body=bodyVisibility(node);
      const culled=['torso','leg_L','leg_R'].filter(name=>{const mesh=node.getObjectByName(name);return !mesh || (mesh.frustumCulled&&!frustum.intersectsObject(mesh));});
      bodyGroup.visible=visible;
      villagers.push({id:node.name,body,reference,culled,intentionallyHidden:!visible});
    });
    const village=await api.village('13370000-0000-4000-8000-000000000000');
    const lance=village.villagers.find((p:any)=>p.display_name==='Lance');
    return {villagers,lance:{items:lance.equipped.map((i:any)=>i.item_id),shirt:lance.avatar.body.colors.shirt},mode:api.mode};
  });
  expect(measurements.mode).toBe('live');
  expect(measurements.lance.items.sort()).toEqual(['decor_flowers','hat_festival','house_backyard','pet_dog']);
  expect(measurements.lance.shirt.toLowerCase()).toBe('#ccc0bc');
  expect(measurements.villagers).toHaveLength(5);
  for(const person of measurements.villagers) {
    expect(person.body.parts.sort(),person.id).toEqual(['leg_L','leg_R','torso']);
    expect(person.body.height,person.id).toBeGreaterThanOrEqual(person.reference*.8);
    expect(person.culled,person.id).toEqual([]);
  }
  await page.screenshot({path:`${output}/town-all-five.png`});
  console.log('all five bodies measured and town captured');
  // Stage the already-mounted town avatars for a readable close-up; no API writes.
  await page.addStyleTag({content:'.scene-label { visibility: hidden !important; }'});
  await page.evaluate(async()=>{
    const {_roots}=await import('/node_modules/.vite/deps/@react-three_fiber.js' as string);
    const {Vector3}=await import('/node_modules/.vite/deps/three.js' as string);
    const {clone}=await import('/node_modules/three/examples/jsm/utils/SkeletonUtils.js' as string);
    const state=_roots.get(document.querySelector('.scene canvas')).store.getState();
    state.setFrameloop('never');
    const villagers:any[]=[];state.scene.traverse((n:any)=>{if(n.name.startsWith('villager:'))villagers.push(n);});
    villagers.sort((a,b)=>a.name.localeCompare(b.name));
    villagers.forEach((n,i)=>{
      // Owned clones prevent an already-scheduled character frame from moving
      // the lineup back home between the manual render and screenshot.
      const copy=clone(n);n.visible=false;copy.visible=true;state.scene.add(copy);
      copy.position.set((i-2)*2.5,.06,7);copy.children[1].visible=true;copy.children[1].rotation.set(0,0,0);
    });
    state.camera.position.set(0,5,24);state.controls.target.set(0,1,7);state.camera.zoom=100;
    state.camera.updateProjectionMatrix();state.controls.update();state.gl.render(state.scene,state.camera);
    const rect=state.gl.domElement.getBoundingClientRect();
    ['Iraj','Lance','Stefanny','Maya','Mario'].forEach((name,i)=>{
      const point=new Vector3((i-2)*2.5,2.4,7).project(state.camera);
      const label=document.createElement('div');label.textContent=name;
      Object.assign(label.style,{position:'fixed',left:`${rect.left+(point.x+1)*rect.width/2}px`,top:`${rect.top+(1-point.y)*rect.height/2}px`,transform:'translateX(-50%)',padding:'5px 10px',background:'#faf8ed',borderRadius:'6px',color:'#344b2a',zIndex:'100'});
      document.body.append(label);
    });
  });
  await page.screenshot({path:`${output}/town-lineup.png`});
  await writeFile(`${output}/town-bodies.json`,JSON.stringify({...measurements,errors},null,2));
  expect(errors).toEqual([]);
});
