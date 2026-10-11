"""Probe and decode the deliverables; make a contact sheet for human visual review."""
import json
from pathlib import Path
import subprocess
import sys

folder = Path(sys.argv[1] if len(sys.argv) > 1 else 'ops/demo/artifacts').resolve()
results = []
for name, seconds in [('village-demo-v3.webm', 150), ('village-demo-v3.mp4', 150), ('village-highlight-10s.mp4', 10)]:
    target = folder / name
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(target)]))
    video = [s for s in probe['streams'] if s['codec_type'] == 'video']
    assert len(video) == 1 and len(probe['streams']) == 1, 'Must be silent video only'
    assert (video[0]['width'], video[0]['height']) == (1920, 1080)
    duration = float(probe['format']['duration'])
    assert abs(duration - seconds) <= .08, (name, duration)
    assert 0 < target.stat().st_size <= 100_000_000
    subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(target), '-f', 'null', '-'], check=True)
    results.append({'file': name, 'seconds': duration, 'bytes': target.stat().st_size, 'codec': video[0]['codec_name'], 'size': '1920x1080', 'audio_streams': 0, 'decode': 'passed'})
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(folder/'village-demo-v3.mp4'), '-vf', 'fps=1/5,scale=384:216,tile=5x6', '-frames:v', '1', str(folder/'contact-sheet.jpg')], check=True)
for second in [10, 25, 50, 65, 85, 92, 110, 130, 140, 148]:
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(second), '-i', str(folder/'village-demo-v3.mp4'), '-frames:v', '1', str(folder/f'frame-{second:03d}.png')], check=True)
(folder/'verification.json').write_text(json.dumps(results, indent=2) + '\n')
print(json.dumps(results, indent=2))
