import { describe, expect, test } from 'bun:test';
import { canRetry, connection, fetchWithRetry, RESTART_MESSAGE, RETRY_DELAYS } from './retry';

function harness(results: (number | Error)[]) {
  let now = 0;
  const delays: number[] = [], requests: RequestInit[] = [];
  const deps = {
    now: () => now,
    sleep: async (ms: number) => { delays.push(ms); now += ms; },
    fetch: (async (_url: unknown, init: RequestInit) => {
      requests.push(init);
      const next = results.shift() ?? 200;
      if (next instanceof Error) throw next;
      return new Response('{}', {status: next});
    }) as typeof fetch,
  };
  return {deps, delays, requests};
}
describe('restart retry policy', () => {
  test('HTTP success does not hide a disconnected movement socket', () => {
    connection.set(true, 'movement'); connection.set(false);
    expect(connection.snapshot()).toBe(true);
    connection.set(false, 'movement');
    expect(connection.snapshot()).toBe(false);
  });
  test('GET and keyed writes only; empty keys never authorize replay', () => {
    expect(canRetry('GET')).toBe(true);
    for (const method of ['POST', 'PATCH', 'DELETE', 'PUT']) {
      expect(canRetry(method)).toBe(false);
      expect(canRetry(method, {idempotency_key: '  '})).toBe(false);
      expect(canRetry(method, {idempotency_key: 'same-key'})).toBe(true);
    }
    const form = new FormData(); form.set('idempotency_key', 'upload-key');
    expect(canRetry('POST', form)).toBe(true);
  });
  test('network and gateway failures retry with exact backoff and recover', async () => {
    const h = harness([new TypeError('Failed to fetch'), 502, 503, 504, 200]);
    const states: boolean[] = []; connection.set(false);
    const stop = connection.subscribe(() => states.push(connection.snapshot()));
    expect((await fetchWithRetry('/api/me', {method: 'GET'}, true, h.deps)).status).toBe(200);
    stop(); expect(h.delays).toEqual(RETRY_DELAYS); expect(states).toEqual([true, false]);
    expect(h.requests).toHaveLength(5);
  });
  test('exhaustion is bounded and friendly', async () => {
    const h = harness([503,503,503,503,503]);
    await expect(fetchWithRetry('/api/me', {}, true, h.deps)).rejects.toMatchObject({status:503, message:RESTART_MESSAGE});
    expect(h.delays.reduce((a,b) => a+b, 0)).toBe(7500); expect(h.requests).toHaveLength(5);
  });
  test('unkeyed write is sent once even when its response is lost', async () => {
    const h = harness([new TypeError('Network failure')]);
    await expect(fetchWithRetry('/api/write', {method:'POST'}, false, h.deps)).rejects.toMatchObject({message:RESTART_MESSAGE});
    expect(h.requests).toHaveLength(1); expect(h.delays).toEqual([]);
  });
  test('keyed write preserves serialized body across retries', async () => {
    const h = harness([503, 200]); const body = JSON.stringify({idempotency_key:'stable', text:'hello'});
    await fetchWithRetry('/api/write', {method:'POST', body}, true, h.deps);
    expect(h.requests.map(r => r.body)).toEqual([body, body]);
  });
  test('application errors and programming errors are not retried', async () => {
    for (const status of [400,401,403,404,409,422,429,500]) {
      const h = harness([status]); expect((await fetchWithRetry('/api/me', {}, true, h.deps)).status).toBe(status);
      expect(h.requests).toHaveLength(1);
    }
    const h = harness([new Error('bug')]); await expect(fetchWithRetry('/api/me', {}, true, h.deps)).rejects.toThrow('bug');
    expect(h.requests).toHaveLength(1);
  });
  test('slow failures cannot extend the ten-second budget', async () => {
    const h = harness([503]); let now = 0; h.deps.now = () => { const value = now; now += 10000; return value; };
    await expect(fetchWithRetry('/api/me', {}, true, h.deps)).rejects.toMatchObject({message:RESTART_MESSAGE});
    expect(h.requests).toHaveLength(1); expect(h.delays).toEqual([]);
  });
});

// Real short timers verify completion-based scheduling and silent backoff.
test('background polling backs off, never overlaps, and stops cleanly', async () => {
  const { pollWithBackoff } = await import('./retry');
  let calls = 0, active = 0, peak = 0;
  const starts: number[] = [];
  const stop = pollWithBackoff(async () => {
    calls++; starts.push(Date.now()); active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 10)); active--;
    throw new Error('offline');
  }, 10);
  await new Promise(resolve => setTimeout(resolve, 130)); stop();
  const count = calls; await new Promise(resolve => setTimeout(resolve, 100));
  expect(peak).toBe(1); expect(calls).toBe(count); expect(starts.length).toBeGreaterThanOrEqual(2);
  expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(29);
});
