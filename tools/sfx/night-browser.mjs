import {chromium} from '@playwright/test';
import {resolve} from 'node:path';
const browser=await chromium.launch({headless:true});
try {
 for(const fallback of [false,true]) {
  const page=await browser.newPage({viewport:{width:1000,height:680}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  if(fallback)await page.route('**/sfx/night_soft.ogg',route=>route.fulfill({status:404,body:''}));
  await page.goto('http://127.0.0.1:5197/night.html');
  await page.waitForFunction(()=>window.mixer);
  await page.waitForFunction(()=>Math.abs(document.querySelector('#ab').duration-20)<.05);
  if(await page.evaluate(()=>!!window.mixer.context))throw Error('Gesture gate failed');
  await page.click('#new');
  await page.waitForFunction(()=>window.mixer.voices.has('bed:night_soft'));
  const initial=await page.evaluate(()=>{
   const m=window.mixer,v=m.voices.get('bed:night_soft');
   return {fade:v.fade.end-v.fade.start,duration:v.source.buffer.duration,loop:v.source.loop};
  });
  if(Math.abs(initial.fade-4)>.000001 || Math.abs(initial.duration-20)>.05 || !initial.loop)throw Error(JSON.stringify(initial));
  await page.waitForTimeout(4300);
  const gain=await page.evaluate(()=>window.mixer.voices.get('bed:night_soft').gain.gain.value);
  if(Math.abs(gain-.45)>.001)throw Error(`Unexpected night gain ${gain}`);
  if(!fallback)await page.screenshot({path:resolve(import.meta.dirname,'../../assets/audio/AUDIO-002-qa.png')});
  await page.click('#stop');
  if(await page.evaluate(()=>window.mixer.voices.size))throw Error('Stop leaked sources');
  if(errors.length)throw Error(errors.join('\n'));
  await page.close();console.log(`PASS: browser ${fallback?'MP3 fallback':'OGG'}, gesture gate, real decode, four-second ramp, loop and stop`);
 }
} finally {await browser.close();}
