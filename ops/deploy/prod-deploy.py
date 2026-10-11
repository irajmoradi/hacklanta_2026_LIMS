"""Ship committed source plus public build settings; never ship a secret env."""
import argparse
import os
from pathlib import Path
import re
import subprocess as sp
import tarfile
import tempfile
import time

started = time.monotonic()

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('commit')
p.add_argument('--host', default='root@207.246.81.187')
p.add_argument('--key', default=str(Path.home() / '.ssh/village_vultr'))
a = p.parse_args()
root = Path(__file__).resolve().parents[2]
sha = sp.check_output(['git', 'rev-parse', '--verify', a.commit + '^{commit}'], cwd=root, text=True).strip()
names = ['VITE_AUTH0_DOMAIN', 'VITE_AUTH0_CLIENT_ID', 'VITE_AUTH0_AUDIENCE']
env_path = os.environ.get('VILLAGE_ENV_FILE', '/c/Users/mourn/Downloads/hacklanta/.env')
if os.name == 'nt':
    env_path = re.sub(r'^/([a-zA-Z])/', r'\1:/', env_path)
# Parse only public names, without sourcing the file or exposing other values.
values = {}
for line in Path(env_path).read_text(encoding='utf-8-sig').splitlines():
    key, sep, value = line.strip().removeprefix('export ').partition('=')
    if sep and key.strip() in names:
        values[key.strip()] = value.strip().strip('\"\'')
public = [os.environ.get(n, values.get(n, '')) for n in names]
if any(not v or '\n' in v or '\r' in v for v in public):
    raise SystemExit('Three nonempty public Auth0 build settings are required')
enabled = os.environ.get('VITE_AUTH0_ENABLED', '0')  # Sign in stays hidden until the owner approves (R-179)
if enabled not in ('0', '1'):
    raise SystemExit('VITE_AUTH0_ENABLED must be 0 or 1')
public.append(enabled)
ssh = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-i', a.key, a.host]
with tempfile.TemporaryDirectory(prefix='village-prod-') as tmp:
    archive = Path(tmp) / 'source.tar'
    sp.run(['git', 'archive', '--format=tar', '-o', str(archive), sha], cwd=root, check=True)
    with tarfile.open(archive) as src:
        if 'ops/deploy/prod-release.py' not in src.getnames():
            raise SystemExit('Commit must include DEPLOY-002 tooling; integrate it before deploying')
        for entry in src:
            if any((x.startswith('.env') and x != '.env.example') or x in {'data', '.ssh', '.venv', 'node_modules'} for x in Path(entry.name).parts) or entry.name.endswith(('.pem', '.key', '.pt', '.ckpt', '.safetensors')):
                raise SystemExit('Refusing archive with private/runtime files')
    incoming = sp.check_output(ssh + ['mktemp -d /tmp/village-prod.XXXXXXXX'], text=True).strip()
    if not re.fullmatch(r'/tmp/village-prod\.[a-zA-Z0-9]+', incoming):
        raise SystemExit('Unexpected incoming directory')
    try:
        with archive.open('rb') as stream:
            sp.run(ssh + [f'tar -xf - -C {incoming}'], stdin=stream, check=True)
        result = sp.run(ssh + [f'bash {incoming}/ops/deploy/prod-prepare.sh {sha} {incoming}'],
                        input=('\n'.join(public) + '\n').encode())
    finally:
        # Exact, validated mktemp directory only; it may already have become a release.
        sp.run(ssh + [f'rm -rf -- {incoming}'], check=False)
print(f'PC end-to-end elapsed={time.monotonic()-started:.2f}s', flush=True)
raise SystemExit(result.returncode)
