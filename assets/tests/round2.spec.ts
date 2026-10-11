import {expect,test} from '../../apps/web/node_modules/@playwright/test';
import {useDemoSeat} from '../../apps/web/tests/demoSeat';
useDemoSeat();
test('actual garment skins follow the villager arms and retain authored bind bounds',async({page})=>{
  await page.route('**/asset-qa',route=>route.fulfill({contentType:'text/html',body:`<html><body>Asset QA<script type="module">
    import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
    </script></body></html>`}));
  await page.goto('/asset-qa');
  const results=await page.evaluate(async()=>{
    const {loadModel}=await import('/src/scene/OptionalModel.tsx' as string);
    const {attachCosmetic}=await import('/src/scene/cosmeticAssets.ts' as string);
    const {Box3,Vector3}=await import('/node_modules/.vite/deps/three.js' as string);
    const rig=await loadModel('villager_base'); const result=[];
    for(const name of ['shirt_hoodie','jacket_denim']) {
      const source=await loadModel(name);const original=new Box3().setFromObject(source);
      const attachment=attachCosmetic(rig,source,{item_id:name,asset_key:name,slot:'torso'});
      rig.updateMatrixWorld(true);
      const fitted=new Box3().setFromObject(attachment.instance);
      const sleeve=attachment.instance.getObjectByName('sleeve');
      const points=()=>Array.from({length:sleeve.geometry.getAttribute('position').count},(_,i)=>sleeve.getVertexPosition(i,new Vector3()).applyMatrix4(sleeve.matrixWorld));
      sleeve.skeleton.update();const before=points();
      const arm=sleeve.skeleton.bones[sleeve.geometry.getAttribute('skinIndex').getX(0)];arm.rotation.x+=.5;rig.updateMatrixWorld(true);sleeve.skeleton.update();
      result.push({name,error:original.min.distanceTo(fitted.min)+original.max.distanceTo(fitted.max),movement:Math.max(...points().map((point:any,i:number)=>before[i].distanceTo(point)))});
      arm.rotation.x-=.5;attachment.dispose();
    }
    return result;
  });
  for(const result of results){expect(result.error,result.name).toBeLessThan(.001);expect(result.movement,result.name).toBeGreaterThan(.03);}
});
test('house architecture and materials save, render textures, and keep offline controls',async ({page})=>{
  await page.goto('/');
  async function editor() {
    // Pause the background village on software-only CI; the editor canvas stays live.
    await page.evaluate(async()=>{const {_roots}=await import('/node_modules/.vite/deps/@react-three_fiber.js' as string);for(const root of _roots.values())root.store.getState().setFrameloop('never');});
    await page.getByRole('button',{name:'My profile',exact:true}).click();
    await page.getByRole('tab',{name:'House',exact:true}).click();
  }
  await editor();
  await page.getByRole('button',{name:'Cottage',exact:true}).click();
  const architecture=page.locator('fieldset').filter({has:page.locator('legend', {hasText:'Architecture'})});
  await architecture.getByRole('button').nth(1).click();
  await page.getByLabel('wall material',{exact:true}).selectOption('brick');
  await page.getByLabel('roof material',{exact:true}).selectOption('metal');
  const model=await page.locator('.house-preview').getAttribute('data-model');
  await expect.poll(()=>page.evaluate(async()=>{
    const {_roots}=await import('/node_modules/.vite/deps/@react-three_fiber.js' as string);
    const scene=_roots.get(document.querySelector('.house-preview canvas'))?.store.getState().scene;
    let valid=false;scene?.traverse((node:any)=>{for(const m of Array.isArray(node.material)?node.material:[node.material]) if(m?.name==='roof'&&m.metalness===.8&&m.map?.image?.width===128)valid=true;});return valid;
  })).toBe(true);
  await page.getByRole('button',{name:'Save house',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('House saved.');
  await page.setViewportSize({width:1280,height:2300});
  await page.getByRole('heading',{name:'A home that feels like you'}).scrollIntoViewIfNeeded();
  await page.locator('.house-editor').screenshot({path:'assets/previews/round2_house_editor.png'});
  await page.setViewportSize({width:1280,height:1000});
  await page.getByRole('button',{name:'Close profile',exact:true}).click();await editor();
  // Reopening reads the mock API; cross-browser persistence is tested against the scratch API.
  await expect(page.locator('.house-preview')).toHaveAttribute('data-model',new RegExp(`_${model!.split('_').slice(-2).join('_')}$`));
  await expect(page.getByLabel('wall material',{exact:true})).toHaveValue('brick');
  await page.route('**/models/**',route=>route.fulfill({status:404,body:''}));
  await page.reload();await editor();
  await expect(page.getByRole('button',{name:'Save house',exact:true})).toBeEnabled();
  await page.getByLabel('roof material',{exact:true}).selectOption('tile');
  await page.getByRole('button',{name:'Save house',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('House saved.');
});
