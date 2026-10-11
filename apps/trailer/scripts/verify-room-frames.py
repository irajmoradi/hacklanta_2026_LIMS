"""Reject a blank owner/visitor canvas in any frame of the house-sync capture."""
from pathlib import Path
import json
import hashlib
import subprocess as sp
import sys
from PIL import Image, ImageStat

root=Path(__file__).resolve().parents[1]
path=Path(sys.argv[1]) if len(sys.argv)>1 else root/'public/captures/house-sync.mp4'
process=sp.Popen(['ffmpeg','-v','error','-i',str(path),'-vf','scale=960:450','-pix_fmt','gray','-f','rawvideo','-'],stdout=sp.PIPE)
minimum=[255.,255.];failed=[];frames=0
while True:
    data=process.stdout.read(960*450)
    if not data:break
    assert len(data)==960*450
    image=Image.frombytes('L',(960,450),data)
    for seat,x in enumerate([60,540]):
        # Inside the 3D canvas; exclude surrounding text/UI which could mask a blank.
        deviation=ImageStat.Stat(image.crop((x,125,x+245,360))).stddev[0]
        minimum[seat]=min(minimum[seat],deviation)
        if deviation<8:failed.append({'frame':frames,'seat':seat,'stddev':deviation})
    frames+=1
assert process.wait()==0 and frames>0
report={'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'frames':frames,'minimum_canvas_stddev':minimum,'blank_frames':failed}
(root/'artifacts/room-frame-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
assert not failed, 'A recorded house canvas is blank; inspect before including it.'
