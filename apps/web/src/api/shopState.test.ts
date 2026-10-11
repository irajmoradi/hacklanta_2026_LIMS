import { expect, test } from 'bun:test';
import { itemState } from './shopState';
import { catalog } from './equipment';
import type { Shop } from './types';
const shop = (): Shop => ({balance:100, items:catalog.map(i=>({...i, owned:false}))});
test('pet with enough coins explains both backyard and shelter, without duplicate legacy gate',()=>{
 const s=shop(), result=itemState(s.items.find(i=>i.id==='pet_dog')!,s);
 expect(result.state).toBe('locked');
 expect(result.reasons).toEqual(['Needs Backyard (100 coins) first','Unlocks when the village builds the Pet Shelter']);
 expect(result.prerequisites).toEqual(['house_backyard']);
});
test('inventory plus durable unlock makes pet buyable; price shortfall is exact',()=>{
 const s=shop(); s.inventory=[{item_id:'house_backyard'}]; s.unlocks=['pet_shelter'];
 const dog=s.items.find(i=>i.id==='pet_dog')!;
 expect(itemState(dog,s).state).toBe('buyable');s.balance=60;
 expect(itemState(dog,s).reasons).toEqual(['Need 40 more coins']);
});
test('owned wins over gates; earn-only source never permits purchase',()=>{
 const s=shop(), item={...s.items[0],source:'Win the weekly festival'};
 expect(itemState(item,s).reasons).toEqual(['Win the weekly festival']);
 s.inventory=[item.id];expect(itemState(item,s).state).toBe('owned');
});

test('reward locks use readable source labels in visible and accessible explanations',()=>{
 const s=shop();
 for (const [source,reason] of [['earned:auditor','Earned: Audit completion'],['earned:weekly_crown','Earned: Weekly crown'],['event:mayor_event','Event: Mayor event'],['earned:new_reward','Earned: new reward']]) {
  expect(itemState({...s.items[0],price_coins:0,source},s)).toMatchObject({state:'locked',reasons:[reason]});
 }
});
test('legacy requires item and arrays resolve and deduplicate',()=>{
 const s=shop(), item={...s.items[0],requires:['house_backyard','pet_shelter'],requires_item:'house_backyard'};
 expect(itemState(item,s).reasons).toHaveLength(2);
});

test('photo token locks at a shortfall and unlocks at the exact price',()=>{
 const s=shop(), token=s.items.find(i=>i.id==='photo_token')!;
 s.balance=token.price_coins-15;
 expect(itemState(token,s)).toMatchObject({state:'locked',reasons:['Need 15 more coins']});
 s.balance=token.price_coins;
 expect(itemState(token,s).state).toBe('buyable');
 expect(itemState({...token,requires_building:'garden'},s).reasons).toContain('Unlocks when the village builds the Garden');
 s.balance-=token.price_coins;
 expect(itemState(token,s).state).toBe('locked');
});
