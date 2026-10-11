import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {mkdirSync, existsSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const mode = process.argv[2] ?? 'all';
if (!['stills', 'pipeline', 'all', 'square'].includes(mode)) throw new Error('Use stills, pipeline, all or square');
const output = resolve('artifacts');
mkdirSync(output, {recursive: true});
let browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE;
const browserRoot = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/playwright';
if (!browserExecutable && existsSync(browserRoot)) {
  const browser = readdirSync(browserRoot).filter(p => p.startsWith('chromium-')).sort().at(-1);
  if (browser) {
    for (const sub of ['chrome-linux/chrome', 'chrome-linux64/chrome']) {
      const path = `${browserRoot}/${browser}/${sub}`;
      if (existsSync(path)) browserExecutable = path;
    }
  }
}
for (const name of ['town','checkin','goals','colosseum','growth','growth-unlock','disaster-repair','shelter','pets','synced-walking','object-turntable','object-room','house-sync','hall-decor','mayor','routines','competition','gazette','head-detail','walking']) {
  if (!existsSync(resolve(`public/captures/${name}.mp4`))) throw new Error(`Missing fresh capture: ${name}. Run capture.mjs and prepare-clips.py.`);
}
const serveUrl = await bundle({entryPoint: resolve('src/index.tsx'), publicDir: resolve('public')});
const options = {serveUrl, browserExecutable, chromiumOptions: {disableWebSecurity: false}};
for (const [id, file] of [['VillageTrailer', 'village-trailer-v4'], ['VillageSquare', 'village-trailer-v4-square']]) {
  if (mode === 'square' && id !== 'VillageSquare') continue;
  const composition = await selectComposition({...options, id});
  const seconds = mode === 'pipeline' ? [] : id === 'VillageTrailer' ? [2,4,17,35,43,51,58,64,70,78,88,92] : [.5,1.5,7,15,18,21,24,27,30,34,36,38];
  for (const [i, second] of seconds.entries()) {
    await renderStill({...options, composition, frame: second * 60, output: `${output}/${file}-frame-${i + 1}.png`});
  }
  if (mode === 'stills' || mode === 'pipeline') for (const [label,second] of (id === 'VillageTrailer' ? [['photo',6.8],['mask',8.2],['traits',11],['splat',17],['villager',13],['waveform',23],['voice',29]] : [['photo',2.3],['mask',3],['traits',4.5],['splat',7],['villager',5.5],['waveform',9.5],['voice',12]])) {
    await renderStill({...options,composition,frame:Math.round(Number(second)*60),output:`${output}/${file}-pipeline-${label}.png`});
  }
  if (id === 'VillageTrailer' && mode !== 'pipeline') await renderStill({...options, composition, frame: 5520, output: `${output}/village-trailer-v4-poster.png`});
  if (mode !== 'stills' && mode !== 'pipeline') {
    let last = -1;
    await renderMedia({...options, composition, codec: 'h264', pixelFormat: 'yuv420p', audioCodec: 'aac', audioBitrate: '128k', videoBitrate: id === 'VillageTrailer' ? '5M' : '3500k', x264Preset: 'fast', concurrency: 6, outputLocation: `${output}/${file}.mp4`, onProgress: ({progress}) => {
      const percent = Math.floor(progress * 10) * 10;
      if (percent !== last) {console.log(`${id}: ${percent}%`); last = percent;}
    }});
  }
}
if (mode === 'all') execFileSync('ffmpeg', ['-v','error','-y','-i',`${output}/village-trailer-v4.mp4`,'-c:v','libx264','-preset','slow','-b:v','1850k','-maxrate','1950k','-bufsize','3900k','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',`${output}/village-trailer-v4-discord.mp4`],{stdio:'inherit'});
