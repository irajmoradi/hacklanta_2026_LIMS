import {expect,test} from 'bun:test';
import {MockApi} from './mock';
import {DEMO_USER_ID,DEMO_VILLAGE_ID} from './fixtures';
import type {Profile,Shop,Village} from './types';
test('mock farm requires unlock/paddock and retains six animals plus dog through spending',async()=>{
  const api=new MockApi(),root=`/villages/${DEMO_VILLAGE_ID}`;
  const buy=(item_id:string)=>api.request('POST',`${root}/shop/buy`,DEMO_USER_ID,{item_id});
  await expect(buy('house_paddock')).rejects.toMatchObject({status:409});
  const profile=await api.request<Profile>('GET',`${root}/users/${DEMO_USER_ID}`,DEMO_USER_ID);
  for(let i=0;i<30;i++)await api.request('POST',`${root}/check-ins`,DEMO_USER_ID,{kind:'progress',goal_id:profile.goal!.id,body:'progress',idempotency_key:`farm-${i}`});
  await expect(buy('chicken')).rejects.toMatchObject({status:409});
  await buy('house_paddock');await buy('house_backyard');await buy('pet_dog');
  for(const id of ['chicken','duckling','goat_kid','calf','chicken_friend','duckling_friend'])await buy(id);
  const before=await api.request<Shop>('GET',`${root}/shop`,DEMO_USER_ID);
  await expect(buy('calf_friend')).rejects.toMatchObject({status:409});
  expect((await api.request<Shop>('GET',`${root}/shop`,DEMO_USER_ID)).balance).toBe(before.balance);
  const village=await api.request<Village>('GET',root,DEMO_USER_ID),person=village.villagers[0];
  expect(person.equipped.filter(i=>i.slot==='farm_animal')).toHaveLength(6);
  expect(person.equipped_ids).toContain('pet_dog');expect(person.equipped_ids).toContain('house_backyard');
  expect(village.world!.unlocked.some(b=>typeof b==='string'?b==='farm_store':b.id==='farm_store')).toBe(true);
});


test('debug XP advances the earned world without losing farm unlocks to purchases', async () => {
  const api = new MockApi(), root = `/villages/${DEMO_VILLAGE_ID}`;
  const before = await api.request<Village>('GET', root, DEMO_USER_ID);
  const earned = before.world!.xp;
  await api.request('POST', '/demo/debug/xp', DEMO_USER_ID, {amount:2000, idempotency_key:'farm-debug'});
  const after = await api.request<Village>('GET', root, DEMO_USER_ID);
  expect(after.world!.xp).toBe(earned + 2000);
  await api.request('POST', `${root}/shop/buy`, DEMO_USER_ID, {item_id:'house_paddock'});
  expect((await api.request<Village>('GET', root, DEMO_USER_ID)).world!.xp).toBe(earned + 2000);
});
