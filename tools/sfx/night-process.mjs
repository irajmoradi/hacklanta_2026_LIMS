// Offline AUDIO-002 mastering and exact 20-second A/B; never calls an API.
import {readFileSync,writeFileSync,copyFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
const root=resolve(import.meta.dirname,'../..'),out=`${root}/assets/audio`,dest=`${root}/apps/web/public/sfx`;
mkdirSync(`${out}/raw`,{recursive:true});
const run=args=>{
 const r=spawnSync(ffmpeg,['-hide_banner','-y',...args],{encoding:'utf8'});
 if(r.status)throw Error(r.stderr);return r.stderr;
};
const loudness=path=>{
 const text=run(['-i',path,'-af','loudnorm=I=-22:TP=-2:LRA=11:print_format=json','-f','null','-']);
 return JSON.parse(text.slice(text.lastIndexOf('{')));
};
const baseline=`${out}/AUDIO-002-before.ogg`,source=`${out}/AUDIO-002-source.mp3`;
if(!existsSync(baseline))copyFileSync(`${dest}/night_soft.ogg`,baseline);
if(!existsSync(source))copyFileSync(`${out}/raw/AUDIO-002-take-4.mp3`,source);
// Rotate into a two-second equal-power overlap, retaining a continuous 20s loop.
const wav=`${out}/raw/AUDIO-002-master.wav`;
run(['-i',source,'-filter_complex','[0:a]asplit=3[a][b][c];[a]atrim=2:20,asetpts=PTS-STARTPTS[mid];[b]atrim=20:22,asetpts=PTS-STARTPTS,afade=t=out:st=0:d=2:curve=qsin[tail];[c]atrim=0:2,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=2:curve=qsin[head];[tail][head]amix=inputs=2:normalize=0[seam];[mid][seam]concat=n=2:v=0:a=1[out]','-map','[out]','-ar','48000','-ac','1',wav]);
const measured=loudness(wav);
const norm=`loudnorm=I=-22:TP=-2:LRA=11:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`;
for(const ext of ['ogg','mp3']) {
 let correction=0;
 for(let pass=0;pass<3;pass++) {
  const path=`${dest}/night_soft.${ext}`;
  run(['-i',wav,'-af',`${norm},volume=${correction}dB`,'-ar','48000','-ac','1','-c:a',ext==='ogg'?'libvorbis':'libmp3lame','-b:a','96k',path]);
  const result=loudness(path);
  if(Math.abs(Number(result.input_i)+22)<.15)break;
  correction+=-22-Number(result.input_i);
 }
}
const manifest=JSON.parse(readFileSync(`${dest}/manifest.json`,'utf8'));
manifest.find(e=>e.name==='night_soft').description='Sparse distinct summer-night cricket chirps with quiet gaps; AUDIO-002 take 4, mastered to -22 LUFS, seamless 20-second loop.';
writeFileSync(`${dest}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
// 0-10s = previous night; 10-20s = new night, including its four-second dusk ramp.
// Preserve the real 4 LU difference; do not normalize the two halves independently.
run(['-i',baseline,'-i',`${dest}/night_soft.ogg`,'-filter_complex','[0:a]atrim=0:10,asetpts=PTS-STARTPTS[a];[1:a]atrim=0:10,asetpts=PTS-STARTPTS,afade=t=in:d=4[b];[a][b]concat=n=2:v=0:a=1[out]','-map','[out]','-c:a','libvorbis','-b:a','128k',`${out}/AUDIO-002-ab.ogg`]);
const paths=[baseline,...[1,3,4].map(i=>`${out}/raw/AUDIO-002-take-${i}.mp3`).filter(existsSync),`${dest}/night_soft.ogg`,`${dest}/night_soft.mp3`];
const r=spawnSync('python',[`${root}/tools/sfx/night-metrics.py`,ffmpeg,...paths],{encoding:'utf8'});
if(r.status)throw Error(r.stderr);
const metrics=JSON.parse(r.stdout).map((entry,i)=>({...entry,lufs:Number(loudness(paths[i]).input_i)}));
writeFileSync(`${out}/AUDIO-002-metrics.json`,JSON.stringify(metrics,null,2)+'\n');
const selected=metrics.find(e=>e.file==='night_soft.ogg');
if(selected.flatness_mean>=.3 || selected.chirp_band_contrast_db<8 || selected.chirp_phrases<5)throw Error('Selected asset failed spectral/chirp QA');
console.log(JSON.stringify(selected,null,2));
