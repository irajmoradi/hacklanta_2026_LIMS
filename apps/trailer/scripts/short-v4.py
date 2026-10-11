"""TRAILER-007: polish only the short cut, with phone-sized captions.

Render/verify on runner: uv run --with pillow python scripts/short-v4.py render
Package locally: python apps/trailer/scripts/short-v4.py package
The original long and square outputs are never written by this script.
"""
import importlib.util
import json
import shutil
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

spec = importlib.util.spec_from_file_location('cuts', Path(__file__).with_name('cuts-v4.py'))
cuts = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cuts)
OUT = cuts.ROOT / 'artifacts/short-v4'
SOURCE = cuts.ROOT / 'artifacts/cuts-v4/village-trailer-v4-90.mp4'
CAPTIONS = {
    'hook': 'Friends drift. Making plans becomes the hardest part.',
    'photo': 'Start with Iraj’s real photo.',
    'mask': 'SAM 3 separates the person from the background.',
    'traits': 'Photo-derived colors become your villager’s palette.',
    'chibi': "Gemini turns your photo into your villager's chibi face.",
    'villager': 'Hunyuan3D turns it into a 3D head.',
    'goals': "Set a weekly goal. Check in daily. Stretch it when you're done.",
    'splat': 'Iraj’s actual Gaussian-splat head. A slow orbit.',
    'memo': 'Iraj’s original recording becomes his AI voice.',
    'clone': '“Video test from the village! Get off your ass and go crush your goals today.”',
    'imessage': 'A real delivered video gram. Reconstructed from sent outbox data.',
}


def wrapped(text, size=56):
    draw = ImageDraw.Draw(Image.new('RGB', (1920, 1080)))
    lines = ['']
    for word in text.split():
        trial = (lines[-1] + ' ' + word).strip()
        if draw.textlength(trial, font=cuts.font(size)) > 1776:
            lines.append(word)
        else:
            lines[-1] = trial
    assert len(lines) <= 2, (text, lines)
    assert all(draw.textlength(line, font=cuts.font(size)) <= 1776 for line in lines)
    return lines


def overlay(beat):
    image = Image.new('RGBA', (1920, 1080))
    draw = ImageDraw.Draw(image)
    if beat['key'] == 'stack':
        # Replace all baked-in credits, keeping other cuts untouched.
        draw.rectangle((0, 0, 1919, 1079), fill=cuts.BG)
        cuts.centered(draw, 110, 'Built to bring people together.', 70)
        for y, label, names in [
            (300, 'IDENTITY', 'SAM 3 · Gemini Image · LAM · Audio2Expression · ElevenLabs'),
            (440, 'WORLD', 'React Three Fiber · Hunyuan3D · TigerData'),
            (580, 'MAYOR + MESSAGES', 'Gemini · Photon iMessage · Solana devnet'),
            (720, 'INFRASTRUCTURE', 'Modal · Vultr'),
        ]:
            cuts.centered(draw, y, label, 22, cuts.LIME)
            cuts.centered(draw, y + 44, names, 40)
    # Existing capture panels end at y=912; the band stays below their content.
    draw.rectangle((0, 916, 1919, 1079), fill='#061b15')
    lines = wrapped(beat['caption'])
    top = 998 - len(lines) * 66 / 2
    for i, line in enumerate(lines):
        draw.text((960, top + i * 66), line, font=cuts.font(56), fill=cuts.FG, anchor='mt')
    path = OUT / 'work' / (beat['key'] + '.png')
    image.save(path)
    return path


