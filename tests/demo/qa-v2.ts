import {spawnSync} from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import {writeFile} from 'node:fs/promises';
const out='docs/submission/video/data/demo';
const results=[];
for(const name of ['v2-audio-1.audio','v2-original-full.mp4','village_demo_v2_full.mp4','village_demo_v2_judges.mp4']){
 const p=spawnSync(ffmpeg!,['-hide_banner','-i',out+'/'+name,'-af','volumedetect','-vn','-f','null','-'],{encoding:'utf8',windowsHide:true});
 const volume=p.stderr.match(/max_volume: ([-\d.]+) dB/);
 results.push({name,exit:p.status,maxDb:volume?Number(volume[1]):null});
}
await writeFile(out+'/v2_qa/audio-check.json',JSON.stringify(results,null,2));console.log(results);
if(results.some(r=>r.exit!==0||r.maxDb===null||r.maxDb < -70))process.exitCode=1;
