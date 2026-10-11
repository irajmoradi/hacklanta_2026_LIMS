import { test, expect } from '@playwright/test';
import { useDemoSeat } from './demoSeat';
import { mkdir, writeFile } from 'node:fs/promises';
useDemoSeat();
for (const [seat,name] of ['Iraj','Lance','Stefanny','Maya','Mario'].entries()) {
  test(`${name}: front, side and three-quarter in town, profile and wardrobe`, async ({page}) => {
    const errors:string[]=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
    // A hard network guard: every API operation stays inside the mock adapter.
    await page.route('**/api/**',route=>new URL(route.request().url()).pathname.startsWith('/api/') ? route.abort() : route.continue());
    await page.goto('/tests/fix022.html');
    await expect(page.getByTestId(`villager-${name}`)).toHaveAttribute('data-head-kind','glb');
    // Town labels can project outside the viewport; activate the real profile
    // handler without relying on a particular seeded walking position.
    await page.getByTestId(`villager-${name}`).evaluate(element=>(element as HTMLElement).click());
    await page.getByRole('tab',{name:'Outfit',exact:true}).click();
    await page.evaluate(seat=>(window as any).mountFix022Wardrobe(seat),seat);
    await mkdir('artifacts/fix022',{recursive:true});
    const measurements: {surface:string; view:string; error:number; frame:number[]}[]=[];
    for(const [surface,selector] of [['town','main canvas'],['profile','.showcase-preview canvas'],['wardrobe','.wardrobe-preview canvas']]) {
      const canvas=page.locator(selector).first();
      await expect(canvas).toBeVisible();
      await expect.poll(()=>page.evaluate(async({selector,seat,surface})=>{
        const {_roots}=await import('/node_modules/.vite/deps/@react-three_fiber.js' as string);
        const scene=_roots.get(document.querySelector(selector))?.store.getState().scene;
        const root=surface==='town'?scene?.getObjectByName(`villager:00000000-0000-4000-8000-00000000000${seat+1}`):scene;
        let found=false;root?.traverse((n:any)=>{if(n.userData.generatedHead)found=true;});return found;
      },{selector,seat,surface})).toBe(true);
      for(const [view,angle] of [['front',0],['side',Math.PI/2],['three-quarter',Math.PI/4]] as const) {
        const capture: {value: {error:number;frame:number[];image:string} | null} = {value:null};
        // Periodic mock profile refreshes may briefly remount a head between views.
        await expect(async()=>{
          capture.value=await page.evaluate(async({selector,seat,surface,angle})=>{
            const {_roots}=await import('/node_modules/.vite/deps/@react-three_fiber.js' as string);
            const T=await import('/node_modules/.vite/deps/three.js' as string);
            const {geometryBounds,geometryPoints,headNeckAnchor}=await import('/src/scene/headFit.ts' as string);
            const state=_roots.get(document.querySelector(selector)).store.getState();
            const root=surface==='town'?state.scene.getObjectByName(`villager:00000000-0000-4000-8000-00000000000${seat+1}`):state.scene;
            let head:any;root?.traverse((n:any)=>{if(n.userData.generatedHead)head=n;});
            if (!head) return null;
            const bone=head.parent;const rig=bone.parent;let body=rig;while(body.parent && !body.getObjectByName('neck'))body=body.parent;
            const neck=geometryBounds(body,bone,(n:any)=>n.name.toLowerCase()==='neck');
            const points=geometryPoints(head,bone),bounds=new T.Box3().setFromPoints(points);
            const anchor=headNeckAnchor(bounds,points),socket=neck.getCenter(new T.Vector3());
            const error=Math.hypot(anchor.x-socket.x,anchor.z-socket.z);
            // Frame the actual production scene, preserving the avatar's world pose.
            const target=bone.localToWorld(new T.Vector3(0,.1,0));
            const direction=new T.Vector3(Math.sin(angle),.08,Math.cos(angle));
            direction.applyQuaternion(bone.getWorldQuaternion(new T.Quaternion()));
            // Clip foreground buildings/trees between the closeup camera and the
            // villager; leave the actual avatar and town background untouched.
            const camera=new T.PerspectiveCamera(35,state.size.width/state.size.height,surface==='town'?3.4:.01,500);
            camera.position.copy(target).addScaledVector(direction,4.2);camera.lookAt(target);
            state.gl.render(state.scene,camera);
            // Read immediately: a later animation frame can clear the WebGL buffer.
            // Capture the production canvas without overlapping DOM panels.
            return {error,frame:head.userData.fitFrame.center.toArray(),image:state.gl.domElement.toDataURL('image/png')};
          },{selector,seat,surface,angle});
          expect(capture.value).not.toBeNull();
        }).toPass({timeout:30000});
        if (!capture.value) throw new Error('Generated head did not reattach');
        const captured = capture.value;
        expect(captured.error).toBeLessThan(.025);
        measurements.push({surface,view,error:captured.error,frame:captured.frame});
        await writeFile(`artifacts/fix022/${name.toLowerCase()}-${surface}-${view}.png`,Buffer.from(captured.image.split(',')[1],'base64'));
      }
    }
    for (const measurement of measurements) measurement.frame.forEach((value,axis)=>expect(value).toBeCloseTo(measurements[0].frame[axis],4));
    await writeFile(`artifacts/fix022/${name.toLowerCase()}-measurements.json`,JSON.stringify(measurements,null,2));
    await page.screenshot({path:`artifacts/fix022/${name.toLowerCase()}-ui.png`});
    expect(errors).toEqual([]);
  });
}
