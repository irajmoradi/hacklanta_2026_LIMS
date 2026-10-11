import {test,expect} from 'bun:test';
import {parseSplit,allocate} from './payouts';
test('ranked percentages are exact, positive and bounded',()=>{
 expect(parseSplit('60/30/10')).toEqual([6000,3000,1000]);
 expect(parseSplit('33.33,33.33,33.34')).toEqual([3333,3333,3334]);
 for(const s of ['','60/30','100/0','NaN','50/50.001','-10/110',Array(11).fill('10').join('/')])expect(()=>parseSplit(s)).toThrow();
});
test('all payout modes conserve lamports and break ties in join order',()=>{
 expect(allocate(21n,[5n,5n,1n],'winner_take_all')).toEqual([21n,0n,0n]);
 expect(allocate(21n,[5n,5n,1n],'ranked',[6000,3000,1000])).toEqual([13n,6n,2n]);
 expect(allocate(21n,[0n,5n,1n],'ranked',[6000,3000,1000])).toEqual([0n,14n,7n]);
 expect(allocate(10n,[1n,1n,1n],'proportional')).toEqual([4n,3n,3n]);
});
