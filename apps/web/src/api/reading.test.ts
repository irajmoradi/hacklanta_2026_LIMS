import { expect, test } from 'bun:test';
import { MockApi } from './mock';
import { DEMO_USER_ID, DEMO_VILLAGE_ID } from './fixtures';
import { readingMonday, readingLink, type ReadingShelf } from './reading';

test('UTC weeks and safe reading links', () => {
  expect(readingMonday(new Date('2026-10-11T23:59:59Z'))).toBe('2026-10-05');
  expect(readingMonday(new Date('2026-10-12T00:00:00Z'))).toBe('2026-10-12');
  expect(readingLink('javascript:alert(1)')).toBeUndefined();
  expect(readingLink('https://example.com')).toBe('https://example.com/');
});
test('shared shelf caps rewards, retries, optional takeaway and feed', async () => {
  const api = new MockApi(), path = `/villages/${DEMO_VILLAGE_ID}/reading`;
  const call = (method: string, suffix = '', body?: unknown) => api.request<ReadingShelf>(method, path + suffix, DEMO_USER_ID, body);
  let shelf = await call('GET');
  expect(shelf.items).toHaveLength(0);
  for (let i = 0; i < 10; i++) shelf = await call('POST', '', {title: `Book ${i}`});
  await expect(call('POST', '', {title: 'Eleventh'})).rejects.toThrow();
  for (const item of shelf.items) { await call('POST', `/${item.id}/complete`, {takeaway:'A useful read'}); await call('POST', `/${item.id}/complete`, {}); }
  shelf = await call('GET');
  expect(shelf.awarded_count).toBe(5);
  expect(shelf.items.every(i => i.readers.length === 1)).toBe(true);
  expect(shelf.items[0].readers[0].takeaway).toBe('A useful read');
  const events = await api.request<{type:string}[]>('GET', `/villages/${DEMO_VILLAGE_ID}/accomplishments`, DEMO_USER_ID);
  expect(events.filter(e => e.type === 'reading_completed')).toHaveLength(10);
  const archive = await call('GET', '?week_start=2020-01-06');
  expect(archive.read_only).toBe(true);
});
