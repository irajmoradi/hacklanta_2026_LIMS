import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { useDemoSeat } from './demoSeat';
useDemoSeat();
test('record warmed cinematic transition budgets', async ({page}, info) => {
  await page.goto('/');
  await expect(page.getByTestId('village-scene')).toHaveAttribute('data-ready','true');
  // The shared town governor finishes its 8s warmup plus 2s sample before capture.
  await page.waitForTimeout(14000);
  for (const label of ['Check in','Mayor']) {
    for (const phase of ['enter','return']) {
    const result = await page.evaluate(async ({label,phase}) => {
      const startMark = phase === 'enter' ? 'scene-request' : 'scene-exit-request';
      const endMark = phase === 'enter' ? 'scene-ready' : 'scene-returned';
      performance.clearMarks(startMark); performance.clearMarks(endMark);
      const canvas = document.querySelector<HTMLCanvasElement>('.scene canvas')!;
      const gl = canvas.getContext('webgl2')!, ext = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
      const frames: number[] = [];
      let previous = 0;
      let begin = 0;
      return await new Promise<{frames:number[];renderer:string;duration:number;max:number}>(resolve => {
        function sample(now:number) {
          if (!begin) {
            begin=now; previous=now;
            document.querySelector<HTMLButtonElement>(phase === 'enter' ? `.action-dock button[aria-label="${label}"]` : 'dialog.cinematic-scene .modal-close')!.click();
            requestAnimationFrame(sample); return;
          }
          frames.push(now-previous); previous=now;
          const ready = performance.getEntriesByName(endMark).at(-1);
          if (ready || now-begin > 3000) {
            const request = performance.getEntriesByName(startMark).at(-1)!;
            resolve({frames,renderer,duration:ready ? ready.startTime-request.startTime : 3000,max:Math.max(...frames)});
          } else requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
    }, {label,phase});
    await mkdir('artifacts/feat016',{recursive:true});
    await writeFile(`artifacts/feat016/${label.replaceAll(' ','-').toLowerCase()}-${phase}-performance.json`,JSON.stringify(result,null,2));
    await info.attach(`${label}-${phase}-performance.json`,{body:JSON.stringify(result,null,2),contentType:'application/json'});
    console.log(`${label} ${phase}: ${JSON.stringify(result)}`);
    expect.soft(result.duration,'Camera ready within 350ms').toBeLessThanOrEqual(350);
    expect.soft(result.max,'No transition frame above 50ms').toBeLessThanOrEqual(50);
    await page.waitForTimeout(500);
    }
    await expect(page.locator('dialog.cinematic-scene')).toHaveCount(0);
  }
});
