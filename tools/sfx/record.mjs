import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const out=resolve(import.meta.dirname,'../../assets/audio');
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1060,height:720},reducedMotion:'no-preference'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5197');await page.waitForFunction(()=>window.sound);
 if(await page.evaluate(()=>!!window.sound.ambience.context))throw Error('Audio context created before interaction');
 await page.click('#start');await page.waitForFunction(()=>window.done,{},{timeout:60000});
 writeFileSync(`${out}/AUDIO-001-ab.webm`,Buffer.from(await page.evaluate(()=>window.recordingBytes)));
 await page.screenshot({path:`${out}/AUDIO-001-qa.png`});
 if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS: gesture gate, production mixer recording, no browser errors');
} finally {await browser.close();}
