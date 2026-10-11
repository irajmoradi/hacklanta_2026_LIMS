import { expect, test } from 'bun:test';
import { MockApi } from './mock';
import { DEMO_USER_ID } from './fixtures';
import { defaultVillage, rememberVillage } from './villagePreference';
import { DEMO_VILLAGE_ID } from './fixtures';

test('idle preference persists into me and people; pet walking requires equipped pet', async () => {
  const api = new MockApi();
  for (const idle_activity of ['working_out','gaming','studying','home','gardening','reading','dancing','food']) {
    const me=await api.request<any>('PATCH','/me',DEMO_USER_ID,{idle_activity});
    expect(me.user.idle_activity).toBe(idle_activity);
    const village=await api.request<any>('GET',`/villages/${DEMO_VILLAGE_ID}`,DEMO_USER_ID);
    expect(village.villagers[0].idle_activity).toBe(idle_activity);
  }
  for(const idle_activity of ['invalid',null,'walk_pet']) await expect(api.request('PATCH','/me',DEMO_USER_ID,{idle_activity})).rejects.toMatchObject({status:422});
  const lance='00000000-0000-4000-8000-000000000002';
  expect(await api.request('PATCH','/me',lance,{idle_activity:'walk_pet'})).toMatchObject({user:{idle_activity:'walk_pet',has_equipped_pet:true}});
});

test('settings PATCH is partial, validated, private and returns the me shape', async () => {
  const api = new MockApi();
  const result = await api.request<any>('PATCH', '/me', DEMO_USER_ID, {display_name: 'New name', phone_e164: '+15551234567', roast_ok: true, agent_msgs_ok: false});
  expect(result.user.display_name).toBe('New name'); expect(result.user.roast_ok).toBe(true); expect(result.villages.length).toBeGreaterThan(0);
  await expect(api.request('PATCH', '/me', DEMO_USER_ID, {phone_e164: '555'})).rejects.toMatchObject({status: 422});
  const cleared = await api.request<any>('PATCH', '/me', DEMO_USER_ID, {phone_e164: null});
  expect(cleared.user.phone_e164).toBeNull(); expect(cleared.user.display_name).toBe('New name');
  const other = await api.request<any>('GET', '/me', '00000000-0000-4000-8000-000000000002');
  expect(other.user.roast_ok).toBe(false);
});
test('voice requires consent, 1–3 valid samples and deletion before replacement', async () => {
  const api = new MockApi(), form = new FormData();
  form.append('files', new File(['synthetic'], 'memo.wav', {type: 'audio/wav'}));
  await expect(api.request('POST', '/me/voice', DEMO_USER_ID, form)).rejects.toMatchObject({status: 422});
  form.set('consent', 'true');
  expect(await api.request('POST', '/me/voice', DEMO_USER_ID, form)).toMatchObject({voice_consent: true, voice_consent_version: 'village-voice-v1'});
  await expect(api.request('POST', '/me/voice', DEMO_USER_ID, form)).rejects.toMatchObject({status: 409});
  await api.request('DELETE', '/me/voice', DEMO_USER_ID);
  expect(await api.request('DELETE', '/me/voice', DEMO_USER_ID)).toMatchObject({voice_id: null, voice_consent: false});
  form.append('files', new File(['bad'], 'bad.txt', {type: 'text/plain'}));
  await expect(api.request('POST', '/me/voice', DEMO_USER_ID, form)).rejects.toMatchObject({status: 415});
});
test('default village remembers only eligible membership per user and survives blocked storage', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: {getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value)}});
  try {
    const me = {user: {id: 'a', display_name: 'A'}, villages: [{id: 'new', name: 'New', joined_at: '2026-10-10'}, {id: 'old', name: 'Old', joined_at: '2026-01-01'}]};
    expect(defaultVillage(me)).toBe('old'); rememberVillage('a', 'new'); expect(defaultVillage(me)).toBe('new');
    expect(defaultVillage({...me, user: {...me.user, id: 'b'}})).toBe('old');
    rememberVillage('a', 'removed'); expect(defaultVillage(me)).toBe('old');
    Object.defineProperty(globalThis, 'localStorage', {configurable: true, get: () => {throw new Error('blocked');}});
    rememberVillage('a', 'new'); expect(defaultVillage(me)).toBe('old'); expect(defaultVillage({...me, villages: []})).toBeUndefined();
  } finally { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else Reflect.deleteProperty(globalThis, 'localStorage'); }
});


test('oldest membership compares instants; partial dates preserve API order', () => {
  const user = {id: 'dates-only', display_name: 'Dates'};
  expect(defaultVillage({user, villages: [{id: 'later', name: '', joined_at: '2026-01-01T00:00:00-08:00'}, {id: 'earlier', name: '', joined_at: '2026-01-01T01:00:00Z'}]})).toBe('earlier');
  expect(defaultVillage({user, villages: [{id: 'first', name: ''}, {id: 'dated', name: '', joined_at: '2025-01-01'}]})).toBe('first');
  expect(defaultVillage({user, villages: [{id: 'invalid', name: '', joined_at: 'invalid'}, {id: 'dated', name: '', joined_at: '2025-01-01'}]})).toBe('invalid');
});
