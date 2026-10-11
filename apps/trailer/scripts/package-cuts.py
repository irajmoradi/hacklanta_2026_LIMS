"""Package TRAILER-005 exports only after verification, OCR review and hash checks."""
from pathlib import Path
import hashlib
import json
import shutil
import sys

ROOT=Path(__file__).resolve().parents[3]
source=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT/'apps/trailer/artifacts/cuts-v4'
target=ROOT/'docs/devpost/video'
frames=target/'frames';frames.mkdir(exist_ok=True)
report=json.loads((source/'verification-cuts.json').read_text())
audit=json.loads((source/'frame-text-audit.json').read_text())
assert len(report)==5 and len(audit)==3
assert not any(entry['flags'] for entry in audit)
expected={f'village-trailer-v4-{suffix}.mp4' for suffix in ['long','long-discord','90','90-discord','square']}
assert {entry['file'] for entry in report}==expected
for entry in report:
    path=source/entry['file']
    assert entry['decode']=='passed'
    assert hashlib.sha256(path.read_bytes()).hexdigest()==entry['sha256']
    if 'discord' not in path.name:
        text_audit=next(a for a in audit if a['file']==entry['file'])
        assert text_audit['sha256']==entry['sha256'] and text_audit['frames']==entry['frames']
    shutil.copyfile(path,target/path.name)
    assert hashlib.sha256((target/path.name).read_bytes()).hexdigest()==entry['sha256']
for name in ['verification-cuts.json','frame-text-audit.json','timeline-long.json','timeline-90.json']:
    shutil.copyfile(source/name,target/name)
for cut in ['long','90','square']:
    shutil.copyfile(source/f'contact-sheet-{cut}.jpg',frames/f'contact-sheet-v4-{cut}.jpg')
shutil.copyfile(source/'work/end.png',target/'village-trailer-v4-lengths-poster.png')
print('Packaged five verified MP4s, matching SHA-256 hashes, three contact sheets, poster and audit records.')
