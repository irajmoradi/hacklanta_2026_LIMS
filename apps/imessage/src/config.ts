import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

export function loadEnvironment() {
  let path = process.env.VILLAGE_ENV_FILE;
  if (!path) return;
  if (process.platform === "win32")
    path = path.replace(/^\/([a-z])\//i, "$1:/");
  for (const [key, value] of Object.entries(
    parseEnv(readFileSync(path, "utf8")),
  )) {
    process.env[key] ??= value;
  }
}

export function config(env: Record<string, string | undefined>, cloud = true) {
  for (const key of cloud
    ? ["SERVICE_KEY", "PROJECT_ID", "PROJECT_SECRET"]
    : ["SERVICE_KEY"]) {
    if (!env[key]?.trim()) throw new Error(`Missing ${key}`);
  }
  const url = new URL(env.VILLAGE_API_URL ?? "http://127.0.0.1:8000/api");
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Invalid VILLAGE_API_URL");
  }
  const pollMs = Number(env.OUTBOX_POLL_MS ?? 15000);
  if (!Number.isSafeInteger(pollMs) || pollMs < 100 || pollMs > 60000)
    throw new Error("Invalid OUTBOX_POLL_MS (100..60000)");
  return { api: url.href.replace(/\/$/, ""), key: env.SERVICE_KEY!, pollMs, sendEnabled: env.PHOTON_SEND_ENABLED === "true" };
}
