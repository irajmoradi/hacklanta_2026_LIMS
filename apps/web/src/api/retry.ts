import { ApiError } from './mock';

export const RETRY_DELAYS = [500, 1000, 2000, 4000];
export const RESTART_MESSAGE = 'Village is restarting, try again in a moment';
export const transientStatus = (status: number) => [502, 503, 504].includes(status);
export function canRetry(method: string, body?: unknown) {
  const key = body instanceof FormData ? body.get('idempotency_key') : (body as {idempotency_key?: unknown} | undefined)?.idempotency_key;
  return method.toUpperCase() === 'GET' || (typeof key === 'string' && key.trim().length > 0);
}
const listeners = new Set<() => void>();
let reconnecting = false;
const failures = new Set<string>();
export const connection = {
  subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  snapshot: () => reconnecting,
  set(value: boolean, source = 'http') {
    if (value) failures.add(source); else failures.delete(source);
    const next = failures.size > 0;
    if (next !== reconnecting) { reconnecting = next; listeners.forEach(fn => fn()); }
  },
};

// Each logical request has a ten-second retry budget. Unkeyed writes are sent once.
export async function fetchWithRetry(url: string, init: RequestInit, retryable: boolean, deps = {
  fetch: ((input, init) => globalThis.fetch(input, init)) as typeof fetch, sleep: (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)), now: Date.now,
}) {
  const deadline = deps.now() + 10000;
  for (let attempt = 0; ; attempt++) {
    let response: Response | undefined;
    try {
      response = await deps.fetch(url, {...init, signal: AbortSignal.timeout(retryable ? Math.max(1, deadline - deps.now()) : 30000)});
    } catch (error) {
      if (!(error instanceof TypeError) && !(error instanceof DOMException && ['TimeoutError', 'AbortError', 'NetworkError'].includes(error.name))) throw error;
    }
    if (response && !transientStatus(response.status)) { connection.set(false); return response; }
    connection.set(true);
    await response?.body?.cancel();
    const delay = RETRY_DELAYS[attempt];
    if (!retryable || delay === undefined || deps.now() + delay >= deadline) throw new ApiError(response?.status ?? 503, RESTART_MESSAGE);
    await deps.sleep(delay);
  }
}

// Schedule after completion, never overlap, and keep background failures silent.
export function pollWithBackoff(run: () => Promise<unknown>, interval: number, immediate = true) {
  let stopped = false, failures = 0, timer: ReturnType<typeof setTimeout>;
  const tick = async () => {
    try { await run(); failures = 0; } catch { failures++; }
    if (!stopped) timer = setTimeout(() => void tick(), Math.min(60000, interval * 2 ** failures));
  };
  if (immediate) void tick(); else timer = setTimeout(() => void tick(), interval);
  return () => { stopped = true; clearTimeout(timer); };
}
