"""Temporary scratch API on the prepared private web upstream; never prod.env."""
import os
from pathlib import Path
import re
import socket
import subprocess as sp
import sys
import time
import urllib.request

db = sys.argv[1]
assert re.fullmatch(r'village_rehearsal_[a-z0-9_]+', db)
assert os.geteuid() == 0
with socket.socket() as probe:
    probe.bind(('127.0.0.1', 8012))  # fail closed if production API already exists
root = Path('/opt/village/prod-current')
python = str(root / 'apps/api/.venv/bin/python')
password = Path('/etc/village/prod-db/password').read_text().strip()
env = {**os.environ, 'DATABASE_URL': f'postgresql://village_prod:{password}@127.0.0.1:55433/{db}',
       'VILLAGE_ENV_FILE': '/dev/null', 'DEMO_AUTH': '1', 'DEMO_DEBUG': '0', 'MAYOR_SCHEDULER': '0',
       'MAYOR_VOICE': '0', 'LLM_MAX_CALLS_PER_HOUR': '0', 'TIGER_DATABASE_URL': '',
       'GPU_WORKER_URL': 'http://127.0.0.1:1/health', 'GPU_FALLBACK_URL': '',
       'ASSET_DIR': '/var/lib/village-prod/rehearsal-assets-cutover001'}
sp.run(['runuser', '-u', 'village-prod', '--', python, 'scripts/migrate.py'], cwd=root / 'apps/api', env=env, check=True)
process = sp.Popen(['runuser', '-u', 'village-prod', '--', python, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8012'], cwd=root / 'apps/api', env=env)
try:
    for _ in range(30):
        if process.poll() is not None:
            raise RuntimeError('Scratch API exited')
        try:
            urllib.request.urlopen('http://127.0.0.1:8012/api/health', timeout=3).close()
            break
        except OSError:
            time.sleep(1)
    sp.run([python, str(root / 'ops/deploy/verify_prod.py'),
            '--village', '13370000-0000-4000-8000-000000000000',
            '--house', '13370000-0000-4000-8000-000000000001',
            '--rehearsal-user', '13370000-0000-4000-8000-000000000001',
            '--asset', '/api/assets/avatars/13370000-0000-4000-8000-000000000001/probe.txt'], env=env, check=True)
finally:
    process.terminate()
    process.wait(timeout=20)
