"""Live control-plane regression checks against an already provisioned runner.

Run from the worktree root. Uses only scratch state and synthetic values.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess as sp
import sys

root = Path.cwd().resolve()
wrapper = [sys.executable, str(root/'ops/runner/remote_run.py')]
assert sp.run([*wrapper, 'python', '-c', 'raise SystemExit(23)']).returncode == 23
print('PASS: exact nonzero exit code', flush=True)
assert sp.run([*wrapper, 'bash', '-c', 'kill -TERM $$']).returncode == 143
print('PASS: signal exit status', flush=True)

first_code = "from pathlib import Path; import time; p=Path('ops/runner/.runtime/control'); p.parent.mkdir(parents=True,exist_ok=True); p.write_text('busy'); print('LOCK_READY',flush=True); time.sleep(3); p.write_text('done')"
first = sp.Popen([*wrapper, 'python', '-c', first_code], stdout=sp.PIPE, text=True)
try:
    while True:
        line = first.stdout.readline()
        if not line:
            raise AssertionError('first lock holder exited before ready')
        if 'LOCK_READY' in line:
            break
    second = sp.run([*wrapper, 'python', '-c',
                     "from pathlib import Path; assert Path('ops/runner/.runtime/control').read_text() == 'done'"],
                    timeout=60)
    assert first.wait(timeout=30) == 0 and second.returncode == 0
finally:
    if first.poll() is None:
        first.terminate()
print('PASS: same-worktree runs serialize across upload and execution', flush=True)

name = re.sub(r'[^A-Za-z0-9_-]', '-', root.name) + '-' + hashlib.sha256(str(root).encode()).hexdigest()[:8]
ip = os.environ.get('RUNNER_IP') or re.search(r'RUNNER_IP=(\S+)', (root/'docs/infra/runner.env').read_text())[1]
ssh = ['ssh', '-i', os.environ.get('RUNNER_SSH_KEY', str(Path.home()/'.ssh/village_vultr')),
       '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'runner@' + ip]
request = dict(root='/srv/runs/' + name, name=name, cwd='.', env={}, with_api=True,
               command=['python', '-c', "import time; print('CANCEL_READY',flush=True); time.sleep(60)"])
process = sp.Popen([*ssh, 'timeout 60 python3 /srv/runs/' + name + '/ops/runner/execute.py'],
                   stdin=sp.PIPE, stdout=sp.PIPE, text=True)
try:
    process.stdin.write(json.dumps(request) + '\n')
    process.stdin.flush()
    while True:
        line = process.stdout.readline()
        if not line:
            raise AssertionError('supervisor exited before cancellation check')
        if 'CANCEL_READY' in line:
            break
    process.stdin.close()  # Simulate the SSH client disappearing.
    assert process.wait(timeout=20) == 143
finally:
    if process.poll() is None:
        process.terminate()
db = 'run_' + hashlib.sha256(name.encode()).hexdigest()[:16]
result = sp.run([*ssh, 'psql -h 127.0.0.1 -U postgres -At'],
                input=f"SELECT datname FROM pg_database WHERE datname='{db}';\n",
                text=True, capture_output=True, check=True)
assert not result.stdout.strip(), 'disposable database survived cancellation'
print('PASS: disconnected SSH stdin terminates child/API and drops scratch DB', flush=True)

# Exercise the production timeout/cleanup path with a shorter test deadline.
request.update(with_api=False, command=['python', '-c', 'import time; time.sleep(60)'])
process = sp.Popen([*ssh, 'timeout --signal=TERM --kill-after=10s 2 python3 /srv/runs/'
                   + name + '/ops/runner/execute.py'], stdin=sp.PIPE)
try:
    process.stdin.write((json.dumps(request) + '\n').encode())
    process.stdin.flush()
    assert process.wait(timeout=20) == 124
finally:
    process.stdin.close()
    if process.poll() is None:
        process.terminate()
print('PASS: timeout supervisor returns 124', flush=True)
