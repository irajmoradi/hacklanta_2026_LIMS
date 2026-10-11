import { test, expect } from '@playwright/test';
import { useDemoSeat } from './demoSeat';
useDemoSeat();

for(const width of [1440,390]) test(`bottoms, shoes, glasses and dye at ${width}px`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width,height:1000});await page.goto('/');
  await page.getByRole('button',{name:'Shop',exact:true}).click();
  for(const [tab,name] of [['Bottoms','Jeans'],['Shoes','Sneakers'],['Glasses','Wire Round Glasses']]) {
    await page.getByRole('tab',{name:tab,exact:true}).click();
    const card=page.locator('.shop-item').filter({has:page.getByRole('button',{name:`Buy ${name}`,exact:true})});
    await card.getByRole('button',{name:`Buy ${name}`,exact:true}).click();
    await expect(card.getByRole('button',{name:`Unequip ${name}`,exact:true})).toBeVisible();
  }
  await page.getByRole('tab',{name:'My wardrobe',exact:true}).click();
  await page.getByRole('tab',{name:'Bottoms',exact:true}).click();
  await page.getByRole('button',{name:'Colors for Jeans',exact:true}).click();
  const panel=page.getByRole('region',{name:'Colors for Jeans'});
  await panel.getByRole('button',{name:'Twilight',exact:true}).click();
  await panel.getByLabel('Custom hex').fill('#8876a8');
  await panel.getByRole('button',{name:'Save colors',exact:true}).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByTestId('villager-Iraj')).toHaveAttribute('data-cosmetics',/bottoms_jeans/);
  await expect(page.getByTestId('villager-Iraj')).toHaveAttribute('data-cosmetics',/footwear_sneakers/);
  await page.locator('.wardrobe-preview').scrollIntoViewIfNeeded();
  await page.screenshot({path:`artifacts/asset013/wardrobe-${width}.png`});
  await page.getByRole('button',{name:'Unequip Jeans',exact:true}).click();
  await page.getByRole('button',{name:'Equip Jeans',exact:true}).click();
  await page.getByRole('button',{name:'Colors for Jeans',exact:true}).click();
  await expect(panel.getByLabel('Custom hex')).toHaveValue('#8876a8');
  expect(errors).toEqual([]);
});

test('missing all models still equips lower clothing without errors',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/models/**',r=>r.fulfill({status:404,body:''}));
  await page.goto('/');await page.getByRole('button',{name:'Shop',exact:true}).click();
  for(const [tab,name,id] of [['Bottoms','Jeans','bottoms_jeans'],['Shoes','Sneakers','footwear_sneakers']]) {
    await page.getByRole('tab',{name:tab,exact:true}).click();
    await page.getByRole('button',{name:`Buy ${name}`,exact:true}).click();
    await expect(page.getByTestId('villager-Iraj')).toHaveAttribute('data-cosmetics',new RegExp(id));
  }
  expect(errors).toEqual([]);
});

test('fit contact sheets show all six lower styles in idle, walk and sit',async({page})=>{
  await page.setViewportSize({width:1440,height:900}); await page.goto('/');
  await page.waitForSelector('canvas');
  for(const pose of ['idle','walk','sit']) {
    await page.evaluate(async(pose)=>{
      const T=await import('/node_modules/.vite/deps/three.js' as string);
      const {cloneModel,loadModel}=await import('/src/scene/OptionalModel.tsx' as string);
      const {attachCosmetic}=await import('/src/scene/cosmeticAssets.ts' as string);
      const {equipmentFor}=await import('/src/api/equipment.ts' as string);
      const {attachHead}=await import('/src/scene/headAssets.ts' as string);
      document.getElementById('asset013-fit')?.remove();
      const host=document.createElement('div');host.id='asset013-fit';
      Object.assign(host.style,{position:'fixed',inset:'0',zIndex:'99999',background:'#f1eadb',color:'#302f2a',font:'20px sans-serif'});
      document.body.append(host);
      const title=document.createElement('p');title.textContent=`ASSET-013 / ${pose} / preset and synthetic generated head`;title.style.textAlign='center';host.append(title);
      const scene=new T.Scene();scene.background=new T.Color('#f1eadb');
      scene.add(new T.HemisphereLight(0xffffff,0x7a7466,2.5));const light=new T.DirectionalLight(0xffffff,3);light.position.set(2,6,8);scene.add(light);
      const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1440,760);host.append(renderer.domElement);
      const camera=new T.OrthographicCamera(-6.5,6.5,3.2,-3.2,.1,40);camera.position.set(0,4,12);camera.lookAt(0,1,0);
      const loader={loadAsync:async(path:string)=>{const scene=await loadModel(path.split('/').pop()!.replace('.glb',''));return {scene,animations:scene.animations};}}, base=await loader.loadAsync('/models/villager_base.glb');
      const bottoms=['jeans','chinos','joggers','shorts','skirt','overalls'],shoes=['sneakers','boots','sandals','loafers','high_tops','slippers'];
      const eyewear=['round_wire','aviator','cat_eye','sunglasses','half_rim','heart'];
      const cleanup:(()=>void)[]=[];
      for(let i=0;i<6;i++) {
        const rig=cloneModel(base.scene,2.6);scene.add(rig);
        for(const id of [`bottoms_${bottoms[i]}`,`footwear_${shoes[i]}`,`eyewear_${eyewear[i]}`]) {
          const source=await loader.loadAsync(`/models/${id}.glb`);
          const attached=attachCosmetic(rig,source.scene,equipmentFor(id));if(attached)cleanup.push(()=>attached.dispose());
        }
        if(i===5) {
          const head=new T.Mesh(new T.SphereGeometry(.4,24,16),new T.MeshStandardMaterial({color:'#d8b08c'}));head.scale.set(.8,1.2,.85);
          const detach=attachHead(rig,head);if(detach)cleanup.push(detach);
          rig.dispatchEvent({type:'headchange'});
        }
        const mixer=new T.AnimationMixer(rig);mixer.clipAction(base.animations.find((a:any)=>a.name===(pose==='walk'?'walk':'idle'))).play();mixer.update(.18);
        if(pose==='sit')for(const side of ['L','R'])rig.getObjectByName(`Leg_${side}`).rotation.x=-Math.PI/2;
        rig.position.set((i-2.5)*2.05,0,0);rig.rotation.y=pose==='sit'?1.15:.25;
      }
      scene.updateMatrixWorld(true);renderer.render(scene,camera);
      const labels=document.createElement('div');labels.style.cssText='display:flex;justify-content:space-around;font-size:16px';
      labels.innerHTML=bottoms.map((b,i)=>`<span>${b} / ${shoes[i]} / ${eyewear[i]}</span>`).join('');host.append(labels);
      // Keep pixels for the screenshot, release GPU state on the next sheet.
      const win=window as any;win.asset013Cleanup?.();win.asset013Cleanup=()=>{cleanup.forEach(fn=>fn());renderer.dispose();};
    },pose);
    await page.screenshot({path:`artifacts/asset013/fit-${pose}.png`});
  }
});
