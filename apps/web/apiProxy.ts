import type { ProxyOptions } from 'vite';
export function apiProxy(target: string): ProxyOptions {
  return { target, ws: true, configure(proxy) {
    // configure runs before Vite installs its generic 500 handler.
    proxy.on('error', (error, _request, response) => {
      if (!['ECONNREFUSED', 'ECONNRESET'].includes((error as NodeJS.ErrnoException).code ?? '')) return;
      if (!('writeHead' in response) || response.headersSent || response.writableEnded) return;
      response.writeHead(503, { 'Retry-After': '2', 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ detail: 'Village is restarting, try again in a moment' }));
    });
  }};
}
