import {expect, test} from 'bun:test';
import {VillageApi} from './client';

test('bearer credentials replace demo headers and refresh for every request', async () => {
  const api = new VillageApi(); api.user = 'demo-seat';
  expect(await api.authHeaders()).toEqual({'X-Demo-User':'demo-seat'});
  let sequence = 0;
  api.tokenProvider = async () => `token-${++sequence}`;
  expect(await api.authHeaders()).toEqual({Authorization:'Bearer token-1'});
  expect(await api.authHeaders()).toEqual({Authorization:'Bearer token-2'});
  api.tokenProvider = async () => {throw new Error('Session expired');};
  await expect(api.authHeaders()).rejects.toThrow('Session expired');
  api.tokenProvider = undefined;
  expect(await api.authHeaders()).toEqual({'X-Demo-User':'demo-seat'});
});

test('claim code supplies its village and is sent in a POST body', async () => {
  const api = new VillageApi();
  const calls: unknown[] = [];
  api.request = async (method, path, body) => {calls.push({method,path,body}); return {} as never;};
  await api.claimSeat('village.secret');
  expect(calls).toEqual([{method:'POST',path:'/auth/claim-seat',body:{village_id:'village',code:'village.secret'}}]);
});
