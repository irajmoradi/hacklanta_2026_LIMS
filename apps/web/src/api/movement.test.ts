import { expect, test } from 'bun:test';
import { MovementBuffer } from './movement';
const point = (x: number, seq: number, extra = {}) => ({x, z: 0, heading: 0, moving: true, running: false, seq, ...extra});
test('100ms buffer, capped extrapolation and silence expiry', () => {
  const b = new MovementBuffer();
  b.push('a', point(0,1), 0); b.push('a', point(1,2), 100);
  expect(b.sample('a',150)?.x).toBeCloseTo(.5);
  expect(b.sample('a',250)?.x).toBeCloseTo(1.5);
  expect(b.sample('a',2000)?.x).toBeCloseTo(3);
  expect(b.sample('a',5101)).toBeNull();
  expect(b.tracks.size).toBe(0);
});
test('stop is buffered; stale packets and wraparound headings are handled', () => {
  const b = new MovementBuffer();
  b.push('a', point(0,1,{heading:3.1}),0);
  b.push('a', point(1,2,{heading:-3.1}),100);
  b.push('a', point(100,1),110);
  expect(Math.abs(b.sample('a',150)!.heading)).toBeCloseTo(Math.PI);
  b.push('a', point(1,3,{moving:false}),200);
  expect(b.sample('a',250)).not.toBeNull();
  expect(b.sample('a',301)).toBeNull();
});
test('bounded tracks keep emote start across updates', () => {
  const b = new MovementBuffer();
  for(let i=0;i<100;i++) b.push('a',point(i,i,{emote:'wave'}),i*100);
  expect(b.tracks.get('a')!.length).toBe(8);
  expect(b.sample('a',10000)?.emoteStart).toBe(0);
});
