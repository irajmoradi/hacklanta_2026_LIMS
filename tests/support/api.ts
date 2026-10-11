export const API = process.env.QA_API_URL || 'http://127.0.0.1:8010/api';
export const WEB = process.env.QA_WEB_URL || 'http://127.0.0.1:4173';
export const users = (process.env.QA_USERS || '').split(',').filter(Boolean);
if (users.length !== 5 || users.some(id => !/^[0-9a-f-]{36}$/.test(id) || id.startsWith('13370000-'))) {
  throw new Error('Run through tests/run_live.py: five fresh QA identities are required');
}
export const owner = users[4];
const created = new Set<string>();

export async function call(path: string, user = owner, body?: unknown) {
  const vid = path.match(/^\/villages\/([^/]+)/)?.[1];
  if (body !== undefined && vid && vid !== 'join' && !created.has(vid)) {
    throw new Error(`QA refuses writes to village not created by this process: ${vid}`);
  }
  const response = await fetch(`${API}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'X-Demo-User': user, ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(35000),
  });
  const data = await response.json();
  return { status: response.status, data };
}

export async function ok(path: string, user = owner, body?: unknown) {
  const result = await call(path, user, body);
  if (result.status < 200 || result.status >= 300) throw new Error(`${path}: HTTP ${result.status}: ${JSON.stringify(result.data)}`);
  return result.data;
}

export async function village(label: string, members = [users[0]]) {
  const { village: v } = await ok('/villages', owner, { name: `QA-002 ${label} ${crypto.randomUUID().slice(0, 8)}` });
  created.add(v.id);
  console.log(`Throwaway village: ${v.id} (${v.name})`);
  for (const member of members) await ok('/villages/join', member, { invite_code: v.invite_code });
  return v;
}

export const profile = (vid: string, user = owner) => ok(`/villages/${vid}/users/${user}`, user);
export const shop = (vid: string, user = owner) => ok(`/villages/${vid}/shop`, user);
export const note = (body = 'QA synthetic daily note') => ({ kind: 'status', body, idempotency_key: crypto.randomUUID() });

export async function earn(vid: string, minimum: number, user = owner) {
  if (minimum > 250) throw new Error('QA funding cap exceeded');
  const goal = await ok(`/villages/${vid}/goals`, user, { title: 'QA synthetic weekly goal' });
  for (let n = 0; n < 10 && (await shop(vid, user)).balance < minimum; n++) {
    await ok(`/villages/${vid}/check-ins`, user, { ...note('QA synthetic goal progress'), kind: 'progress', goal_id: goal.id });
  }
}
