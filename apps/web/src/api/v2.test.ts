import { describe, expect, test } from 'bun:test';
import { MockApi } from './mock';
import { DEMO_USER_ID as owner, DEMO_VILLAGE_ID } from './fixtures';
import type { CheckInResult, Profile, Review } from './types';
const village = `/villages/${DEMO_VILLAGE_ID}`;
const member = owner.slice(0, -1) + '2';
describe('v2 authorization and atomic rewards', () => {
  test('goal owner or village owner only; event participants are validated before awarding', async () => {
    const api = new MockApi();
    await expect(api.request('POST', `${village}/goals/goal-0/status`, member, { status: 'done' })).rejects.toMatchObject({ status: 403 });
    await api.request('POST', `${village}/goals/goal-1/status`, member, { status: 'missed' });
    await expect(api.request('POST', `${village}/events/challenge-1/complete`, member, { user_ids: [member] })).rejects.toMatchObject({ status: 403 });
    await expect(api.request('POST', `${village}/events/challenge-1/complete`, owner, { user_ids: [member, 'stranger'] })).rejects.toMatchObject({ status: 422 });
    const before = await api.request<Profile>('GET', `${village}/users/${member}`, owner);
    for (let i = 0; i < 2; i++) await api.request('POST', `${village}/events/challenge-1/complete`, owner, { user_ids: [member, member] });
    const after = await api.request<Profile>('GET', `${village}/users/${member}`, owner);
    expect(after.villager.xp).toBe(before.villager.xp + 50);
  });
  test('evidence is linked, scoped to uploader, and review override requires owner and reason', async () => {
    const api = new MockApi(), form = new FormData(); form.set('file', new File(['synthetic'], 'test.png', { type: 'image/png' }));
    const { evidence_asset_id } = await api.request<{ evidence_asset_id: string }>('POST', `${village}/evidence`, member, form);
    const body = { kind: 'status', body: 'Made progress', evidence_asset_id, idempotency_key: 'evidence-key' };
    await expect(api.request('POST', `${village}/check-ins`, owner, body)).rejects.toMatchObject({ status: 403 });
    const result = await api.request<CheckInResult>('POST', `${village}/check-ins`, member, body);
    expect(result.check_in.evidence_url).toContain(evidence_asset_id);
    const route = `${village}/check-ins/${result.check_in.id}/review/override`;
    await expect(api.request('POST', route, member, { reason: 'Mismatch' })).rejects.toMatchObject({ status: 403 });
    const review = await api.request<Review>('POST', route, owner, { reason: 'I checked the full result' });
    expect(review).toMatchObject({ verdict: 'verified', model: 'human-owner' });
    await expect(api.request('POST', route, owner, { reason: '' })).rejects.toMatchObject({ status: 422 });
  });
});
