import ffmpeg from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const output = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/submission/video/data/demo');
const capture = JSON.parse(await readFile(`${output}/capture.json`, 'utf8'));
async function run(args: string[], acceptFailure = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn(ffmpeg!, ['-hide_banner', '-nostdin', ...args], { windowsHide: true });
    let log = '';
    process.stderr.on('data', chunk => log += chunk);
    process.stdout.on('data', chunk => log += chunk);
    process.on('error', reject);
    process.on('close', code => code === 0 || acceptFailure ? resolve(log) : reject(new Error(log.slice(-3000))));
  });
}
function duration(log: string) {
  const match = log.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  if (!match) throw new Error('FFmpeg did not report a duration');
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}
const rawDuration = duration(await run(['-i', capture.rawVideo], true));
const storyDuration = (capture.endPerformanceMs - capture.startPerformanceMs) / 1000;
if (!Number.isFinite(storyDuration) || storyDuration < 145 || storyDuration > 165) throw new Error(`Capture is outside the 145–165 second envelope: ${storyDuration}`);
const trimStart = Math.max(0, rawDuration - storyDuration);
const target = Math.min(152, storyDuration);
const audio = capture.audio[0];
const input = ['-y', '-ss', trimStart.toFixed(3), '-i', capture.rawVideo];
if (audio) input.push('-i', `${output}/${audio.file}`);
else input.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
const filter = audio ? `adelay=${Math.max(0, Math.round(audio.startMs))}:all=1,apad` : 'apad';
console.log(`Exporting ${target.toFixed(3)} seconds; trimming ${trimStart.toFixed(3)} seconds of warm-up; synthetic voice: ${!!audio}`);
await run([...input, '-map', '0:v:0', '-map', '1:a:0', '-af', filter, '-t', target.toFixed(3), '-r', '25', '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', `${output}/village_demo_draft.mp4`]);
console.log('MP4 complete; encoding WebM');
await run(['-y', '-i', `${output}/village_demo_draft.mp4`, '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '6', '-row-mt', '1', '-threads', '8', '-crf', '32', '-b:v', '0', '-c:a', 'libopus', `${output}/village_demo_draft.webm`]);
await mkdir(`${output}/qa`, { recursive: true });
await run(['-y', '-i', `${output}/village_demo_draft.mp4`, '-vf', 'fps=1/5,scale=640:360,tile=4x8', '-frames:v', '1', `${output}/qa/contact-sheet.jpg`]);
const verification: any = { targetSeconds: target, rawSeconds: rawDuration, trimStartSeconds: trimStart, audio, outputs: [] };
for (const ext of ['mp4', 'webm']) {
  const file = `${output}/village_demo_draft.${ext}`;
  const decode = await run(['-i', file, '-progress', 'pipe:1', '-f', 'null', '-']);
  const seconds = duration(decode);
  if (seconds > 165 || !decode.includes('1920x1080') || !decode.includes('Audio:')) throw new Error(`Invalid export: ${ext}`);
  const frames = [...decode.matchAll(/^frame=(\d+)$/gm)].at(-1)?.[1];
  verification.outputs.push({ file, durationSeconds: seconds, frames: Number(frames), resolution: '1920x1080', fullDecodeExit: 0 });
}
await writeFile(`${output}/verification.json`, JSON.stringify(verification, null, 2));
console.log(JSON.stringify(verification, null, 2));
