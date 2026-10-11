import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
const root=resolve(import.meta.dirname,'../..'),manifest=JSON.parse(readFileSync(`${root}/apps/web/public/sfx/manifest.json`,'utf8'));
const rows=[];
for(const entry of manifest.filter(e=>e.ambience))for(const ext of ['ogg','mp3']) {
 const path=`${root}/apps/web/public/sfx/${entry.name}.${ext}`;
 const r=spawnSync(ffmpeg,['-hide_banner','-i',path,'-af','loudnorm=I=-18:TP=-2:LRA=11:print_format=json','-f','null','-'],{encoding:'utf8'});
 if(r.status)throw Error(`${entry.name}: decode failure`);
 const measured=JSON.parse(r.stderr.slice(r.stderr.lastIndexOf('{'))),target=entry.name==='night_soft'?-22:entry.loop?-18:-14;
 if(Math.abs(Number(measured.input_i)-target)>.7)throw Error(`${entry.name}.${ext}: ${measured.input_i} LUFS, expected ${target}`);
 if(!r.stderr.includes('mono'))throw Error('Expected mono');
 const pcm=spawnSync(ffmpeg,['-v','error','-i',path,'-f','f32le','-ac','1','-ar','48000','-'],{maxBuffer:8*1024*1024});
 if(pcm.status)throw Error('PCM decode failed');
 const samples=new Float32Array(pcm.stdout.buffer,pcm.stdout.byteOffset,pcm.stdout.byteLength/4);
 const duration=samples.length/48000;
 if(Math.abs(duration-entry.duration_ms/1000)>.05)throw Error(`${entry.name}: duration mismatch`);
 let maxStep=0;for(let i=1;i<samples.length;i++)maxStep=Math.max(maxStep,Math.abs(samples[i]-samples[i-1]));
 const seamStep=Math.abs(samples[0]-samples.at(-1));
 if(entry.loop && seamStep>Math.max(.015,maxStep))throw Error(`${entry.name}: seam discontinuity exceeds internal transients`);
 if(Number(measured.input_tp)>0)throw Error(`${entry.name}: clipping risk`);
 rows.push({file:`${entry.name}.${ext}`,lufs:Number(measured.input_i),peak:Number(measured.input_tp),target,duration,seamStep,maxStep});
}
writeFileSync(`${root}/assets/audio/validation.json`,JSON.stringify(rows,null,2)+'\n');
console.log(`PASS: ${rows.length} encoded files decode, mono, loudness within 0.7 LUFS`);
