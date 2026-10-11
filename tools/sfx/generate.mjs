import {readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
const root=resolve(import.meta.dirname,'../..'), out=resolve(root,'assets/audio'), dest=resolve(root,'apps/web/public/sfx');
mkdirSync(`${out}/raw`,{recursive:true});
const prompts={
 day_birds_breeze:'Soft sparse songbirds in a peaceful village garden, light breeze rustling leaves. NO cicadas, no insects, no music, no speech. Gentle spacious natural ambience.',
 village_life_distant:'Very faint distant village chatter, unintelligible voices far away, one far-off bicycle bell, gentle quiet cozy afternoon, no close voices, no music.',
 fountain_trickle:'Small stone plaza fountain, gentle clear trickling water, soft delicate droplets, relaxing, no loud splashes, no voices, no music.',
 creek_babble:'Small shallow creek in a leafy park, soft warm babbling water flowing over smooth stones, calm quiet natural ambience, no birds or voices.',
 night_soft:'Warm calm quiet countryside night, very sparse distant soft cricket chirps with long quiet gaps, occasional distant soft owl. NO cicadas, no harsh continuous insect buzzing, no music.',
 rain_soft:'Soft steady light rain on garden leaves, warm gentle pattering, no thunder, no heavy downpour, no music.',
 wind_gust_light:'Very light gentle breeze softly swelling through leafy trees, quiet warm air, no howling, no rumble, no voices, no music.',
 arena_crowd_murmur:'Warm distant small friendly crowd murmuring quietly in an outdoor arena, unintelligible low conversation, no roaring, no cheering, no shouting, no music.',
 market_bustle_light:'Quiet small village market far away, gentle indistinct conversation, soft footsteps and light wooden stall sounds, warm and peaceful, no shouting, no music.',
 bird_chirp_1:'One small songbird gives two soft clear chirps in a quiet garden. Isolated short natural sound, quiet background, no music.',
 bird_chirp_2:'One distant robin sings a brief gentle three-note phrase. Isolated short natural sound, quiet background, no music.',
 distant_dog:'One friendly dog gives a single soft bark far away across a quiet village, distant and mellow, no aggressive growling, no music.'
};
const ledger=`${out}/generation-ledger.json`, log=`${out}/AUDIO-001-log.md`;
let records=existsSync(ledger)?JSON.parse(readFileSync(ledger,'utf8')):[];
const save=()=>{writeFileSync(ledger,JSON.stringify(records,null,2)+'\n');writeFileSync(log,'# AUDIO-001 generation log\n\nOwner-authorized batch; hard cap 14 requests, no automatic retries. Model: eleven_text_to_sound_v2. Secrets loaded only at runtime.\n\n'+records.map(r=>`- ${r.name}: ${r.duration}s; ${r.status}; billed credits: ${r.credits??'unknown'}. Prompt: ${r.prompt}`).join('\n')+`\n\nRequests: ${records.length}; known billed credits: ${records.reduce((n,r)=>n+(Number(r.credits)||0),0)}. Dollar cost is plan-dependent and is not returned by the API.\n`);};
if(process.argv.includes('--generate')) {
 const envPath=(process.env.VILLAGE_ENV_FILE??'C:/Users/mourn/Downloads/hacklanta/.env').replace(/^\/([a-z])\//i,'$1:/');
 const key=process.env.ELEVENLABS_API_KEY??parseEnv(readFileSync(envPath,'utf8')).ELEVENLABS_API_KEY;
 if(!key) throw Error('ELEVENLABS_API_KEY unavailable');
 for(const [name,description] of Object.entries(prompts)) {
  if(records.some(r=>r.name===name)) continue;
  if(records.length>=14) throw Error('Generation cap reached');
  const loop=!/bird_chirp|distant_dog/.test(name), duration=loop?22:3;
  const prompt=description+(loop?' Seamless continuous ambience loop with consistent texture, no intro or ending.':'');
  const record={name,duration,prompt,status:'attempted'};records.push(record);save();
  const response=await fetch('https://api.elevenlabs.io/v1/sound-generation',{method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({text:prompt,duration_seconds:duration,loop,model_id:'eleven_text_to_sound_v2',prompt_influence:.45}),signal:AbortSignal.timeout(180000)});
  record.credits=response.headers.get('character-cost'); record.status=`HTTP ${response.status}`;save();
  if(!response.ok) throw Error(`Generation failed (${response.status}); no retry`);
  writeFileSync(`${out}/raw/${name}.mp3`,Buffer.from(await response.arrayBuffer()));record.status='complete';save();console.log(`${name}: complete, credits=${record.credits}`);
 }
}
if(process.argv.includes('--process')) {
 const run=args=>{const r=spawnSync(ffmpeg,['-hide_banner','-y',...args],{encoding:'utf8'});if(r.status)throw Error(r.stderr);return r.stderr;};
 let manifest=JSON.parse(readFileSync(`${dest}/manifest.json`,'utf8')).filter(e=>e.name==='night_soft'||!['night_crickets_loop',...Object.keys(prompts)].includes(e.name));
 for(const [name,description] of Object.entries(prompts)) {
  // AUDIO-002 owns the replacement night asset and its -22 LUFS mastering.
  if(name==='night_soft')continue;
  const loop=!/bird_chirp|distant_dog/.test(name), target=loop?-18:-14, input=`${out}/raw/${name}.mp3`, wav=`${out}/raw/${name}.wav`;
  // Rotate the seam into a 2s equal-power tail/head overlap: middle + blended seam.
  const filter=loop?'[0:a]asplit=3[a][b][c];[a]atrim=2:20,asetpts=PTS-STARTPTS[mid];[b]atrim=20:22,asetpts=PTS-STARTPTS,afade=t=out:st=0:d=2:curve=qsin[tail];[c]atrim=0:2,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=2:curve=qsin[head];[tail][head]amix=inputs=2:normalize=0[seam];[mid][seam]concat=n=2:v=0:a=1[out]':'[0:a]afade=t=in:d=0.02,afade=t=out:st=2.8:d=0.2[out]';
  run(['-i',input,'-filter_complex',filter,'-map','[out]','-ac','1','-ar','48000',wav]);
  const analysis=run(['-i',wav,'-af',`loudnorm=I=${target}:TP=-2:LRA=11:print_format=json`,'-f','null','-']);
  const m=JSON.parse(analysis.slice(analysis.lastIndexOf('{')));
  const norm=`loudnorm=I=${target}:TP=-2:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  for(const ext of ['ogg','mp3']) {
   let correction=0;
   for(let pass=0;pass<3;pass++) {
    run(['-i',wav,'-af',`${norm},volume=${correction}dB`,'-ar','48000','-ac','1','-c:a',ext==='ogg'?'libvorbis':'libmp3lame','-b:a','96k',`${dest}/${name}.${ext}`]);
    const check=run(['-i',`${dest}/${name}.${ext}`,'-af',`loudnorm=I=${target}:TP=-2:LRA=11:print_format=json`,'-f','null','-']);
    const measured=JSON.parse(check.slice(check.lastIndexOf('{')));
    if(Math.abs(Number(measured.input_i)-target)<.15)break;
    correction+=target-Number(measured.input_i);
   }
  }
  manifest.push({name,file:`/sfx/${name}.ogg`,fallback:`/sfx/${name}.mp3`,duration_ms:loop?20000:3000,loop,volume:1,ambience:true,description});
 }
 writeFileSync(`${dest}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
}
