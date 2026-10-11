"""Run through remote_run.sh; build the exact starting revision and integration."""
from pathlib import Path
import os
import shutil
import subprocess
import tarfile

web = Path.cwd()
out = web / 'artifacts/integ018'
out.mkdir(parents=True, exist_ok=True)
# Source symlinks are runner-local and must not enter the artifact download.
old_source = out / 'baseline-source'
if old_source.exists():
    assert old_source.resolve().parent == out.resolve()
    shutil.rmtree(old_source)
baseline = web / '.integ018-baseline'
baseline.mkdir(exist_ok=True)
with tarfile.open(web / 'tests/perf/baseline-source.tar') as archive:
    archive.extractall(baseline, filter='data')
assets = baseline / 'assets'
if not assets.exists():
    assets.symlink_to(web.parents[1] / 'assets', target_is_directory=True)
before = baseline / 'apps/web'
for name in ['node_modules', 'public', 'src/components/pot/node_modules']:
    target = before / name
    if not target.exists():
        target.symlink_to(web / name, target_is_directory=True)
env = {**os.environ, 'VITE_MOCK': '1', 'VITE_DEMO_AUTH': '1',
       'VILLAGE_API_URL': 'http://127.0.0.1:9'}
try:
    for label, source in [('before', before), ('after', web)]:
        subprocess.run(['bun', 'run', 'build'], cwd=source, env=env, check=True)
        shutil.copytree(source / 'dist', out / f'{label}-build', dirs_exist_ok=True)
    subprocess.run(['bun', 'run', 'test'], check=True)
    subprocess.run(['bun', 'test', 'src', '--timeout', '30000'], check=True)
finally:
    assert baseline.resolve().parent == web.resolve()
    shutil.rmtree(baseline)
