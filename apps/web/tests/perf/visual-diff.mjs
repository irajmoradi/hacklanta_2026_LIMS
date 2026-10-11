import {readFileSync,writeFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';
const root=process.env.PERF_VISUAL_DIR || `artifacts/perf002/visual${process.env.PERF_VISUAL_PROFILE==='1'?'-profile':''}`;
const a=PNG.sync.read(readFileSync(`${root}/direct.png`));
const b=PNG.sync.read(readFileSync(`${root}/composed.png`));
if(a.width!==b.width || a.height!==b.height) throw new Error('Image dimensions differ');
const diff=new PNG({width:a.width,height:a.height});
// Standard pixelmatch perceptual tolerance; include AA pixels instead of masking them.
const changed=pixelmatch(a.data,b.data,diff.data,a.width,a.height,{threshold:.1,includeAA:true});
let absolute=0,over8=0;
for(let i=0;i<a.data.length;i+=4) {
  const channels=[0,1,2].map(c=>Math.abs(a.data[i+c]-b.data[i+c]));
  absolute+=channels.reduce((s,v)=>s+v,0);if(Math.max(...channels)>8)over8++;
}
const result={threshold:.1,includeAA:true,changedPixels:changed,differencePercent:changed/(a.width*a.height)*100,
  rawOver8Percent:over8/(a.width*a.height)*100,meanAbsoluteChannelDifferencePercent:absolute/(a.width*a.height*3*255)*100};
writeFileSync(`${root}/diff.png`,PNG.sync.write(diff));
writeFileSync(`${root}/comparison.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(result.differencePercent>1)process.exitCode=1;
