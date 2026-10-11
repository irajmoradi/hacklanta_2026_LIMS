"""Jump-cut transient canvas reload frames from BOTH windows of the recorded edit.

No synthetic replacement or independent window retiming: preserve real before/after.
Run verify-room-frames.py on the source first, then verify the cleaned clip again.
"""
from pathlib import Path
import hashlib
import json
import subprocess as sp
import sys

root=Path(__file__).resolve().parents[1]
name=sys.argv[1] if len(sys.argv)>1 else 'house-sync'
assert name in ('house-sync','hall-decor')
source=root/f'artifacts/scratch/{name}.mp4'
audit=json.loads((root/'artifacts/room-frame-verification.json').read_text())
assert audit['sha256']==hashlib.sha256(source.read_bytes()).hexdigest()
bad=sorted({f['frame'] for f in audit['blank_frames']})
assert bad and len(bad)<audit['frames']/3, 'Only a short transient reload may be cut'
assert min(bad)>0 and max(bad)<audit['frames']-1, 'Both real before/after states required'
select='not('+ '+'.join(f'eq(n,{n})' for n in bad)+')'
target=root/f'artifacts/{name}-clean.mp4'
sp.run(['ffmpeg','-v','error','-y','-i',str(source),'-vf',f"select='{select}',setpts=N/(25*TB)",'-an','-r','25','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',str(target)],check=True)
(root/f'artifacts/{name}-editorial-cuts.json').write_text(json.dumps({'source_sha256':audit['sha256'],'removed_frames':bad,'reason':'Transient visitor WebGL canvas reload during saved-edit refresh; both windows cut together','output_sha256':hashlib.sha256(target.read_bytes()).hexdigest()},indent=2)+'\n')
print(f'Cut {len(bad)} transient frames from both windows; retained {audit["frames"]-len(bad)} real source frames.')
