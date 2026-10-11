import ffmpeg from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const out=resolve(dirname(fileURLToPath(import.meta.url)),'../../docs/submission/video/data/demo');
const capture=JSON.parse(await readFile(out+'/v2-capture.json','utf8'));
async function run(args:string[],probe=false):Promise<string>{return new Promise((resolve,reject)=>{const p=spawn(ffmpeg!,['-hide_banner','-nostdin',...args],{windowsHide:true});let log='';p.stderr.on('data',c=>log+=c);p.stdout.on('data',c=>log+=c);p.on('error',reject);p.on('close',code=>code===0||probe?resolve(log):reject(new Error(log.slice(-3500))));});}
function duration(log:string){const m=log.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);if(!m)throw new Error('No media duration');return +m[1]*3600 + +m[2]*60 + +m[3];}
const story=(capture.endPerformanceMs-capture.startPerformanceMs)/1000;
if(story<180||story>260||capture.shots.length!==21)throw new Error(`Invalid take: ${story}s, ${capture.shots.length} chapters`);
const raw=duration(await run(['-i',capture.rawVideo],true));
const warmup=Math.max(0,raw-story), target=Math.min(story,209), speed=story/target;
const input=['-y','-ss',warmup.toFixed(4),'-i',capture.rawVideo];
const filters:string[]=[];const tracks:string[]=[];
for(const a of capture.audio){
 const begin=(a.time-capture.startPerformanceMs)/1000;
 const finish=Math.min(story, a.endMs ? (a.endMs-capture.startPerformanceMs)/1000 : a.loop?story:begin+a.duration-a.offset);
 const length=finish-Math.max(0,begin);if(length<=0||!Number.isFinite(length))continue;
 const idx=tracks.length+1;if(a.loop)input.push('-stream_loop','-1');input.push('-i',out+'/'+a.file);
 const offset=Math.max(0,-begin)+a.offset;
 filters.push(`[${idx}:a]atrim=start=${offset}:duration=${length},aresample=48000,asetpts=N/SR/TB,volume=${a.volume},adelay=${Math.round(Math.max(0,begin)*1000)}:all=1[a${idx}]`);tracks.push(`[a${idx}]`);
}
if(!tracks.length){input.push('-f','lavfi','-i','anullsrc=r=48000:cl=stereo');filters.push('[1:a]anull[mixed]');}
else filters.push(tracks.join('')+`amix=inputs=${tracks.length}:normalize=0:duration=longest[mixed]`);
// Normalize sample-based timestamps before padding. Mixed MP3 time bases otherwise
// produced a silent bounded mux on the installed FFmpeg build.
filters.push(`[mixed]asetpts=N/SR/TB,apad=whole_dur=${story},atrim=duration=${story},atempo=${speed}[audio]`);
filters.push(`[0:v]setpts=(PTS-STARTPTS)/${speed}[video]`);
const full=out+'/village_demo_v2_full.mp4', judges=out+'/village_demo_v2_judges.mp4';
const original=out+'/v2-original-full.mp4';
console.log(`Full cut: ${target.toFixed(3)}s, ${tracks.length} real playback clips, speed ${speed.toFixed(4)}`);
await run([...input,'-filter_complex',filters.join(';'),'-map','[video]','-map','[audio]','-t',target.toFixed(4),'-r','25','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',original]);
const pickups=await Promise.all(['v2-pickup.json','v2-wardrobe-pickup.json'].map(async f=>JSON.parse(await readFile(out+'/'+f,'utf8'))));
const swap:string[]=[], swapInputs=['-y','-i',original];let previous=0,part=0;
for(const [i,pickup] of pickups.entries()){
 const replaced=capture.shots.find((s:any)=>s.name===pickup.replaces);
 const left=replaced.startSeconds/speed,right=replaced.endSeconds/speed,length=right-left;
 const pickupRaw=duration(await run(['-i',pickup.rawVideo],true));
 swapInputs.push('-ss',Math.max(0,pickupRaw-pickup.storySeconds).toFixed(4),'-i',pickup.rawVideo);
 swap.push(`[0:v]trim=start=${previous}:end=${left},setpts=PTS-STARTPTS[v${part}]`,`[0:a]atrim=start=${previous}:end=${left},asetpts=PTS-STARTPTS[a${part}]`);part++;
 swap.push(`[${i+1}:v]trim=duration=${pickup.storySeconds},setpts=(PTS-STARTPTS)*${length/pickup.storySeconds}[v${part}]`,`anullsrc=r=48000:cl=stereo,atrim=duration=${length}[a${part}]`);part++;previous=right;
}
swap.push(`[0:v]trim=start=${previous},setpts=PTS-STARTPTS[v${part}]`,`[0:a]atrim=start=${previous},asetpts=PTS-STARTPTS[a${part}]`);part++;
swap.push(Array.from({length:part},(_,i)=>`[v${i}][a${i}]`).join('')+`concat=n=${part}:v=1:a=1[v][a]`);
await run([...swapInputs,'-filter_complex',swap.join(';'),'-map','[v]','-map','[a]','-t',target.toFixed(4),'-r','25','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',full]);
// Each chapter retains its settled view. Speech keeps its beginning to preserve lip-sync.
// Cuts (rather than accelerated speech) shorten the judges edition to precisely 150s.
const totalWeight=capture.shots.reduce((n:number,s:any)=>n+s.plannedSeconds,0);
let editTime=0;
const chapters=capture.shots.map((s:any,i:number)=>{
 const allotted=s.plannedSeconds/totalWeight*150;
 const first=s.startSeconds/speed,last=s.endSeconds/speed;
 const from=s.name==='LAM / Hear them'?first:Math.max(first,last-allotted-.15);
 const result={name:s.name,fullStart:first,fullEnd:last,judgesStart:editTime,judgesDuration:allotted,sourceStart:from};editTime+=allotted;return result;
});
const edits:string[]=[];
chapters.forEach((c:any,i:number)=>{edits.push(`[0:v]trim=start=${c.sourceStart}:duration=${c.judgesDuration},setpts=PTS-STARTPTS[v${i}]`);edits.push(`[0:a]atrim=start=${c.sourceStart}:duration=${c.judgesDuration},asetpts=PTS-STARTPTS[a${i}]`);});
edits.push(chapters.map((_:any,i:number)=>`[v${i}][a${i}]`).join('')+`concat=n=${chapters.length}:v=1:a=1[v][a]`);
console.log('Encoding 2:30 judges edit');
await run(['-y','-i',full,'-filter_complex',edits.join(';'),'-map','[v]','-map','[a]','-t','150','-r','25','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',judges]);
await mkdir(out+'/v2_qa',{recursive:true});
for(const [name,path] of [['full',full],['judges',judges]])await run(['-y','-i',path,'-vf','fps=1/5,scale=480:270,tile=5x9','-frames:v','1',out+`/v2_qa/${name}-contact.jpg`]);
const verification:any={rawSeconds:raw,storySeconds:story,warmupSeconds:warmup,speed,chapters,pickups,audioClips:tracks.length,outputs:[]};
for(const file of [full,judges]){
 const log=await run(['-i',file,'-progress','pipe:1','-f','null','-']);const seconds=duration(log);
 if(!log.includes('1920x1080')||!log.includes('Audio: aac'))throw new Error('Wrong output format');
 verification.outputs.push({file,durationSeconds:seconds,frames:Number([...log.matchAll(/^frame=(\d+)$/gm)].at(-1)?.[1]),resolution:'1920x1080',decodeExit:0});
 const audioLog=await run(['-i',file,'-af','volumedetect','-vn','-f','null','-']);
 const peak=Number(audioLog.match(/max_volume: ([-\d.]+) dB/)?.[1]);
 if(!Number.isFinite(peak)||peak < -70)throw new Error(`Silent audio in ${file}`);
 verification.outputs.at(-1).audioPeakDb=peak;
}
await writeFile(out+'/v2-verification.json',JSON.stringify(verification,null,2));
console.log(JSON.stringify(verification,null,2));
