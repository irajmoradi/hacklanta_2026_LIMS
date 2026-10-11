import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { MockApi } from '../src/api/mock';
import { DEMO_USER_ID } from '../src/api/fixtures';

// A real listening socket and Vite preview proxy; fixture data avoids paid providers.
test('API stops, preview returns 503, and the open page recovers without reload', async ({page, request}) => {
  const backend = new MockApi(); let server: Server | undefined;
  async function start() {
    server = createServer(async (req, res) => {
      const path = (req.url ?? '/').replace(/^\/api/, '');
      if (path === '/reset') { req.socket.destroy(); return; }
      if (path.endsWith('/presence/stream')) { res.writeHead(200, {'Content-Type':'text/event-stream'}); res.write('event: presence\ndata: {"online":[]}\n\n'); return; }
      try {
        const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
        const data = await backend.request(req.method ?? 'GET', path, DEMO_USER_ID, body);
        res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify(data));
      } catch (error) { res.writeHead((error as {status?:number}).status ?? 500, {'Content-Type':'application/json'}); res.end(JSON.stringify({detail:String(error)})); }
    });
    await new Promise<void>(resolve => server!.listen(18011, '127.0.0.1', resolve));
  }
  async function stop() {
    if (!server) return;
    const current = server; server = undefined;
    await new Promise<void>((resolve, reject) => { current.close(error => error ? reject(error) : resolve()); current.closeAllConnections(); });
  }
  try {
    await start();
    const reset = await request.get('/api/reset');
    expect(reset.status()).toBe(503); expect(reset.headers()['retry-after']).toBe('2');
    await page.goto('/');
    await expect(page.getByTestId('my-xp')).toBeVisible({timeout:30000});
    let navigations = 0; page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
    await stop();
    const down = await request.get('/api/health');
    expect(down.status()).toBe(503); expect(down.headers()['retry-after']).toBe('2');
    await page.getByRole('button', {name:'Shop', exact:true}).click();
    await expect(page.getByRole('status', {name:''}).filter({hasText:/Reconnecting/})).toBeVisible();
    await expect(page.getByText('Request failed (500)', {exact:false})).toHaveCount(0);
    await expect(page.locator('dialog[open] .reconnecting-pill')).toBeVisible();
    await page.screenshot({path:'test-results/fix011-reconnecting.png'});
    await start();
    await expect(page.getByTestId('shop-balance')).toHaveText('420', {timeout:12000});
    await expect(page.locator('.reconnecting-pill')).toHaveCount(0);
    expect(navigations).toBe(0);
    await page.screenshot({path:'test-results/fix011-recovered.png'});
  } finally { await stop(); }
});
