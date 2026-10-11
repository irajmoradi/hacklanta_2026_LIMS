import { describe, expect, test } from 'bun:test';
import { MockApi } from './mock';
import { DEMO_USER_ID as me, DEMO_VILLAGE_ID as vid, makeFixtures } from './fixtures';
import { readPresence, type Message, type BribeReceipt, type Presence } from './social';
const peer = makeFixtures().village.villagers.find(v => v.user_id !== me)!.user_id;
const path = `/villages/${vid}`;
describe('social mock contract', () => {
  test('private conversations, unread and recipient-only idempotent read', async () => {
    const api = new MockApi();
    const sent = await api.request<Message>('POST', `${path}/messages`, me, {to_user_id: peer, text: '<script>hello</script>'});
    expect((await api.request<{messages: Message[]}>('GET', `${path}/messages`, me)).messages).toHaveLength(0);
    expect((await api.request<{unread_count: number}>('GET', `${path}/messages/unread`, peer)).unread_count).toBe(1);
    await expect(api.request('POST', `${path}/messages/${sent.id}/read`, me)).rejects.toMatchObject({status:404});
    const read = await api.request<Message>('POST', `${path}/messages/${sent.id}/read`, peer);
    expect((await api.request<Message>('POST', `${path}/messages/${sent.id}/read`, peer)).read_at).toBe(read.read_at);
    expect((await api.request<{unread_count: number}>('GET', `${path}/messages/unread`, peer)).unread_count).toBe(0);
    await expect(api.request('POST', `${path}/messages`, me, {to_user_id: me, text:'self'})).rejects.toMatchObject({status:422});
  });
  test('pokes and cheers enter feed; ordinary messages stay private', async () => {
    const api = new MockApi();
    for (const kind of ['message','poke','cheer']) await api.request('POST', `${path}/messages`, me, {to_user_id:peer,text:kind,kind});
    const feed = await api.request<{type: string}[]>('GET', `${path}/feed`, me);
    expect(feed.filter(f => f.type === 'poke' || f.type === 'cheer')).toHaveLength(2);
    expect(feed.some(f => f.type === 'message')).toBe(false);
  });
  test('rate limit, extra fields and invalid coordinates match contract errors', async () => {
    const api = new MockApi();
    await expect(api.request('POST', `${path}/messages`, me, {to_user_id:peer,text:'Hello',relay:true})).rejects.toMatchObject({status:422});
    for (let i = 0; i < 20; i++) await api.request('POST', `${path}/messages`, me, {to_user_id:peer,text:'Hello'});
    await expect(api.request('POST', `${path}/messages`, me, {to_user_id:peer,text:'Hello again'})).rejects.toMatchObject({status:429});
    await expect(api.request('POST', `${path}/presence/heartbeat`, me, {x:NaN,z:0})).rejects.toMatchObject({status:422});
  });
  test('bribes debit exactly once per submission; invalid and unaffordable wishes fail', async () => {
    const api = new MockApi();
    const result = await api.request<BribeReceipt>('POST', `${path}/mayor/bribe`, me, {coins:50,wish:'Game night'});
    expect(result.bribe.status).toBe('pending'); expect(result.receipt).toContain('50 coins');
    expect((await api.request<{villager:{coins:number}}>('GET', `${path}/users/${me}`, me)).villager.coins).toBe(result.balance);
    await expect(api.request('POST', `${path}/mayor/bribe`, me, {coins:10000,wish:'Too much'})).rejects.toMatchObject({status:409});
    await expect(api.request('POST', `${path}/mayor/bribe`, me, {coins:1.5,wish:'Fraction'})).rejects.toMatchObject({status:422});
  });
  test('heartbeat updates activity and coordinates', async () => {
    const api = new MockApi();
    await api.request('POST', `${path}/presence/heartbeat`, me, {x:1,z:2,activity:'shopping'});
    const result = await api.request<{online:Presence[]}>('POST', `${path}/presence/heartbeat`, me, {x:3,z:4,activity:'in Week panel'});
    expect(result.online).toEqual([{user_id:me,x:3,z:4,activity:'in Week panel'}]);
  });
  test('deletion requires exact confirmation and erases mail and access', async () => {
    const api = new MockApi();
    await api.request('POST', `${path}/messages`, me, {to_user_id:peer,text:'hello'});
    await expect(api.request('DELETE','/me',me,{confirm:'delete'})).rejects.toMatchObject({status:422});
    expect(await api.request('DELETE','/me',me,{confirm:'DELETE'})).toMatchObject({deleted:true});
    await expect(api.request('GET','/me',me)).rejects.toMatchObject({status:401});
    expect((await api.request<{messages:Message[]}>('GET',`${path}/messages`,peer)).messages).toHaveLength(0);
  });
});
test('SSE handles split CRLF, multiline JSON, malformed events and UTF8', async () => {
  const source = 'event: presence\r\ndata: {"online":\r\ndata: [{"user_id":"a","x":0,"z":1,"activity":"caf\u00e9"}]}\r\n\r\nevent: presence\ndata: broken\n\nevent: presence\ndata: {"online":[]}\n\n';
  const bytes = new TextEncoder().encode(source); const snapshots: Presence[][] = [];
  const body = new ReadableStream({start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); }});
  await readPresence(new Response(body), new AbortController().signal, online => snapshots.push(online));
  expect(snapshots).toHaveLength(2); expect(snapshots[0][0].activity).toBe('caf\u00e9'); expect(snapshots[1]).toEqual([]);
});
