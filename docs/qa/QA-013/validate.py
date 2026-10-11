"""Validate QA evidence without contacting production."""
from pathlib import Path
import json
import re
import struct
root = Path(__file__).resolve().parent
failures = []
files = list(root.rglob('*.json'))
for file in files:
    text = file.read_text(encoding='utf-8-sig')
    try:
        json.loads(text)
    except ValueError:
        failures.append(f'Invalid JSON: {file.name}')
    if re.search(r'Bearer\s+[A-Za-z0-9._-]{20,}|sk-[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.', text):
        failures.append(f'Potential credential: {file.name}')
images = list(root.rglob('*.png'))
for file in images:
    data = file.read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        failures.append(f'Invalid PNG: {file.name}')
        continue
    width, height = struct.unpack('>II', data[16:24])
    if (width, height) not in {(1440, 900), (1280, 720), (390, 844)}:
        failures.append(f'Unexpected viewport: {file.name} {width}x{height}')
report = root.parent / 'QA-013.md'
if report.exists():
    for link in re.findall(r'\]\((QA-013/[^)#]+)(?:#[^)]*)?\)', report.read_text(encoding='utf-8-sig')):
        if not (report.parent / link).exists():
            failures.append(f'Missing report link: {link}')
print(f'Checked {len(files)} JSON files and {len(images)} PNG files.')
for error in failures:
    print(error)
raise SystemExit(bool(failures))
