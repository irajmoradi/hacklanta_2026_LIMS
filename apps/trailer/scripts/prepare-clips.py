"""Trim fresh protected browser recordings; no gallery fallback or generation."""
from pathlib import Path
import json, shutil, subprocess, sys
root=Path(__file__).resolve().parents[1]
source=root/'artifacts/captures'
out=root/'public/captures'
out.mkdir(parents=True,exist_ok=True)
audit=json.loads((source/'capture-audit.json').read_text())
required={'town','cafe','checkin','goals','friends','reading','hall','colosseum','competition','review','mayor','gazette','head','wardrobe','house-undo','walking','walking-wide','bottoms','shoes','glasses','shop','pets','farm','dashboard','shelter'}
only=set(sys.argv[1:])
if only: required=only
assert required.issubset(audit['frames']), f"Missing shots: {required-set(audit['frames'])}"
unresolved=[f for f in audit['failures'] if f['name'] in required and f['name'] not in audit['frames']]
assert not unresolved, unresolved
if audit['failures']:
    print('Retaining prior fresh captures after unsuccessful optional refresh:', [f['name'] for f in audit['failures']])
assert audit['viewport']==[1920,1080]
assert audit['forwarded_mutations']==audit['websocket_connections_forwarded']==0
for segment in audit['segments']:
    if only and segment['name'] not in only:
        continue
    name=segment['name']
    shutil.copyfile(source/f'{name}.png',out/f'{name}.png')
    duration=segment['duration']-.3
    filters=['-vf',f'setpts=(PTS-STARTPTS)*{3/duration}', '-t','3'] if name=='head' else ['-t',str(duration)]
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(segment['start']+.25),'-i',str(source/'raw'/segment.get('video',audit['video'])),'-an',*filters,'-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-r','30',str(out/f'{name}.mp4')],check=True)
print('Prepared',sum(not only or s['name'] in only for s in audit['segments']),'fresh clips')

shutil.make_archive(str(root/'artifacts/fresh-captures'), 'zip', out)
