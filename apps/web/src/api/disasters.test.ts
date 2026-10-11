import {expect,test,spyOn} from 'bun:test';
import {MockApi} from './mock';
import {DEMO_USER_ID as uid,DEMO_VILLAGE_ID as vid} from './fixtures';
import type {Village,Shop} from './types';

test('offline blackout cannot stack or repeat and restores its weather',async()=>{
  const api=new MockApi();
  const action=(name:string,body={})=>api.request('POST',`/demo/debug/${name}`,uid,{idempotency_key:crypto.randomUUID(),...body});
  await action('disaster',{disaster:'blackout'});
  await action('xp',{amount:100});
  await api.request('POST',`/villages/${vid}/check-ins`,uid,{kind:'status',body:'Helping',idempotency_key:crypto.randomUUID()});
  expect((await api.request<Village>('GET',`/villages/${vid}`,uid)).world?.disaster?.kind).toBe('blackout');
  expect((await api.request<Village>('GET',`/villages/${vid}`,uid)).world?.weather).toBe('rain');
  await expect(action('disaster',{disaster:'blight'})).rejects.toThrow('Repair');
  await expect(action('weather')).rejects.toThrow('Repair');
  await action('repair');
  const repaired=await api.request<Village>('GET',`/villages/${vid}`,uid);
  expect(repaired.world?.disaster).toBeNull();
  expect(repaired.world?.rebuilt_at).toBeTruthy();
  await expect(action('disaster',{disaster:'blackout'})).rejects.toThrow('different');
});

test('offline outbreak keeps ownership and revival retries are free',async()=>{
  const api=new MockApi();
  await api.request('POST','/demo/debug/xp',uid,{idempotency_key:crypto.randomUUID(),amount:2000});
  await api.request('POST',`/villages/${vid}/shop/buy`,uid,{item_id:'house_backyard'});
  await api.request('POST',`/villages/${vid}/shop/buy`,uid,{item_id:'pet_dog'});
  await api.request('POST','/demo/debug/disaster',uid,{idempotency_key:crypto.randomUUID(),disaster:'outbreak'});
  const clock=spyOn(Date,'now').mockReturnValue(Date.now()+49*3600000);
  try {
    const away=await api.request<Village>('GET',`/villages/${vid}`,uid);
    expect(away.villagers.find(p=>p.user_id===uid)?.equipped_ids).not.toContain('pet_dog');
    const xpBefore=away.villagers.find(p=>p.user_id===uid)!.xp;
    const shop=await api.request<Shop>('GET',`/villages/${vid}/shop`,uid);
    expect(shop.items.find(i=>i.id==='pet_dog')?.away).toBe(true);
    for(let i=0;i<2;i++) {
      const result=await api.request<{balance:number}>('POST',`/villages/${vid}/shop/buy`,uid,{item_id:'revival_potion'});
      expect(result.balance).toBe(shop.balance-30);
    }
    const home=await api.request<Village>('GET',`/villages/${vid}`,uid);
    expect(home.villagers.find(p=>p.user_id===uid)?.xp).toBe(xpBefore);
    expect(home.villagers.find(p=>p.user_id===uid)?.equipped_ids).toContain('pet_dog');
  } finally {clock.mockRestore();}
});
