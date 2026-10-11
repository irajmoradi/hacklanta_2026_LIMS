import {afterEach,expect,test} from 'bun:test';
import {AmbienceMixer,birdDelay,distanceGain,fadeValue} from './ambience';
const original={AudioContext:globalThis.AudioContext,fetch:globalThis.fetch};
afterEach(()=>Object.assign(globalThis,original));
class Param {
 value=0; ramps:number[][]=[];
 setValueAtTime(v:number,_t:number){this.value=v;}
 cancelScheduledValues(_t:number){}
 linearRampToValueAtTime(v:number,t:number){this.ramps.push([v,t]);}
}
class Node {gain=new Param();positionX=new Param();positionY=new Param();positionZ=new Param();connect(){}disconnect(){}start(){}stop(){} }
class Context {
 currentTime=0;destination={};state='suspended';gains:Node[]=[];pans:Node[]=[];
 listener={setPosition(..._p:number[]){},setOrientation(..._p:number[]){}};
 createGain(){const n=new Node();this.gains.push(n);return n;}
 createBufferSource(){return new Node();}
 createPanner(){const n=new Node();this.pans.push(n);return n;}
 decodeAudioData(){return Promise.resolve({});}
 resume(){this.state='running';return Promise.resolve();}
 suspend(){this.state='suspended';return Promise.resolve();}
}
async function ready() {
 Object.assign(globalThis,{AudioContext:Context,fetch:async()=>new Response(new Uint8Array(1))});
 const mixer=new AmbienceMixer();mixer.setAssets(['day_birds_breeze','night_soft','rain_soft','fountain_trickle'].map(name=>({name,file:`/sfx/${name}.ogg`,loop:true})));
 mixer.setBed('day_birds_breeze');mixer.configure(true,.65);expect(mixer.context).toBeUndefined();mixer.unlock();
 await new Promise(resolve=>setTimeout(resolve,5));return mixer;
}
test('four-second dusk fade and interrupted fades preserve instantaneous gain',async()=>{
 const m=await ready(),c=m.context as unknown as Context;
 expect(c.gains[1].gain.ramps.at(-1)).toEqual([.7,3]);c.currentTime=1.5;m.setBed('night_soft');
 expect(c.gains[1].gain.value).toBeCloseTo(.35);expect(c.gains[1].gain.ramps.at(-1)).toEqual([0,4.5]);
 expect(c.gains[2].gain.ramps.at(-1)).toEqual([.45,5.5]);c.currentTime=2;m.setBed('rain_soft');
 expect(c.gains[2].gain.value).toBeCloseTo(.05625);expect(c.gains[2].gain.ramps.at(-1)).toEqual([0,5]);m.stop();
});
test('repeated night settings do not restart dusk fade and dawn fades out in three seconds',async()=>{
 const m=await ready(),c=m.context as unknown as Context;
 m.setBed('night_soft');const night=c.gains[2].gain;
 expect(night.ramps.at(-1)).toEqual([.45,4]);c.currentTime=2;
 m.setBed('night_soft');m.configure(true,.4);expect(night.ramps).toHaveLength(1);
 c.currentTime=4;m.setBed('day_birds_breeze');expect(night.value).toBeCloseTo(.45);
 expect(night.ramps.at(-1)).toEqual([0,7]);m.stop();
});
test('toggle suspends, resumes and scales ambience below UI volume',async()=>{
 const m=await ready(),c=m.context as unknown as Context;
 expect(c.gains[0].gain.value).toBeCloseTo(.2275);
 m.configure(true,.65);expect(c.gains[0].gain.value).toBeCloseTo(.2275);
 m.configure(false,.65);expect(c.state).toBe('suspended');expect(c.gains[0].gain.value).toBe(0);
 m.configure(true,.2);expect(c.state).toBe('running');expect(c.gains[0].gain.value).toBeCloseTo(.07);m.stop();
});
test('emitters use inverse Panner distance falloff and track object movement',async()=>{
 const m=await ready(),c=m.context as unknown as Context;m.setEmitter('fountain','fountain_trickle',[10,0,20]);
 expect(c.pans).toHaveLength(1);expect(c.pans[0].positionX.value).toBe(10);
 m.setEmitter('fountain','fountain_trickle',[12,0,20]);expect(c.pans[0].positionX.value).toBe(12);
 expect(distanceGain(8)).toBe(1);expect(distanceGain(35)).toBeLessThan(distanceGain(10));
 expect(distanceGain(Math.hypot(35,80))).toBeLessThan(distanceGain(35));m.removeEmitter('fountain');m.stop();
});
test('bird intervals and fade boundaries are bounded',()=>{
 expect(birdDelay(()=>0)).toBe(8000);expect(birdDelay(()=>1)).toBe(25000);
 expect(fadeValue({from:0,to:1,start:1,end:4},-1)).toBe(0);expect(fadeValue({from:0,to:1,start:1,end:4},6)).toBe(1);
});
test('absent assets remain silent without preventing settings changes',async()=>{
 Object.assign(globalThis,{AudioContext:Context,fetch:async()=>new Response('',{status:404})});
 const m=new AmbienceMixer();m.setAssets([{name:'night_soft',file:'/sfx/missing.ogg',loop:true}]);m.unlock();m.configure(true,1);m.setBed('night_soft');
 await new Promise(resolve=>setTimeout(resolve,5));expect((m.context as unknown as Context).gains).toHaveLength(1);m.stop();
});
