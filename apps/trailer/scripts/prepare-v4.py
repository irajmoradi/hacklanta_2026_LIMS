"""Prepare complete v4 actions, keeping the LAM canvas at native resolution."""
from pathlib import Path
import json, subprocess, shutil
root=Path(__file__).resolve().parents[1]
out=root/'public/captures'
source=root/'public/captures/raw-source'
audit=json.loads((source/'capture-audit.json').read_text())
assert audit['forwarded_mutations']==audit['websocket_connections_forwarded']==0
lengths={'growth-unlock':8,'disaster-repair':7,'head':6}
for s in audit['segments']:
    duration=s['duration']-.3
    name=s['name']; target=lengths.get(name,duration)
    vf=f'setpts=(PTS-STARTPTS)*{target/duration}'
    if name=='head':vf='crop=864:864:528:106,'+vf;name='head-detail'
    subprocess.run(['ffmpeg','-v','error','-y','-ss',str(s['start']+.15),'-i',str(source/'raw'/s['video']),'-an','-vf',vf,'-t',str(target),'-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-r','30',str(out/f'{name}.mp4')],check=True)
    if (source/f"{s['name']}.png").exists():shutil.copyfile(source/f"{s['name']}.png",out/f"{s['name']}.png")
shutil.make_archive(str(root/'artifacts/fresh-captures'),'zip',out)
print('Prepared complete v4 actions and native-resolution head crop.')
