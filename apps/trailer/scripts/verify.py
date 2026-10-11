"""Check delivered media with ffprobe and decode every frame with ffmpeg."""
import json
import hashlib
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
out = root / 'artifacts'
report = []
for name, width, duration in [('village-trailer-v4',1920,94), ('village-trailer-v4-discord',1920,94), ('village-trailer-v4-square',1080,39)]:
    path = out / (name + '.mp4')
    info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)]))
    video = next(s for s in info['streams'] if s['codec_type'] == 'video')
    audio = next(s for s in info['streams'] if s['codec_type'] == 'audio')
    assert (video['width'], video['height']) == (width, 1080)
    # FFprobe uses yuvj420p for full-range 8-bit 4:2:0. It is still H.264;
    # Remotion's Chrome capture pipeline may signal this range explicitly.
    assert video['codec_name'] == 'h264'
    assert video['pix_fmt'] in ('yuv420p', 'yuvj420p')
    if video['pix_fmt'] == 'yuvj420p':
        assert video['color_range'] == 'pc'
    assert video['avg_frame_rate'] == '60/1'
    assert abs(float(info['format']['duration']) - duration) < .1
    assert int(video['nb_frames']) == duration * 60
    assert audio['codec_name'] == 'aac'
    assert path.stat().st_size <= (80_000_000 if name == 'village-trailer-v4' else 24_000_000)
    subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(path), '-f', 'null', '-'], check=True)
    sample_seconds = [2,4,17,35,43,51,58,64,70,78,88,92] if width == 1920 else [.5,1.5,7,15,18,21,24,27,30,34,36,38]
    for index, second in enumerate(sample_seconds, 1):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(second), '-i', str(path), '-frames:v', '1', '-update', '1', str(out / f'{name}-frame-{index}.png')], check=True)
    if name == 'village-trailer-v4':
        for label, second in [('photo',6.8),('mask',8.2),('traits',11),('splat',17),('villager',12.8),('waveform',23),('voice',29)]:
            subprocess.run(['ffmpeg','-v','error','-y','-ss',str(second),'-i',str(path),'-frames:v','1','-update','1',str(out/f'pipeline-{label}.png')],check=True)
        for label, second in [('mayor',75),('walking',60),('mesh',62.5),('placed-object',66.5),('unlock',45),('repair',53)]:
            subprocess.run(['ffmpeg','-v','error','-y','-ss',str(second),'-i',str(path),'-frames:v','1','-update','1',str(out/f'detail-{label}.png')],check=True)
    report.append({'file': path.name, 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'width': width, 'height': 1080, 'seconds': float(info['format']['duration']), 'fps': 60, 'frames': video['nb_frames'], 'video': 'h264', 'pixel_format': video['pix_fmt'], 'color_range': video.get('color_range', 'unspecified'), 'audio': 'aac', 'decode': 'passed', 'sample_seconds': sample_seconds, 'frame_grabs': 'extracted from final encoded video'})
(out / 'verification.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
