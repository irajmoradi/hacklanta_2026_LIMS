// Headless-Chrome capture of the demo (a visible tab is needed for rAF; headless counts as visible).
// usage: bun demo/screenshot.ts <url> <out_prefix> [play]   -> <out_prefix>_idle.png (+ _speaking_1/2.png)
import puppeteer from "puppeteer-core";
const [url, outPrefix, play] = [process.argv[2], process.argv[3], process.argv[4] === "play"];
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  userDataDir: (process.env.TEMP ?? "/tmp") + "/lam-shot-profile",
  args: [...(process.env.ANGLE ?? "--use-angle=d3d11").split(" "), "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required", "--window-size=600,720"],
});
const page = await browser.newPage();
await page.setViewport({ width: 600, height: 720 });
page.on("console", (m) => { if (m.type() === "error" && !/favicon|404/.test(m.text())) console.log("console:", m.text().slice(0, 300)); });
page.on("requestfailed", (r) => console.log("reqfail:", r.url()));
page.on("response", (r) => { if (r.status() >= 400) console.log("http", r.status(), r.url()); });
page.on("pageerror", (e) => console.log("pageerror:", String(e).slice(0, 300)));
const t0 = Date.now();
await page.goto(url);
await page.waitForFunction(() => (window as any).__lam?.state !== "loading", { timeout: 60000 });
const lam = await page.evaluate(() => ({ state: (window as any).__lam.state, loadMs: (window as any).__lam.loadMs, error: (window as any).__lam.error }));
console.log("lam:", JSON.stringify(lam), "wall ms:", Date.now() - t0);
await new Promise((r) => setTimeout(r, 3000));
const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const s = performance.now(); const f = () => { n++; if (performance.now() - s < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
console.log("rAF fps:", fps);
await page.screenshot({ path: `${outPrefix}_idle.png` });
if (play) {
  await page.click("#play");
  await new Promise((r) => setTimeout(r, 1200));
  const st = await page.evaluate(() => ({ t: (window as any).__lam.audio.currentTime, state: (window as any).__lam.head.state(), paused: (window as any).__lam.audio.paused }));
  console.log("speaking:", JSON.stringify(st));
  await page.screenshot({ path: `${outPrefix}_speaking_1.png` });
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: `${outPrefix}_speaking_2.png` });
}
await browser.close();
