"""Materialize the original WEB-044 scene for the optional before screenshot.
Run from any directory before remote_run.sh; generated copies are not committed.
"""
import re
import subprocess
from pathlib import Path
root = Path(__file__).resolve().parents[3]
base = '53ffcb44b70d846a395b4cb3b0b1f26009464f4c'
for name in ['VillageScene', 'OptionalModel', 'TownCamera', 'GridTown']:
    source = subprocess.check_output(['git', 'show', f'{base}:apps/web/src/scene/{name}.tsx'], cwd=root, text=True, encoding='utf-8')
    source = re.sub(r"from (['\"])(\.[^'\"]+)\1", lambda m: 'from ' + m[1] + ('../src/' + m[2][3:] if m[2].startswith('../') else '../src/scene/' + m[2][2:]) + m[1], source)
    for dependency in ['OptionalModel', 'TownCamera', 'GridTown']:
        source = source.replace('../src/scene/' + dependency, './web044Baseline' + dependency)
    Path(__file__).with_name('web044Baseline' + name + '.tsx').write_text(source, encoding='utf-8')
