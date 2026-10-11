"""Exercise README API commands against the wrapper's disposable database only."""
import json
import os
from pathlib import Path
import socket
import subprocess
import time
from urllib.request import urlopen
from urllib.parse import urlparse

root = Path(__file__).resolve().parents[2]
dsn = urlparse(os.environ.get('DATABASE_URL', ''))
if dsn.hostname != '127.0.0.1' or not dsn.path.startswith('/run_'):
    raise SystemExit('Only the runner disposable DB is allowed')
directory = root / 'apps/api'
port = int(os.environ.get('DOCS_API_PORT', '8016'))
env = {**os.environ, 'DEMO_AUTH': '1', 'DEMO_DEBUG': '0',
       'MAYOR_SCHEDULER': '0', 'MAYOR_VOICE': '0', 'TIGER_DATABASE_URL': '',
       'GOOGLE_API_KEY': '', 'OPENROUTER_API_KEY': '', 'ELEVENLABS_API_KEY': '',
       'GPU_WORKER_URL': '', 'GPU_FALLBACK_URL': ''}
for command in [
    ['python', '-m', 'uv', 'sync', '--frozen', '--python', '3.12'],
    ['python', '-m', 'uv', 'run', 'python', 'scripts/migrate.py'],
    ['python', '-m', 'uv', 'run', 'python', 'scripts/seed.py'],
]:
    subprocess.run(command, cwd=directory, env=env, check=True)
# Fail rather than stop another user's API if this documented port is occupied.
with socket.socket() as probe:
    probe.bind(('127.0.0.1', port))
server = subprocess.Popen(['python', '-m', 'uv', 'run', 'uvicorn', 'app.main:app',
                           '--host', '127.0.0.1', '--port', str(port), '--no-proxy-headers'],
                          cwd=directory, env=env, start_new_session=True)
try:
    for attempt in range(60):
        if server.poll() is not None:
            raise RuntimeError('README API startup failed')
        try:
            with urlopen(f'http://127.0.0.1:{port}/api/health', timeout=2) as response:
                health = json.load(response)
            if health.get('ok') and health.get('db') == 'up':
                break
        except OSError:
            pass
        time.sleep(.5)
    else:
        raise RuntimeError('README API health timed out')
    print('README uv sync, migrate, seed and uvicorn command (isolated port): passed', flush=True)
    subprocess.run(['node', '../../docs/architecture/validate_runtime.mjs'],
                   cwd=root / 'apps/web',
                   env={**env, 'VILLAGE_API_URL': f'http://127.0.0.1:{port}'}, check=True)
finally:
    import signal
    os.killpg(server.pid, signal.SIGTERM)
    try:
        server.wait(timeout=10)
    except subprocess.TimeoutExpired:
        os.killpg(server.pid, signal.SIGKILL)
        server.wait()
