// Explicit, owner-authorized AUDIO-002 generation only. One request per invocation.
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseEnv} from 'node:util';
const out=resolve(import.meta.dirname,'../../assets/audio');
const ledger=`${out}/AUDIO-002-ledger.json`, log=`${out}/AUDIO-002-log.md`;
if(!process.argv.includes('--generate')) throw Error('Requires explicit --generate; may incur API charges');
const records=existsSync(ledger)?JSON.parse(readFileSync(ledger,'utf8')):[];
if(records.length>=4) throw Error('AUDIO-002 hard cap of four attempts reached');
const envPath=(process.env.VILLAGE_ENV_FILE??'C:/Users/mourn/Downloads/hacklanta/.env').replace(/^\/([a-z])\//i,'$1:/');
const key=process.env.ELEVENLABS_API_KEY??parseEnv(readFileSync(envPath,'utf8')).ELEVENLABS_API_KEY;
if(!key) throw Error('ELEVENLABS_API_KEY unavailable');
const prompt='Quiet summer night in a small village, a few distinct crickets chirping slowly at different distances, soft distant frogs, very gentle warm breeze, no hiss, no white noise, calm and sparse, seamless loop. Clear individual tonal cricket chirps with quiet gaps; irregular overlapping short phrases, not rhythmic spraying water. No speech, music, rain, sprinklers, or continuous buzzing.';
const text=records.length===3 ? 'One solitary cricket chirping softly in a silent summer village at night. Short bright tonal chirp chirp, then two seconds of silence, then another short chirp phrase slightly farther away. Clear 4 to 5 kHz ringing insect pulses with irregular timing. Very sparse, peaceful and dry. Only individual cricket calls. No continuous buzzing, background hiss, white noise, water, speech or music. Seamless loop.' : records.length ? 'Quiet summer village night. Two solitary field crickets trade short pure ringing chirps slowly at irregular intervals, one near and one distant. Several seconds of near silence between calls. Soft distant frogs, barely perceptible warm breeze. No hiss, white noise, continuous insect chorus, water, music or speech. Dry clean recording, calm and extremely sparse. Seamless loop.' : prompt;
const record={take:records.length+1,prompt:text,duration_seconds:22,model_id:'eleven_text_to_sound_v2',status:'attempted',credits:null};
records.push(record);
const save=()=>{
 writeFileSync(ledger,JSON.stringify(records,null,2)+'\n');
 writeFileSync(log,'# AUDIO-002 generation log\n\nExplicit task-authorized requests. Hard cap: 4; no automatic retries. Secrets read only at runtime from VILLAGE_ENV_FILE or environment.\n\n'+records.map(r=>`- Take ${r.take}: ${r.status}; ${r.duration_seconds}s; model ${r.model_id}; billed credits ${r.credits??'unknown'}. Prompt: ${r.prompt}`).join('\n')+`\n\nGeneration attempts: ${records.length}/4. Known billed credits: ${records.reduce((sum,r)=>sum+Number(r.credits??0),0)}. Dollar cost is plan-dependent. Selection and measurements: AUDIO-002-REPORT.md and AUDIO-002-metrics.json.\n`);
};
save();mkdirSync(`${out}/raw`,{recursive:true});
try {
 const response=await fetch('https://api.elevenlabs.io/v1/sound-generation',{method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({text,duration_seconds:22,loop:true,model_id:record.model_id,prompt_influence:.65}),signal:AbortSignal.timeout(180000)});
 record.credits=response.headers.get('character-cost');record.status=`HTTP ${response.status}`;save();
 if(!response.ok) throw Error(`Generation failed (HTTP ${response.status}); no retry`);
 writeFileSync(`${out}/raw/AUDIO-002-take-${record.take}.mp3`,Buffer.from(await response.arrayBuffer()));
 record.status='complete';save();console.log(`Take ${record.take} complete; credits=${record.credits}`);
} catch {
 if(record.status==='attempted')record.status='transport failure (possibly billed)';
 save();throw Error(`Take ${record.take}: ${record.status}; no automatic retry`);
}
