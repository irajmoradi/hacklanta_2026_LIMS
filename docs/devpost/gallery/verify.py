"""Lightweight gallery checks, using only Python's standard library."""
import hashlib
import json
import struct
import zlib
from pathlib import Path

root = Path(__file__).resolve().parent
captions = (root / 'CAPTIONS.md').read_text(encoding='utf-8')
images = sorted((root / 'screenshots').glob('[0-9][0-9]-*.png'))
assert 11 <= len(images) <= 13, f'Expected 10–12 gallery frames plus cover; got {len(images)}'
hashes = set()
for image in images:
    raw = image.read_bytes()
    assert raw[:8] == b'\x89PNG\r\n\x1a\n', image.name
    width, height = struct.unpack('>II', raw[16:24])
    assert (width, height) == (1500, 1000), (image.name, width, height)
    offset = 8
    while offset < len(raw):
        size = struct.unpack('>I', raw[offset:offset + 4])[0]
        chunk = raw[offset + 4:offset + 8 + size]
        crc = struct.unpack('>I', raw[offset + 8 + size:offset + 12 + size])[0]
        assert zlib.crc32(chunk) & 0xffffffff == crc, f'Corrupt PNG: {image.name}'
        offset += size + 12
    digest = hashlib.sha256(raw).hexdigest()
    assert digest not in hashes, f'Duplicate screenshot: {image.name}'
    hashes.add(digest)
    assert image.name in captions, f'Missing caption: {image.name}'
    print(f'PASS {image.name}: 1500x1000, valid PNG, unique, captioned')
audit = json.loads((root / 'screenshots' / 'capture-audit.json').read_text())
assert audit['forwarded_mutations'] == 0
assert audit['websocket_connections_forwarded'] == 0
assert audit['privacy_checks_passed'] == len(images)
assert not audit['failures'], f"Unresolved capture failures: {audit['failures']}"
assert {p.stem for p in images} == set(audit['frames'])
assert (audit.get('head_pixels') or {}).get('colors', 0) >= 32, 'No painted-head pixel check recorded'
print(f'PASS {len(images)} exports; read-only transport and privacy checks recorded')
