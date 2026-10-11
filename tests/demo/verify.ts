import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const output = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/submission/video/data/demo');
const capture = JSON.parse(await readFile(`${output}/capture.json`, 'utf8'));
const verification = JSON.parse(await readFile(`${output}/verification.json`, 'utf8'));
assert.equal(capture.shots.length, 9, 'All nine shots must complete');
assert.equal((await readdir(`${output}/stills`)).filter(name => name.endsWith('.png')).length, 6);
assert(capture.budget.voice <= 2 && capture.budget.prayer <= 2 && capture.budget.suggestion <= 1);
assert(capture.requests.every((r: any) => ['voice', 'suggestion', 'prayer'].includes(r.kind)));
assert(capture.failures.every((f: string) => /^HTTP 404: .*\/line_expr\.json$/.test(f)), 'Unexpected capture failure');
assert(capture.audio.length === 1 && capture.audio[0].duration > 0, 'Expected one actual speech track');
assert(capture.mayorText?.includes('THE AI MAYOR SAYS'), 'Live prayer response must exist');
for (const item of verification.outputs) {
  assert.equal(item.fullDecodeExit, 0);
  assert.equal(item.frames, 3800);
  assert.equal(item.resolution, '1920x1080');
  const data = await readFile(item.file);
  // These are our own FFmpeg outputs: MP4 version-0 movie header and WebM's
  // float64 Duration element with the standard 1 ms TimecodeScale.
  if (item.file.endsWith('.mp4')) {
    const at = data.indexOf(Buffer.from('mvhd'));
    assert(at > 0 && data[at + 4] === 0, 'Expected version-0 MP4 movie header');
    item.exactContainerSeconds = data.readUInt32BE(at + 20) / data.readUInt32BE(at + 16);
  } else {
    const at = data.subarray(0, 4096).indexOf(Buffer.from([0x44, 0x89, 0x88]));
    const scale = data.subarray(0, 4096).indexOf(Buffer.from([0x2a, 0xd7, 0xb1, 0x83]));
    assert(at > 0 && scale > 0 && data.readUIntBE(scale + 4, 3) === 1000000, 'Expected standard WebM time scale');
    item.exactContainerSeconds = data.readDoubleBE(at + 3) / 1000;
  }
  assert(item.exactContainerSeconds >= 150 && item.exactContainerSeconds <= 165);
}
await writeFile(`${output}/verification.json`, JSON.stringify(verification, null, 2));
console.log(JSON.stringify({ result: 'PASS', stills: 6, shots: 9, budget: capture.budget, durations: verification.outputs.map((item: any) => item.exactContainerSeconds), knownLimitation: 'Expression track 404; amplitude mouth motion used.' }, null, 2));
