// Demo server: `bunx vite --config demo/vite.config.ts` (from packages/lam-renderer).
// /local-assets/* -> <repo>/data/assets (dev-only static, for sample_* outputs that aren't API users)
// /api/*          -> Village API on :8010 (same proxy as apps/web)
import { defineConfig, type Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const candidates = [
  process.env.VILLAGE_ASSET_DIR,
  path.resolve(here, "../../../data/assets"),
  path.resolve(here, "../../../../hacklanta/data/assets"), // worktree -> main checkout
].filter(Boolean) as string[];
const assetDir = candidates.find((p) => fs.existsSync(p)) ?? candidates[0];

const TYPES: Record<string, string> = {
  ".zip": "application/zip", ".json": "application/json", ".mp3": "audio/mpeg", ".png": "image/png",
  ".mp4": "video/mp4", ".wav": "audio/wav",
};

function localAssets(): Plugin {
  return {
    name: "local-assets",
    configureServer(server) {
      server.middlewares.use("/local-assets", (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? "/").split("?")[0]);
        const file = path.resolve(assetDir, "." + rel);
        if (!file.startsWith(path.resolve(assetDir)) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
        res.setHeader("Content-Type", TYPES[path.extname(file)] ?? "application/octet-stream");
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  root: here,
  plugins: [localAssets()],
  server: {
    host: "127.0.0.1",
    port: 5180,
    proxy: { "/api": { target: "http://127.0.0.1:8010", changeOrigin: true } },
  },
});
