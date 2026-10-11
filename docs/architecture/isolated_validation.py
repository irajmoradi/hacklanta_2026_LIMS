"""Unique DB/ports let DOCS-012 use the runner's independent Bun-test lane."""
import os
from pathlib import Path
import socket
import subprocess
from urllib.parse import urlparse
from uuid import uuid4

root = Path(__file__).resolve().parents[2]
dsn = urlparse(os.environ.get('DATABASE_URL', ''))
if (os.environ.get('VILLAGE_ENV_FILE') != '/dev/null' or dsn.hostname != '127.0.0.1'
        or dsn.path != '/village_test' or dsn.username != 'postgres'):
    raise SystemExit('Run through the remote wrapper against its scratch server')

def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return str(sock.getsockname()[1])

database = 'run_docs012_' + uuid4().hex
env = {**os.environ, 'DATABASE_URL': f'postgresql://postgres@127.0.0.1:5432/{database}',
       'DOCS_API_PORT': free_port(), 'DOCS_WEB_PORT': free_port()}
subprocess.run(['createdb', '-h', '127.0.0.1', '-U', 'postgres', database], check=True)
try:
    for command in [
        ['python', '../../docs/architecture/validate_api.py'],
        ['node', '../../docs/architecture/render_diagrams.mjs'],
        ['bun', 'run', 'test'],
        ['bun', 'run', 'build'],
    ]:
        subprocess.run(command, cwd=root / 'apps/web', env=env, check=True)
finally:
    subprocess.run(['dropdb', '-h', '127.0.0.1', '-U', 'postgres', '--force', database], check=True)