def chibi_card(beat):
    image = Image.new('RGB', (1920, 1080), cuts.BG)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((660, 65, 1260, 135), radius=24, fill=cuts.LIME)
    cuts.centered(draw, 85, 'GEMINI IMAGE · STYLIZE', 32, cuts.BG)
    cuts.centered(draw, 160, 'Your photo. Your villager.', 64)
    for x, name, label in [(250, 'iraj-face.png', 'IRAJ · REAL PHOTO'),
                           (1120, 'iraj-gemini-chibi.png', 'GEMINI · CHIBI FACE')]:
        with Image.open(cuts.ROOT / 'public/private' / name) as source:
            portrait = ImageOps.contain(source.convert('RGB'), (550, 550))
        image.paste(portrait, (x + (550 - portrait.width)//2, 290))
        draw.text((x + 275, 865), label, font=cuts.font(27), fill=cuts.MUTED, anchor='mt')
    draw.line((875, 560, 1030, 560), fill=cuts.LIME, width=12)
    draw.polygon([(1038, 560), (998, 532), (998, 588)], fill=cuts.LIME)
    image = Image.alpha_composite(image.convert('RGBA'), Image.open(overlay(beat)))
    path = OUT / 'work/chibi-card.png'
    image.convert('RGB').save(path)
    return path


def timeline():
    edit = [{'key': 'opening', 'start': 0, 'seconds': 2.5, 'frames': 75,
             'title': 'WEEKLY CHALLENGES AND DAILY CHECK-INS WITH FRIENDS', 'caption': ''}]
    cursor = 75
    for old in cuts.timeline('90'):
        if old['key'] == 'villager':
            edit.append({'key': 'chibi', 'start': cursor / 30, 'seconds': 2.5,
                         'frames': 75, 'title': 'Gemini Image · Stylize',
                         'caption': CAPTIONS['chibi'], 'source': 'private-stills'})
            cursor += 75
        frames = round(old['seconds'] * 30 * (1 if old['key'] in ('memo', 'clone') else .875))
        if old['key'] in ('photo', 'mask', 'traits'):
            frames = 36
        elif old['key'] == 'end':
            frames = 75
        # Recover the new 75-frame insert from longer visual holds only.
        frames -= {'splat': 15, 'unlock': 30, 'object': 15, 'end': 15}.get(old['key'], 0)
        beat = {**old, 'source_start': old['start'], 'source_seconds': old['seconds'],
                'start': cursor / 30, 'seconds': frames / 30, 'frames': frames,
                'caption': CAPTIONS.get(old['key'], old['caption'])}
        edit.append(beat)
        cursor += frames
    assert 80 <= cursor / 30 <= 85
    assert cursor == 2467, 'Keep the approved short-cut runtime unchanged'
    assert all(b['seconds'] >= 1.2 for b in edit if b['caption'])
    assert all('auth0' not in b['caption'].lower() for b in edit)
    return edit


def render():
    assert abs(float(cuts.probe(SOURCE)['format']['duration']) - 90) < .001
    edit = timeline()
    image = Image.new('RGB', (1920, 1080), cuts.BG)
    draw = ImageDraw.Draw(image)
    for i, line in enumerate(['WEEKLY CHALLENGES', 'AND DAILY CHECK-INS', 'WITH FRIENDS']):
        f = cuts.font(112, True)
        assert draw.textlength(line, font=f) < 1776
        draw.text((960, 325 + i * 150), line, font=f, fill=cuts.LIME if i == 2 else cuts.FG, anchor='mt')
    opening = OUT / 'work/opening.png'
    image.save(opening)
    paths = []
    for beat in edit:
        print(f"{beat['start']:.2f}s {beat['key']}", flush=True)
        target = OUT / 'work' / (beat['key'] + '.mp4')
        paths.append(target)
        common = ['-an', '-c:v', 'libx264', '-threads', '4', '-preset', 'fast', '-crf', '18',
                  '-pix_fmt', 'yuv420p', '-r', '30', '-frames:v', beat['frames'], target]
        if beat['key'] in ('opening', 'chibi'):
            still = opening if beat['key'] == 'opening' else chibi_card(beat)
            cuts.ff('-loop', '1', '-framerate', '30', '-i', still, *common)
        else:
            caption = overlay(beat)
            filters = (f"[0:v]setpts=(PTS-STARTPTS)*{beat['seconds']/beat['source_seconds']},fps=30,"
                       'tpad=stop_mode=clone:stop_duration=1[v];[v][1:v]overlay=0:0[out]')
            cuts.ff('-ss', beat['source_start'], '-t', beat['source_seconds'], '-i', SOURCE,
                    '-i', caption, '-filter_complex_threads', '1', '-filter_complex', filters,
                    '-map', '[out]', *common)
    listing = OUT / 'work/concat.txt'
    listing.write_text(''.join(f"file '{p.as_posix()}'\n" for p in paths))
    mute = OUT / 'work/mute.mp4'
    cuts.ff('-f', 'concat', '-safe', '0', '-i', listing, '-c', 'copy', mute)
    total = sum(b['frames'] for b in edit) / 30
    memo, clone = [next(b['start'] for b in edit if b['key'] == key) for key in ('memo', 'clone')]
    audio = (f"[1:a]atrim=duration={total},asetpts=PTS-STARTPTS,volume='if(between(t,{memo},{clone+4}),0.12,0.65)':eval=frame,afade=t=in:d=0.5,afade=t=out:st={total-2}:d=2[m];"
             f'[2:a]atrim=duration=6,asetpts=PTS-STARTPTS,afade=t=out:st=5.95:d=0.05,volume=0.85,adelay={round(memo*1000)}:all=1[a];'
             f'[3:a]atrim=duration=4,asetpts=PTS-STARTPTS,adelay={round(clone*1000)}:all=1[b];'
             '[m][a][b]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.95:level=0:latency=1[out]')
    master = OUT / 'village-trailer-v4-90.mp4'
    cuts.ff('-i', mute, '-stream_loop', '-1', '-i', cuts.OUT/'work/music-phrase.wav',
            '-i', cuts.SRC/'memo.ogg', '-i', cuts.SRC/'talk.mp4', '-filter_complex', audio,
            '-map', '0:v', '-map', '[out]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
            '-t', total, '-movflags', '+faststart', master)
    small = OUT / 'village-trailer-v4-90-discord.mp4'
    if master.stat().st_size <= 24_000_000:
        shutil.copyfile(master, small)
    else:
        for passno in (1, 2):
            cuts.ff('-i', master, '-c:v', 'libx264', '-threads', '4', '-preset', 'fast',
                    '-b:v', '2000k', '-pass', passno, '-passlogfile', OUT/'work/pass',
                    *(['-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', small]
                      if passno == 2 else ['-an', '-f', 'null', '-']))
    (OUT/'timeline-90.json').write_text(json.dumps(edit, indent=2) + '\n')
    verify()


def verify():
    edit = timeline()
    frames = sum(b['frames'] for b in edit)
    results = []
    for suffix in ('90', '90-discord'):
        path = OUT/f'village-trailer-v4-{suffix}.mp4'
        info = cuts.probe(path)
        v = next(s for s in info['streams'] if s['codec_type'] == 'video')
        a = next(s for s in info['streams'] if s['codec_type'] == 'audio')
        assert (v['width'], v['height'], v['codec_name'], v['avg_frame_rate']) == (1920, 1080, 'h264', '30/1')
        assert int(v['nb_frames']) == frames and a['codec_name'] == 'aac'
        assert abs(float(info['format']['duration']) - frames/30) < .04
        if suffix.endswith('discord'):
            assert path.stat().st_size <= 24_000_000
        cuts.ff('-xerror', '-i', path, '-f', 'null', '-')
        results.append({'file': path.name, 'seconds': float(info['format']['duration']),
                        'frames': frames, 'width': 1920, 'height': 1080, 'bytes': path.stat().st_size,
                        'sha256': cuts.digest(path), 'decode': 'passed'})
    cuts.OUT = OUT
    cuts.sheet('90', OUT/'village-trailer-v4-90.mp4',
               [b['start']+b['seconds']/2 for b in edit], [b['key'] for b in edit])
    (OUT/'verification-short.json').write_text(json.dumps(results, indent=2) + '\n')
    print(json.dumps(results, indent=2), flush=True)


def package():
    target = cuts.ROOT.parents[1] / 'docs/devpost/video'
    results = json.loads((OUT/'verification-short.json').read_text())
    assert len(results) == 2
    for result in results:
        source = OUT/result['file']
        assert result['decode'] == 'passed' and cuts.digest(source) == result['sha256']
        shutil.copyfile(source, target/source.name)
        assert cuts.digest(target/source.name) == result['sha256']
    for name in ('verification-short.json', 'timeline-90.json'):
        shutil.copyfile(OUT/name, target/name)
    shutil.copyfile(OUT/'contact-sheet-90.jpg', target/'frames/contact-sheet-v4-90.jpg')
    print('Packaged only the short cut and its verified Discord copy/contact sheet.')


if __name__ == '__main__':
    (OUT/'work').mkdir(parents=True, exist_ok=True)
    mode = sys.argv[1] if len(sys.argv) > 1 else 'render'
    assert mode in ('render', 'verify', 'package')
    globals()[mode]()
