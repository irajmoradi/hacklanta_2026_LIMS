"""Assemble recorded shots using rendered markers, then validate the silent cut."""
import json
from pathlib import Path
import subprocess
import sys

folder = Path(sys.argv[1] if len(sys.argv) > 1 else 'ops/demo/artifacts').resolve()
capture = json.loads((folder / 'full-capture.json').read_text())
assert not capture['rehearsal'] and not capture['errors'] and not capture['blocked']
assert len(capture['shots']) == 9 and capture['shots'][-1]['end'] == 150
raw = folder / 'raw' / capture['raw']
assert raw.parent == folder / 'raw' and raw.is_file()

def ffmpeg(*args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *map(str, args)], check=True)

palette = [tuple(bytes.fromhex(color[1:])) for color in capture['markerColors']]
pixels = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(raw), '-vf',
    'fps=25,crop=8:8:8:1068,scale=1:1:flags=area', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
starts = []
stable = 0
for frame in range(len(pixels) // 3):
    if len(starts) == len(palette):
        break
    pixel = pixels[frame * 3:frame * 3 + 3]
    distance = sum((a-b)**2 for a, b in zip(pixel, palette[len(starts)]))
    stable = stable + 1 if distance < 60**2 else 0
    if stable == 3:
        starts.append(frame - 2)
        stable = 0
assert len(starts) == 9, f'Only found {len(starts)} rendered shot markers: {starts}'
ends = starts[1:] + [len(pixels) // 3]
filters = ['[0:v]fps=25,split=9' + ''.join(f'[in{i}]' for i in range(9))]
assembly = []
for i, (start, end, shot) in enumerate(zip(starts, ends, capture['shots'])):
    assert end - start >= 25
    duration = shot['end'] - shot['start']
    filters.append(f'[in{i}]trim=start_frame={start}:end_frame={end},setpts=PTS-STARTPTS,'
        f'tpad=stop_mode=clone:stop_duration={duration},trim=duration={duration},setpts=PTS-STARTPTS[s{i}]')
    assembly.append(dict(start=shot['start'], end=shot['end'], source_start_frame=start,
        source_end_frame=end, source_seconds=(end-start)/25))
filters.append(''.join(f'[s{i}]' for i in range(9)) +
    'concat=n=9:v=1:a=0,crop=1920:1064:0:0,pad=1920:1080:0:0:color=0x102b2b[v]')
ffmpeg('-i', raw, '-filter_complex', ';'.join(filters), '-map', '[v]', '-an', '-r', 25,
    '-frames:v', 3750, '-c:v', 'libx264', '-preset', 'fast', '-crf', 22, '-threads', 4,
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', folder / 'village-demo-v3.mp4')
ffmpeg('-i', folder / 'village-demo-v3.mp4', '-an', '-c:v', 'libvpx-vp9', '-b:v', '1800k',
    '-minrate', '1800k', '-maxrate', '1800k', '-bufsize', '3600k', '-deadline', 'realtime',
    '-cpu-used', 6, '-threads', 4, folder / 'village-demo-v3.webm')
ffmpeg('-i', folder / 'village-demo-v3.mp4', '-t', 10, '-an', '-vf',
    'fade=t=in:st=0:d=0.4,fade=t=out:st=9.6:d=0.4', '-c:v', 'libx264', '-crf', 23,
    '-movflags', '+faststart', folder / 'village-highlight-10s.mp4')
(folder / 'assembly.json').write_text(json.dumps(assembly, indent=2) + '\n')
subprocess.run([sys.executable, str(Path(__file__).with_name('verify.py')), str(folder)], check=True)
