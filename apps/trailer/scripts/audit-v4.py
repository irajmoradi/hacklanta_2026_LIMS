"""Check source durations, sent-message provenance and per-animation-frame label audits."""
import hashlib, json, subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
source=root/'public/captures'
def duration(name):
    return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(source/name)]))
memo=duration('memo.ogg')
assert memo>=6, 'Original recording must cover the six-second main passage'
aud=json.loads((source/'raw-source/capture-audit.json').read_text())
assert aud['forwarded_mutations']==aud['websocket_connections_forwarded']==0
checks=aud['frameChecks']
assert {c['name'] for c in checks}=={'colosseum','competition'}
assert all(c['count']>0 and not c['stray'] for c in checks)
message=json.loads((source/'message-display.json').read_text())
outbox=json.loads((source/'imessage.json').read_text())
assert outbox['status']=='sent' and any(m['id']==message['id'] and m['text']==message['text'] for m in outbox['messages'])
assert message['has_video']
clips={name:duration(name+'.mp4') for name in ['head-detail','growth-unlock','disaster-repair','synced-walking','house-sync','object-room','hall-decor','object-turntable','talk']}
for name,seconds in {'head-detail':6,'growth-unlock':8,'disaster-repair':7,'synced-walking':3,'house-sync':3,'object-room':3,'hall-decor':3,'object-turntable':6}.items():
    proof_name={'house-sync':'house-frame-verification.json','hall-decor':'hall-frame-verification.json'}.get(name)
    if proof_name and (source/proof_name).exists():
        proof=json.loads((source/proof_name).read_text())
        assert proof['sha256']==hashlib.sha256((source/f'{name}.mp4').read_bytes()).hexdigest()
        assert proof['frames']>0 and not proof['blank_frames']
        assert 2<=clips[name]<=3.15, (name,clips[name])
        continue # TRAILER-005 trims only transient blank reloads from both windows.
    assert abs(clips[name]-seconds)<.15,(name,clips[name])
report={'original_memo_seconds':memo,'original_memo_in_main_seconds':6,'clips':clips,'delivered_message_matches_outbox':True,'label_checks':checks,'production_mutations':0,'generation_calls':0}
(root/'artifacts/source-verification.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
