import { test, expect, type Page } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";
import { mkdirSync, writeFileSync } from "node:fs";
const uid = "13370000-0000-4000-8000-000000000001",
  vid = "13370000-0000-4000-8000-000000000000";
async function enter(page: Page, base: string, seat: string) {
  await page.addInitScript(
    (seat) => localStorage.setItem("village:seat:live", seat),
    seat,
  );
  await page.goto(`${base}/interior-preview.html?seat=${seat}`);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Live · changes saved automatically" }),
  ).toBeVisible({ timeout: 30000 });
}
test("two villagers decorate through Tiger, drag fan-out and latency", async ({
  browser,
  baseURL,
  request,
}) => {
  const base = baseURL!,
    headers = { "X-Demo-User": uid };
  await request.get(`${base}/api/houses/${uid}?vid=${vid}`, { headers });
  const grant = await request.post(
    `${base}/api/houses/${uid}/editors?vid=${vid}`,
    {
      headers,
      data: { user_id: "13370000-0000-4000-8000-000000000002", enabled: true },
    },
  );
  expect(grant.ok()).toBe(true);
  for (const [item_id, x, z] of [
    ["sofa", -2, -2],
    ["plant_fern", 3, 2],
  ] as const)
    await request.post(`${base}/api/houses/${uid}/edit?vid=${vid}`, {
      headers,
      data: { action: "move_item", item_id, x, z, rot: 0, client_seq: 0 },
    });
  const a = await browser.newContext({
      viewport: { width: 1400, height: 900 },
      recordVideo: process.env.FEAT015_RECORD ? { dir: "artifacts/feat015/video" } : undefined,
    }),
    b = await browser.newContext({
      viewport: { width: 1400, height: 900 },
      recordVideo: process.env.FEAT015_RECORD ? { dir: "artifacts/feat015/video" } : undefined,
    });
  const pa = await a.newPage(),
    pb = await b.newPage();
  const errors: string[] = [];
  for (const p of [pa, pb]) p.on("pageerror", (e) => errors.push(e.message));
  await enter(pa, base, uid);
  await enter(pb, base, "13370000-0000-4000-8000-000000000002");
  await pa.getByRole("button", { name: "Decorate", exact: true }).click();
  await pb.getByRole("button", { name: "Decorate", exact: true }).click();
  await pa.getByText("Room inventory", { exact: true }).click();
  await pb.getByText("Room inventory", { exact: true }).click();
  await pa.waitForTimeout(3000);
  const canvas = pa.locator(".interior-canvas canvas"),
    box = (await canvas.boundingBox())!;
  const camera = new PerspectiveCamera(42, box.width / box.height, 0.1, 1000);
  camera.position.set(9, 10, 12);
  camera.lookAt(0, 0.3, 0);
  camera.updateMatrixWorld();
  const point = (x: number, y: number, z: number) => {
    const p = new Vector3(x, y, z).project(camera);
    return {
      x: box.x + ((p.x + 1) * box.width) / 2,
      y: box.y + ((1 - p.y) * box.height) / 2,
    };
  };
  const start = point(-2, 0.65, -2),
    end = point(-1.25, 0, -2);
  await pa.mouse.move(start.x, start.y);
  await pa.mouse.down();
  await pa.mouse.move(end.x, end.y, { steps: 8 });
  await pa.mouse.up();
  await expect(pb.getByTestId("position-sofa")).toHaveAttribute(
    "data-x",
    "-1.25",
    { timeout: 15000 },
  );
  await expect(pa.getByTestId("position-sofa")).toHaveAttribute(
    "data-x",
    "-1.25",
  );
  await pb.getByRole("button", { name: "Move plant_fern right" }).click();
  await expect(pa.getByTestId("position-plant_fern")).toHaveAttribute(
    "data-x",
    "3.25",
  );
  await pa.locator(".interior-sidebar").evaluate((el) => (el.scrollTop = 0));
  await pb.locator(".interior-sidebar").evaluate((el) => (el.scrollTop = 0));
  mkdirSync("artifacts/feat015", { recursive: true });
  await pa.screenshot({ path: "artifacts/feat015/decorating-owner.png" });
  await pb.screenshot({ path: "artifacts/feat015/decorating-neighbor.png" });
  // Real editor action -> observer React commit -> next animation frame.
  // Keep exactly the two room sockets; extra probe sockets distort free-tier load.
  await pb.evaluate(() => {
    const w=window as any; w.painted=[];
    const item=document.querySelector('[data-testid="position-sofa"]')!;
    w.observer=new MutationObserver(()=>{
      const x=item.getAttribute('data-x');
      requestAnimationFrame(()=>w.painted.push({x,time:Date.now()}));
    });
    w.observer.observe(item,{attributes:true,attributeFilter:['data-x']});
  });
  const latencies:number[]=[];
  for(let i=0;i<20;i++) {
    const sent=await pa.evaluate(forward=>{
      const button=forward
        ? document.querySelector<HTMLButtonElement>('[aria-label="Move sofa right"]')!
        : [...document.querySelectorAll<HTMLButtonElement>('.interior-tools button')].find(b=>b.textContent==='Undo')!;
      const time=Date.now();button.click();return time;
    },i%2===0);
    const expected=i%2===0?'-1':'-1.25';
    await pb.waitForFunction(({sent,expected})=>(window as any).painted.some((p:any)=>p.time>=sent&&p.x===expected),{sent,expected});
    const received=await pb.evaluate(({sent,expected})=>(window as any).painted.find((p:any)=>p.time>=sent&&p.x===expected).time,{sent,expected});
    latencies.push(received-sent);
  }
  const sorted = [...latencies].sort((a, b) => a - b),
    result = {
      measurement: "editor action to observer animation frame",
    transport: base.startsWith("https:")
        ? "Cloudflare tunnel"
        : "localhost -> Tiger Cloud",
      samples: latencies,
      p50_ms: sorted[9],
      p95_ms: sorted[18],
      under_250_ms: latencies.filter((n) => n <= 250).length,
    };
  writeFileSync(
    `artifacts/feat015/latency-${base.startsWith("https:") ? "tunnel" : "local"}.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
  await pa.setViewportSize({ width: 390, height: 844 });
  await pa.waitForTimeout(1200);
  expect(
    await pa
      .locator(".interior-dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await pa.screenshot({ path: "artifacts/feat015/decorating-mobile.png" });
  expect(errors).toEqual([]);
  await a.close();
  await b.close();
  expect(result.p95_ms).toBeLessThanOrEqual(250);
});
