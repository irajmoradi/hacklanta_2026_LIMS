"""Copy verified runner exports into the ignored handoff folder and verify transfer hashes."""
import hashlib, json, shutil, subprocess, sys
from pathlib import Path
root=Path(__file__).resolve().parents[3]
source=Path(sys.argv[1]).resolve()
target=root/'docs/devpost/video'
frames=target/'frames'
frames.mkdir(parents=True,exist_ok=True)
report=json.loads((source/'verification.json').read_text())
expected={'village-trailer-v4.mp4','village-trailer-v4-discord.mp4','village-trailer-v4-square.mp4'}
assert {entry['file'] for entry in report}==expected
for entry in report:
    assert entry['decode']=='passed'
    src=source/entry['file']
    assert hashlib.sha256(src.read_bytes()).hexdigest()==entry['sha256']
    shutil.copyfile(src,target/src.name)
    assert hashlib.sha256((target/src.name).read_bytes()).hexdigest()==entry['sha256']
shutil.copyfile(source/'verification.json',target/'verification.json')
shutil.copyfile(source/'village-trailer-v4-poster.png',target/'village-trailer-v4-poster.png')
for pattern in ['village-trailer-v4-frame-*.png','village-trailer-v4-square-frame-*.png','pipeline-*.png','detail-*.png']:
    for src in source.glob(pattern):shutil.copyfile(src,frames/src.name)
subprocess.run([sys.executable,str(root/'apps/trailer/scripts/contact_sheet.py'),str(frames)],check=True)
print('Packaged three verified v4 MP4s, matching hashes, poster, encoded frames and contact sheets.')
