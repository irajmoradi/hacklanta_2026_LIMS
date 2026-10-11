import { chromium, type Page } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// The already-running API owns secret loading from VILLAGE_ENV_FILE.
// Nothing here needs provider credentials or reads/copies the environment file.
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/submission/video/data/demo');
const data = process.env.VILLAGE_ARTIFACT_DATA || 'C:/Users/mourn/Downloads/hacklanta/data';
const vid = '13370000-0000-4000-8000-000000000000';
const uid = (n:number) => `13370000-0000-4000-8000-00000000000${n}`;
const group = 'd5eca46a-2175-4915-8c3d-df1d040cea29';
const live = process.argv.includes('--live');
await mkdir(out+'/v2_stills',{recursive:true});
const budgetFile = out+'/v2-budget.json';
let budget:Record<string,number> = {voice:0,prayer:0,suggestion:0,bribe:0,equip:0};
try {budget=JSON.parse(await readFile(budgetFile,'utf8'));}catch(e:any){if(e.code!=='ENOENT')throw e;}
const report:any = {sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), live, shots:[], failures:[], requests:[], audio:[], artifacts:[], limitations:[
 'Live world is day/fog; no day/night UI exists. No fabricated night state.',
 'Current week is ungraded. Existing crown shown; no finalization or ceremony replay control.',
 'Photo-item reward/token-gate UI is absent from this preview. Real CV006 outputs shown instead.',
 'Poke control and existing Inbox shown without sending a message to another person.'
]};
const browser=await chromium.launch({headless:false,args:['--autoplay-policy=no-user-gesture-required','--window-size=1920,1080']});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,recordVideo:{dir:out+'/v2_raw',size:{width:1920,height:1080}}});
let page:Page, start=0;
const pending:Promise<void>[]=[];
await context.exposeBinding('captureAudio',(_s,d)=>{
 if(d.event==='stop'){const a=report.audio.find((a:any)=>a.id===d.id);if(a)a.endMs=d.time;return;}
 const file=`v2-audio-${d.id}.audio`;
 report.audio.push({...d,file});
 const task=writeFile(out+'/'+file,Buffer.from(d.base64,'base64'));pending.push(task);return task;
});
await context.addInitScript(({vid,user})=>{
 localStorage.setItem(`village:last:${user}`,vid);
 localStorage.setItem('village:sound',JSON.stringify({muted:false,volume:.65,reduced:false}));
 const play=HTMLMediaElement.prototype.play;let serial=0;
 HTMLMediaElement.prototype.play=function(){
  const media=this as HTMLMediaElement & {demoActive?:boolean};
  if(!media.demoActive){media.demoActive=true;
   media.addEventListener('playing',()=>{
    const id=++serial,time=performance.now(),offset=media.currentTime,volume=media.volume,loop=media.loop;
    const stop=()=>{media.demoActive=false;void (window as any).captureAudio({event:'stop',id,time:performance.now()});};
    media.addEventListener('pause',stop,{once:true});media.addEventListener('ended',stop,{once:true});
    void fetch(media.currentSrc||media.src).then(r=>r.blob()).then(b=>new Promise<string>(resolve=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.readAsDataURL(b);})).then(base64=>(window as any).captureAudio({event:'start',id,time,offset,volume,loop,src:media.currentSrc||media.src,duration:media.duration,base64}));
   },{once:true});
  }
  return play.call(this);
 };
},{vid,user:uid(1)});
await context.route('**/api/**',async route=>{
 const r=route.request(), u=new URL(r.url()), p=u.pathname;
 if(['GET','HEAD','OPTIONS'].includes(r.method()))return route.continue();
 const kind=p.endsWith('/voice/lines')?'voice':p.endsWith('/mayor/pray')?'prayer':p.endsWith('/suggestion')?'suggestion':p.endsWith('/mayor/bribe')?'bribe':/\/inventory\/(un)?equip$/.test(p)?'equip':null;
 const caps:Record<string,number>={voice:2,prayer:1,suggestion:1,bribe:1,equip:2};
 if(!live||r.method()!=='POST'||!kind||budget[kind]>=caps[kind]||u.searchParams.has('refresh')){report.failures.push(`Blocked mutation ${r.method()} ${p}`);return route.abort();}
 if(kind==='bribe'&&r.postDataJSON().xp!==1)throw new Error('Only a 1-XP demo bribe is allowed');
 budget[kind]++;await writeFile(budgetFile,JSON.stringify(budget,null,2));report.requests.push({kind,path:p});return route.continue();
});
page=await context.newPage();page.setDefaultTimeout(5000);
page.on('pageerror',e=>report.failures.push('Browser: '+e.message.slice(0,300)));
page.on('response',r=>{if(r.status()>=400)report.failures.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`);});
const button=(name:string|RegExp)=>page.getByRole('button',{name,exact:typeof name==='string'});
async function close(){for(let i=0;i<4&&await button('Close dialog').count();i++)await button('Close dialog').last().click();if(await button('Close profile').count())await button('Close profile').click();}
async function caption(title:string,body:string,tag='LIVE LOCAL PREVIEW · Seeded demo village · CC0 placeholder faces'){
 await page.evaluate(({title,body,tag})=>{
  let el=document.getElementById('v2-caption');if(!el){el=document.createElement('div');el.id='v2-caption';el.setAttribute('popover','manual');document.body.append(el);}
  el.style.cssText='position:fixed;inset:auto auto 100px 32px;margin:0;width:555px;padding:17px 22px;background:#122b29f5;border:1px solid #90ac91;border-radius:16px;color:#fff;font:19px/1.4 Arial;pointer-events:none;box-sizing:border-box';el.replaceChildren();
  for(const [text,style] of [[tag,'font-size:11px;letter-spacing:1px;color:#c5dfa2'],[title,'font-size:28px;font-weight:bold;margin:8px 0'],[body,'font-size:19px']]){const d=document.createElement('div');d.textContent=text;d.style.cssText=style;el.append(d);}
  if(el.matches(':popover-open'))el.hidePopover();el.showPopover();
 },{title,body,tag});
}
async function still(name:string){await page.screenshot({path:out+'/v2_stills/'+name+'.png'});}
async function shot(name:string,seconds:number,fn:()=>Promise<void>){
 const at=(await page.evaluate(()=>performance.now())-start)/1000;const row:any={name,startSeconds:at,plannedSeconds:seconds};report.shots.push(row);console.log('Chapter: '+name);
 try{await fn();}catch(e:any){row.failure=e.message.slice(0,450);report.failures.push(name+': '+row.failure);}
 const spent=(await page.evaluate(()=>performance.now())-start)/1000-at;if(spent<seconds)await page.waitForTimeout((seconds-spent)*1000);
 row.endSeconds=(await page.evaluate(()=>performance.now())-start)/1000;
}
async function slide(title:string,sub:string,paths:string[],seconds:number){
 const images=await Promise.all(paths.map(async p=>{report.artifacts.push(p);return 'data:image/'+(p.endsWith('.jpg')?'jpeg':'png')+';base64,'+(await readFile(resolve(data,p))).toString('base64');}));
 await page.evaluate(({title,sub,images})=>{
  const el=document.createElement('div');el.id='v2-slide';el.setAttribute('popover','manual');el.style.cssText='position:fixed;inset:0;margin:0;width:100vw;height:100vh;box-sizing:border-box;border:0;padding:45px 70px;background:#102623;color:#f8f3de;font-family:Arial;';
  const tag=document.createElement('p');tag.textContent='VILLAGE / COMPUTER VISION · REAL SAVED ARTIFACTS';tag.style.cssText='color:#c7db9e;font-size:17px;letter-spacing:3px';el.append(tag);
  const h=document.createElement('h1');h.textContent=title;h.style.cssText='font-size:43px;margin:18px 0 10px';el.append(h);
  const p=document.createElement('p');p.textContent=sub;p.style.cssText='font-size:24px;line-height:1.4;margin:0 0 22px';el.append(p);
  const gallery=document.createElement('div');gallery.style.cssText='display:flex;gap:24px;height:690px;align-items:center;justify-content:center;overflow:hidden;background:#e6e8df;border-radius:16px';
  for(const src of images){const img=document.createElement('img');img.src=src;img.style.cssText=`max-width:${100/images.length-2}%;max-height:96%;object-fit:contain`;img.animate([{transform:'scale(.97)',opacity:.2},{transform:'scale(1)',opacity:1},{transform:'scale(1.035)',opacity:1}],{duration:7000,fill:'forwards'});gallery.append(img);}el.append(gallery);document.body.append(el);el.showPopover();
 },{title,sub,images});await page.waitForTimeout(seconds*1000);await page.evaluate(()=>document.getElementById('v2-slide')?.remove());
}
try{
 await page.goto('http://localhost:4173/?tour=1',{waitUntil:'domcontentloaded'});await page.getByText('Connected',{exact:true}).waitFor({timeout:30000});await button('End tour').click();
 await button('Visit Dev').click();await page.locator('.profile-hero [data-head-state="ready"]').waitFor({timeout:90000});await close();await page.waitForTimeout(1500);
 start=await page.evaluate(()=>performance.now());report.startPerformanceMs=start;report.startWallMs=Date.now();
 await shot('The town',12,async()=>{await caption('Village — small wins, together','A living rectangular town, generated heads, outfits and a shared weekly story.');await page.mouse.move(1100,700);await page.mouse.down();for(let i=1;i<=70;i++){await page.mouse.move(1100+i*1.5,700);await page.waitForTimeout(35);}await page.mouse.up();await button('Reset camera').click();await page.waitForTimeout(1500);await still('01-town');});
 await shot('CV / LAM and expression',8,async()=>{await slide('From a photo to a talking head','SAM 3 → LAM → Audio2Expression · CV002: 18.6 s segment + 40.4 s head (RTX 5090)', ['cv002/dev_api_strip.png','cv002/sample_palm_strip.png'],7.5);});
 await shot('CV / stylized 3D heads',9,async()=>{await slide('Your photo, your village character','Photo → Gemini 2.5 Flash Image → Hunyuan3D-2mini → preset body · CV004: five-person cast, 451 s wall', ['cv004/contact_sheet.png'],8.5);});
 await shot('CV / samples and group segmentation',8,async()=>{await slide('SAM 3 finds the people in your group','CV003 head samples + actual CV005 group crops · Five people found; 24 s wall including cold model load', ['cv003/contact_sheet.png',`assets/villages/${vid}/group/${group}/person_2/full_body.png`],7.5);});
 await shot('CV / wearable and decoration',9,async()=>{await slide('Turn a photo into something you can wear','SAM 3 garment → swatch (0.9–1.0 s warm) · Gemini + Hunyuan3D prop: mug 76 s warm / 204 s cold', ['cv006/contact_sheet.png'],8.5);});
 await shot('Group photo onboarding',15,async()=>{await button('Village').click();await button('Our group photo').click();await caption('A village starts with your people','Explicit group consent. Open a finished SAM 3 job; each person claims only themselves.');await page.waitForTimeout(2200);await page.getByText('Open a shared photo job',{exact:true}).click();await page.getByLabel('Photo job ID',{exact:true}).fill(group);await button('Open photo').click();await page.locator('.crop-grid article').first().waitFor({timeout:8000});await page.locator('.crop-grid').scrollIntoViewIfNeeded();await page.waitForTimeout(1200);await still('02-group-crops');});
 await shot('Selfie consent',6,async()=>{await close();await button('My profile').click();await button('Customize my avatar').click();await page.getByLabel('Avatar photo',{exact:true}).scrollIntoViewIfNeeded();await caption('Your photo is optional','Single-selfie upload requires consent. A preset stays available while the GPU works.');});
 await shot('Voice consent',7,async()=>{await button('Settings').click();await page.locator('.settings-voice').scrollIntoViewIfNeeded();await caption('Your voice, only with consent','ElevenLabs cloning is explicitly opt-in. This take uploads no recordings.');await page.waitForTimeout(1000);await still('03-voice-consent');});
 await shot('LAM / Hear them',14,async()=>{await close();await button('Visit Dev').click();await page.locator('.profile-hero [data-head-state="ready"]').waitFor();await caption('A face behind every goal','Live LAM rendering + Hear them. The lip-sync indicator identifies the available expression mode.');if(live)await button('Hear them').click();await page.waitForTimeout(1600);await still('04-talking-head');});
 await shot('Check-in and evidence review',13,async()=>{await close();await page.getByRole('button',{name:/^Check in/}).click();await caption('Small steps, with evidence','Daily notes and progress can include a photo. Next: an existing suspicious review with held XP.');await page.waitForTimeout(2500);await close();await button('Visit Lance').click();await button('View evidence').first().click();await page.getByText('AI verdict: suspicious',{exact:true}).waitFor();await page.waitForTimeout(1000);await still('05-suspicious-evidence');});
 await shot('AI at work and Mayor memory',13,async()=>{await close();await button('AI at work').click();await page.locator('.mayor-memory article').first().waitFor();await caption('The Mayor remembers, and explains','Persistent memories, decision reasons and actual model provenance. AI advice leaves the human in charge.');await page.waitForTimeout(4000);await page.locator('.agent-log article').first().scrollIntoViewIfNeeded();await page.waitForTimeout(1500);await still('06-agent-memory');});
 await shot('Gazette',7,async()=>{await close();await button('Gazette').click();await caption('Your village, in print','A published issue brings check-ins, competitions, unlocks and gossip together.');await page.waitForTimeout(1500);await still('07-gazette');});
 await shot('Mayor prayer',14,async()=>{await close();await button('Mayor').click();await caption('One little wish','An explicit live Mayor request. The response keeps its real model label.');await page.getByLabel('Pray to the Mayor',{exact:true}).fill('For our demo village, give one short kind sentence encouraging everyone to finish their weekly goal.');if(live){await button('Send a little wish').click();await page.locator('.mayor-response').waitFor({timeout:18000});await page.locator('.mayor-response').scrollIntoViewIfNeeded();report.mayorText=await page.locator('.mayor-response').innerText();}});
 await shot('Bribe receipt',7,async()=>{await page.locator('.bribe-panel').scrollIntoViewIfNeeded();await caption('A wish with a receipt','Spend 1 demo XP. The receipt records the offer; an event outcome is never guaranteed.');await page.locator('#bribe-xp').fill('1');await page.getByLabel('Your wish',{exact:true}).fill('DEMO-002: a little encouragement for our seeded village.');if(live){await button('Offer XP').click();await page.locator('.bribe-receipt').waitFor();await page.locator('.bribe-receipt').scrollIntoViewIfNeeded();report.bribeText=await page.locator('.bribe-receipt').innerText();}await still('08-bribe-receipt');});
 await shot('Weekly grading',14,async()=>{await close();await page.getByLabel('Play as',{exact:true}).selectOption(uid(4));await button('Week').click();await caption('AI suggests. The auditor decides.','Maya sits out the prize. Load an advisory pre-grade; human grading remains explicit.');const card=page.getByRole('article',{name:"Iraj's weekly goal",exact:true});await card.waitFor();if(live){await card.getByRole('button',{name:'Load AI pre-grade',exact:true}).click();await card.locator('.ai-suggestion').waitFor({timeout:18000});await card.locator('.ai-suggestion').scrollIntoViewIfNeeded();}await still('09-week-grading');});
 await shot('Weekly crown',6,async()=>{await close();await button('Visit Stefanny').click();await caption('Celebrate the weekly winner','Stefanny holds last week’s crown. The current week awaits grades; this build has no ceremony replay.');});
 await shot('Compete / DEVNET wallet',12,async()=>{await close();await button('Compete').click();await button(/Study streak/).click();await caption('Friendly stakes, explicit approval','DEVNET wallet panel only. No wallet is connected and nothing is signed or broadcast.');await button('Join pot with wallet').click();await page.waitForTimeout(2500);report.walletText=await page.locator('.solana-pot').innerText();await still('10-devnet-wallet');});
 await shot('Wardrobe equip',12,async()=>{await close();await page.getByLabel('Play as',{exact:true}).selectOption(uid(1));await button('My profile').click();await page.getByRole('tab',{name:'Wardrobe',exact:true}).click();await caption('Make your villager your own','Owned outfits and accessories update the rotating 3D preview.');const remove=button('Unequip Round Glasses');await remove.scrollIntoViewIfNeeded();if(live){await remove.click();await button('Equip Round Glasses').click();await button('Unequip Round Glasses').waitFor();}await page.locator('.wardrobe-preview').scrollIntoViewIfNeeded();});
 await shot('Shop and photo rewards status',8,async()=>{await close();await button('Shop').click();await caption('Rewards for showing up','Shop equipment works. Photo-item token gates are not exposed in this preview; CV006 shows the real worker outputs.');});
 await shot('Inbox and poke controls',9,async()=>{await close();await button('Visit Lance').click();await caption('Stay close between check-ins','Poke and cheer controls, plus a shared Inbox. Existing conversations only in this review take.');await page.waitForTimeout(2300);await close();await button('Inbox').click();await page.getByRole('navigation',{name:'Conversations'}).getByRole('button',{name:/Lance/}).click();});
 await shot('Closing town',5,async()=>{await close();await caption('Village — a place to keep showing up','Sound is on. Day/fog is the live world state; night lighting has no control in this build.');});
}catch(e:any){report.failures.push('Capture: '+e.message);process.exitCode=1;}
finally{
 report.endPerformanceMs=await page.evaluate(()=>performance.now()).catch(()=>0);report.endWallMs=Date.now();report.budget=budget;
 await Promise.all(pending);for(const a of report.audio)delete a.base64;
 await context.close();report.rawVideo=await page.video()!.path();await browser.close();await writeFile(out+'/v2-capture.json',JSON.stringify(report,null,2));console.log(JSON.stringify({shots:report.shots.length,budget,failures:report.failures}));
}
