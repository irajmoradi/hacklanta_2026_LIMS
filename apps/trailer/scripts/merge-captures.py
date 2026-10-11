"""Merge protected capture artifacts from an isolated second runner download.

Usage: python scripts/merge-captures.py PATH/TO/SECOND/artifacts/captures
Only merges matching read-only audits; the supplied directory wins duplicate shots.
"""
import json, shutil, sys
from pathlib import Path
out=Path(__file__).resolve().parents[1]/'artifacts/captures'
extra=Path(sys.argv[1]).resolve()
base=json.loads((out/'capture-audit.json').read_text())
added=json.loads((extra/'capture-audit.json').read_text())
for audit in (base,added):
    assert audit['source']=='https://thefriendshipvillage.vodka'
    assert audit['viewport']==[1920,1080]
    assert audit['forwarded_mutations']==audit['websocket_connections_forwarded']==0
names=set(added['frames'])
base['segments']=[s for s in base['segments'] if s['name'] not in names]+added['segments']
base['frames']=list(dict.fromkeys(base['frames']+added['frames']))
base['attempt_failures']=base.get('attempt_failures',[])+base['failures']+added['failures']
base['failures']=[f for f in base['attempt_failures'] if f['name'] not in base['frames']]
base['merged_capture']=added['captured_at']
for key,count in added['blocked'].items(): base['blocked'][key]=base['blocked'].get(key,0)+count
for key in ('failedReads','rendererErrors','errors'): base[key]+=added.get(key,[])
for segment in added['segments']:
    name=segment['name']
    shutil.copyfile(extra/f'{name}.png',out/f'{name}.png')
    shutil.copyfile(extra/'raw'/segment['video'],out/'raw'/segment['video'])
    motion=extra/f'{name}-motion.png'
    if motion.exists(): shutil.copyfile(motion,out/motion.name)
(out/'capture-audit.json').write_text(json.dumps(base,indent=2))
print('Merged',len(names),'protected shots; total',len(base['frames']))
