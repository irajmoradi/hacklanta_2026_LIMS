import type {Plugin} from 'vite';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync, writeFileSync, existsSync, statSync, createReadStream} from 'node:fs';
import {resolve, join, extname} from 'node:path';
import {gzipSync} from 'node:zlib';

/** Lossless transport compression preserves authored geometry and texture bytes.
 * Originals stay in public/models; only production output gets .gz sidecars. */
export function performanceAssets(webRoot: string): Plugin {
  const models = join(webRoot, 'public/models');
  const hash = createHash('sha256');
  for (const name of (existsSync(models) ? readdirSync(models) : []).filter(n => n.endsWith('.glb')).sort()) {
    hash.update(name).update(readFileSync(join(models, name)));
  }
  const revision = hash.digest('hex').slice(0, 16);
  let output = join(webRoot, 'dist');
  let production = false;
  return {
    name: 'village-performance-assets',
    config: () => ({define: {__MODEL_REVISION__: JSON.stringify(revision)}}),
    configResolved(config) {output = resolve(config.root, config.build.outDir); production = config.command === 'build';},
    transformIndexHtml() {
      if (!existsSync(join(models, 'villager_base.glb'))) return [];
      return [{tag:'link', attrs:{rel:'preload', as:'fetch', crossorigin:'anonymous', href:`/models/villager_base.glb?v=${revision}`}, injectTo:'head'}];
    },
    closeBundle() {
      if (!production) return;
      const walk = (directory: string) => {
        for (const entry of readdirSync(directory, {withFileTypes:true})) {
          const path = join(directory, entry.name);
          if (entry.isDirectory()) walk(path);
          else if (/\.(js|css|glb|json|svg)$/.test(entry.name)) writeFileSync(`${path}.gz`, gzipSync(readFileSync(path), {level:9}));
        }
      };
      walk(output);
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        let url: URL;
        try {url = new URL(req.url || '/', 'http://localhost');} catch {return next();}
        if (!/^\/(assets|models)\/[a-zA-Z0-9_.-]+$/.test(url.pathname)) return next();
        const path = join(output, url.pathname.slice(1));
        if (!existsSync(path) || !statSync(path).isFile()) return next();
        const immutable = url.pathname.startsWith('/assets/') || url.searchParams.get('v') === revision;
        res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'public, no-cache');
        res.setHeader('Vary', 'Accept-Encoding');
        const gzip = (req.headers['accept-encoding'] || '').split(',').some(value => {
          const [name, quality] = value.trim().split(';');
          return name === 'gzip' && (!quality || Number(quality.trim().replace(/^q=/, '')) > 0);
        });
        if (!gzip || !existsSync(`${path}.gz`)) return next();
        const types: Record<string,string> = {'.js':'text/javascript', '.css':'text/css', '.glb':'model/gltf-binary', '.json':'application/json', '.svg':'image/svg+xml'};
        res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Content-Length', statSync(`${path}.gz`).size);
        if (req.method === 'HEAD') res.end(); else createReadStream(`${path}.gz`).pipe(res);
      });
    },
  };
}
