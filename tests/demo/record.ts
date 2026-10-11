import { chromium, type Page } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// No credentials are needed by the recorder. The running API owns provider env loading.
export const output = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/submission/video/data/demo');
const live = process.argv.includes('--live');
const origin = process.env.DEMO_URL || 'http://localhost:4173';
const vid = '13370000-0000-4000-8000-000000000000';
const uid = (digit: number) => `13370000-0000-4000-8000-00000000000${digit}`;
await mkdir(`${output}/stills`, { recursive: true });
const budgetPath = `${output}/call-budget.json`;
let budget = { voice: 0, prayer: 0, suggestion: 0 };
try { budget = JSON.parse(await readFile(budgetPath, 'utf8')); } catch (e: any) { if (e.code !== 'ENOENT') throw e; }
const report: any = { capturedAt: new Date().toISOString(), sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), live, shots: [], failures: [], requests: [], audio: [] };
const browser = await chromium.launch({ headless: false, args: ['--autoplay-policy=no-user-gesture-required', '--window-size=1920,1080'] });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, recordVideo: { dir: `${output}/raw`, size: { width: 1920, height: 1080 } } });
let page: Page;
let start = 0;
const pendingAudio: Promise<void>[] = [];
await context.exposeBinding('demoAudio', (_source, data) => {
  const task = (async () => {
    const name = `voice-${report.audio.length + 1}.audio`;
    report.audio.push({ file: name, startMs: data.time - start, duration: data.duration });
    await writeFile(`${output}/${name}`, Buffer.from(data.base64, 'base64'));
  })();
  pendingAudio.push(task);
  return task;
});
await context.addInitScript(({ vid, user }) => {
  localStorage.setItem(`village:last:${user}`, vid);
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    this.addEventListener('playing', () => {
      const time = performance.now() - this.currentTime * 1000;
      const duration = this.duration;
      void fetch(this.currentSrc || this.src).then(r => r.blob()).then(blob => new Promise<string>(resolve => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(blob);
      })).then(base64 => (window as any).demoAudio({ time, duration, base64 }));
    }, { once: true });
    return play.call(this);
  };
}, { vid, user: uid(1) });
// Allow exactly the three intentional UI mutations. Persist attempts before forwarding,
// so retries after a crash still obey the two-prayer/two-voice task budget.
await context.route('**/api/**', async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.continue();
  const kind = path.endsWith('/voice/lines') ? 'voice' : path.endsWith('/mayor/pray') ? 'prayer' : /\/weekly\/[^/]+\/goals\/[^/]+\/suggestion$/.test(path) ? 'suggestion' : null;
  if (!live || request.method() !== 'POST' || !kind || budget[kind] >= (kind === 'suggestion' ? 1 : 2) || new URL(request.url()).searchParams.has('refresh')) {
    report.failures.push(`Blocked mutation: ${request.method()} ${path}`);
    return route.abort('blockedbyclient');
  }
  budget[kind]++;
  await writeFile(budgetPath, JSON.stringify(budget, null, 2));
  report.requests.push({ kind, path, at: new Date().toISOString() });
  return route.continue();
});
page = await context.newPage();
page.setDefaultTimeout(7000);
page.on('pageerror', error => report.failures.push(`Browser: ${error.message.slice(0, 300)}`));
page.on('response', response => {
  if (response.status() >= 400) report.failures.push(`HTTP ${response.status()}: ${new URL(response.url()).pathname}`);
});
async function caption(title: string, body: string, disclosure = 'SEEDED STORY · Simulated reviews / agent history · No payments or messages') {
  await page.evaluate(({ title, body, disclosure }) => {
    let overlay = document.getElementById('demo-captions');
    if (!overlay) {
      overlay = document.createElement('div'); overlay.id = 'demo-captions'; overlay.setAttribute('popover', 'manual');
      overlay.style.cssText = 'position:fixed;inset:auto auto 20px 340px;margin:0;width:1120px;padding:17px 24px;border:1px solid #748967;border-radius:14px;background:#172c25f5;color:white;font:19px/1.4 Arial,sans-serif;pointer-events:none;box-sizing:border-box;z-index:2147483647';
      document.body.append(overlay);
    }
    overlay.replaceChildren();
    for (const [text, css] of [[disclosure, 'font-size:12px;letter-spacing:1px;color:#c9dba8'], [title, 'font-size:27px;font-weight:700;margin:5px 0'], [body, 'font-size:19px']]) {
      const line = document.createElement('div'); line.textContent = text; line.style.cssText = css; overlay.append(line);
    }
    if (overlay.matches(':popover-open')) overlay.hidePopover();
    overlay.showPopover();
  }, { title, body, disclosure });
}
async function still(name: string) { await page.screenshot({ path: `${output}/stills/${name}.png` }); }
async function closePanels() {
  for (let i = 0; i < 3 && await page.getByRole('button', { name: 'Close dialog', exact: true }).count(); i++) await page.getByRole('button', { name: 'Close dialog', exact: true }).last().click();
  if (await page.getByRole('button', { name: 'Close profile' }).count()) await page.getByRole('button', { name: 'Close profile' }).click();
}
async function shot(name: string, end: number, action: () => Promise<void>) {
  console.log(`Shot: ${name}`);
  report.shots.push({ name, startSeconds: (await page.evaluate(() => performance.now()) - start) / 1000 });
  try { await action(); } catch (e: any) { report.failures.push(`${name}: ${String(e.message).slice(0, 400)}`); console.error(`Shot issue: ${name}`); }
  const remaining = end * 1000 - (await page.evaluate(() => performance.now()) - start);
  if (remaining > 0) await page.waitForTimeout(remaining);
}
try {
  await page.goto(`${origin}/?tour=1`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Connected', { exact: true }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: 'End tour', exact: true }).click();
  // Warm the expensive LAM package before the edit begins. No provider call.
  await page.getByRole('button', { name: 'Visit Dev', exact: true }).click();
  await page.locator('.profile-hero [data-head-state="ready"]').waitFor({ timeout: 90000 });
  await page.waitForTimeout(2000);
  await closePanels();
  start = await page.evaluate(() => performance.now());
  report.startPerformanceMs = start;
  report.startWallMs = Date.now();
  await shot('Opening', 10, async () => {
    await caption('Village — a shared home for small wins', 'Iraj, Lance & Stefanny · AI / ML · Five friends, real goals, a living village.');
    await page.waitForTimeout(2500);
    await still('01-village');
  });
  await shot('Friends and crown', 30, async () => {
    await caption('Every week leaves a story', 'Stefanny’s crown. Lance’s dog and backyard. A recoverable crater after movie night.');
    await page.mouse.move(1050, 760); await page.mouse.down();
    for (let i = 1; i <= 120; i++) { await page.mouse.move(1050 + i * 1.2, 760); await page.waitForTimeout(35); }
    await page.mouse.up();
    await page.getByRole('button', { name: 'Visit Stefanny', exact: true }).click();
    await page.waitForTimeout(3000);
    await closePanels();
    await page.getByRole('button', { name: 'Reset camera' }).click();
  });
  await shot('LAM and synthetic speech', 49, async () => {
    await page.getByRole('button', { name: 'Visit Dev', exact: true }).click();
    await page.locator('.profile-hero [data-head-state="ready"]').waitFor();
    await caption('A face behind every goal', 'SAM 3 → LAM → Audio2Expression · Presets also work with the GPU offline.', 'BAKED LAM HEAD · Synthetic ElevenLabs speech · Historical CV-002: 59.7 s cold / RTX 5090');
    if (live) await page.getByRole('button', { name: 'Hear them', exact: true }).click();
    await page.waitForTimeout(5000);
    await still('02-dev-lam');
  });
  await shot('Evidence and held XP', 67, async () => {
    await closePanels();
    await page.getByRole('button', { name: 'Visit Lance', exact: true }).click();
    await page.getByRole('button', { name: 'View evidence', exact: true }).first().click();
    await page.getByText('AI verdict: suspicious', { exact: true }).waitFor();
    await caption('Evidence deserves a second look', 'Repeated workout evidence holds 25 XP. The seeded verdict supports a human decision.');
    await page.waitForTimeout(2000); await still('03-evidence');
  });
  await shot('AI at work', 86, async () => {
    await closePanels(); await page.getByRole('button', { name: 'AI at work', exact: true }).click();
    await page.locator('.agent-log article').first().waitFor();
    await caption('An agent that knows when to leave people alone', 'Read its reasons, model provenance and limits. This journal contains simulated history.');
    const decision = page.locator('.agent-log article').filter({ hasText: /throttl|no.action|leave.*alone/i }).first();
    if (await decision.count()) await decision.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500); await still('04-ai-at-work');
  });
  await shot('Human grading with AI advice', 109, async () => {
    await closePanels(); await page.getByLabel('Play as', { exact: true }).selectOption(uid(4));
    await page.getByRole('button', { name: 'Week', exact: true }).click();
    const card = page.getByRole('article', { name: "Iraj's weekly goal", exact: true });
    await card.waitFor();
    await caption('AI suggests. The human auditor decides.', 'Maya audits and sits out this week. Stefanny won last week’s crown and 100 XP.');
    if (live) {
      await card.getByRole('button', { name: 'Load AI pre-grade', exact: true }).click();
      await card.locator('.ai-suggestion').waitFor({ timeout: 15000 });
      await card.locator('.ai-suggestion').scrollIntoViewIfNeeded();
    }
    await page.waitForTimeout(1500); await still('05-week-grading');
  });
  await shot('Friendly competition', 127, async () => {
    await closePanels(); await page.getByRole('button', { name: 'Compete', exact: true }).click();
    await page.getByRole('button', { name: /Minecraft hours/ }).waitFor();
    await caption('A little friendly motivation', 'Minecraft hours is friendly. Study streak has confirmed and pending entries.', 'INTENT ONLY — NO PAYMENT · 0.01 SOL devnet entry / 5% auditor fee intentions');
    await page.waitForTimeout(3000);
    await page.getByRole('button', { name: /Study streak/ }).click();
    await page.getByRole('heading', { name: 'Study streak', exact: true }).waitFor();
    await page.waitForTimeout(2000); await still('06-compete');
  });
  await shot('Live Mayor prayer', 146, async () => {
    await closePanels(); await page.getByRole('button', { name: 'Mayor', exact: true }).click();
    await caption('A little encouragement from the Mayor', 'One explicit live request. No messages are sent and no payment is made.', 'LIVE MAYOR REQUEST · Seeded village context · Provider failure may use a labeled fallback');
    await page.getByLabel('Pray to the Mayor', { exact: true }).fill('Give our five friends one short, kind sentence of encouragement to finish their weekly goals.');
    if (live) {
      await page.getByRole('button', { name: 'Send a little wish', exact: true }).click();
      await page.locator('.mayor-response').waitFor({ timeout: 15000 });
      await page.locator('.mayor-response').scrollIntoViewIfNeeded();
      report.mayorText = await page.locator('.mayor-response').innerText();
    }
  });
  await shot('Closing village', 152, async () => {
    await closePanels();
    await caption('Village — small wins, together', 'People keep the final say. Local preview: localhost:4173/?tour=1', 'IMPLEMENTED INTEGRATIONS · Gemini / ElevenLabs / Photon Spectrum · Photon delivery not demonstrated');
  });
} catch (e: any) {
  report.failures.push(`Capture: ${String(e.message).slice(0, 500)}`);
  process.exitCode = 1;
} finally {
  report.endWallMs = Date.now();
  report.endPerformanceMs = await page.evaluate(() => performance.now()).catch(() => 0);
  report.budget = budget;
  await pendingAudio.reduce((previous, next) => previous.then(() => next), Promise.resolve());
  await context.close();
  report.rawVideo = await page.video()!.path();
  await browser.close();
  await writeFile(`${output}/capture.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ rawVideo: report.rawVideo, budget, failures: report.failures, audio: report.audio }));
}
