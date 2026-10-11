import { afterEach, expect, test } from 'bun:test';
import { ambientFor, SoundEngine } from './engine';
const original = {Audio: globalThis.Audio, fetch: globalThis.fetch, localStorage: globalThis.localStorage, matchMedia: globalThis.matchMedia, document: globalThis.document};
afterEach(() => {Object.assign(globalThis, original);});
test('gesture gate, manifest volumes, mute, reduced preferences and denied storage', async () => {
  const clips: {plays:number; pauses:number; volume:number}[] = [];
  Object.assign(globalThis, {Audio: class {plays=0; pauses=0; volume=0; currentTime=0; constructor(){clips.push(this);} play(){this.plays++; return Promise.resolve();} pause(){this.pauses++;}},
    fetch: async () => new Response(JSON.stringify([{name:'poke_boing',file:'/sfx/poke_boing.mp3',volume:.6,loop:false}])),
    localStorage: {getItem(){throw Error('denied');},setItem(){throw Error('denied');}}, matchMedia: () => ({matches:false})});
  const engine = new SoundEngine(); await engine.init(); engine.play('poke_boing'); expect(clips[0].plays).toBe(0);
  engine.unlock(); engine.play('poke_boing'); expect(clips[0].plays).toBe(1); expect(clips[0].volume).toBeCloseTo(.39);
  engine.configure({muted:true}); engine.play('poke_boing'); expect(clips[0].plays).toBe(1); expect(clips[0].pauses).toBeGreaterThan(0);
  engine.configure({muted:false,reduced:true}); engine.play('poke_boing'); expect(clips[0].plays).toBe(1);
  engine.configure({reduced:false}); Object.assign(globalThis,{matchMedia:()=>({matches:true})}); engine.play('poke_boing'); expect(clips[0].plays).toBe(1);
});
test('ambient follows festival, explicit time and local clock', () => {expect(ambientFor('festival','day',12)).toBe('day_birds_breeze'); expect(ambientFor('clear','night',12)).toBe('night_soft'); expect(ambientFor('clear','',23)).toBe('night_soft'); expect(ambientFor('clear','day',23)).toBe('day_birds_breeze');});
test('rain takes priority and festival nights remain calm',()=>{expect(ambientFor('rain','night')).toBe('rain_soft');expect(ambientFor('festival_night','')).toBe('night_soft');});
test('hidden tab blocks effects and ambience; visible tab restores only ambience',async()=>{
 let plays=0;const enabled:boolean[]=[];
 Object.assign(globalThis,{document:{hidden:false},Audio:class{volume=0;play(){plays++;return Promise.resolve();}pause(){}},fetch:async()=>new Response(JSON.stringify([{name:'poke',file:'/sfx/poke.mp3',volume:1,loop:false}])),localStorage:{getItem:()=>null,setItem(){}},matchMedia:()=>({matches:false})});
 const engine=new SoundEngine();engine.ambience.unlock=()=>{};engine.ambience.configure=(value)=>{enabled.push(value);};await engine.init();engine.unlock();engine.play('poke');expect(plays).toBe(1);
 Object.assign(globalThis,{document:{hidden:true}});engine.sync();engine.play('poke');expect(enabled.at(-1)).toBe(false);expect(plays).toBe(1);
 Object.assign(globalThis,{document:{hidden:false}});engine.sync();expect(enabled.at(-1)).toBe(true);expect(plays).toBe(1);
 engine.configure({volume:5});expect(engine.settings.volume).toBe(1);engine.configure({volume:NaN});expect(engine.settings.volume).toBe(1);engine.stop();
});
