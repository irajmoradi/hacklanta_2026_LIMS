"""SSH/rsync controller. Environment values travel only on SSH stdin."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess as sp
import sys
import time

EXCLUDES = ['.git', '.ssh', '.env', '.env.*', '*.pem', '*.key', '*.log', 'API Keys.md',
            'node_modules', '.venv', '.runtime', '__pycache__', '*.tsbuildinfo', 'dist', 'build',
            'test-results', 'artifacts', 'playwright-report', '*screenshot*',
            'data', 'outputs', '*.pt', '*.ckpt', '*.safetensors',
            'workers/gpu/envs', 'workers/gpu/checkpoints', 'workers/gpu/repos']


def git(*args):
    return sp.check_output(['git', *args], text=True).strip()


def posix(path):
    value = str(path).replace('\\', '/')
    return '/' + value[0].lower() + value[2:] if re.match(r'^[A-Za-z]:', value) else value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env', action='append', default=[], metavar='NAME')
    parser.add_argument('--with-api', action='store_true')
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if args.command[:1] == ['--']:
        args.command.pop(0)
    if not args.command:
        parser.error('a command is required')
    root = Path(git('rev-parse', '--show-toplevel')).resolve()
    cwd = Path.cwd().resolve().relative_to(root).as_posix()
    ip = os.environ.get('RUNNER_IP', '')
    config = root / 'docs/infra/runner.env'
    if not ip and config.exists():
        match = re.search(r'^RUNNER_IP=([\w.:-]+)\s*$', config.read_text(), re.M)
        ip = match[1] if match else ''
    if not re.fullmatch(r'[A-Za-z0-9.:-]+', ip):
        parser.error('configure RUNNER_IP in the environment or docs/infra/runner.env')
    env = {}
    for name in args.env:
        if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', name):
            parser.error('invalid environment variable name')
        if name not in os.environ:
            # Read only on explicit request; never source executable .env text.
            try:
                from dotenv import dotenv_values
            except ImportError:
                parser.error('install python-dotenv to read --env values from VILLAGE_ENV_FILE')
            source = os.environ.get('VILLAGE_ENV_FILE', str(root / '.env'))
            if os.name == 'nt' and re.match(r'^/[a-zA-Z]/', source):
                source = source[1] + ':' + source[2:]
            values = dotenv_values(source, interpolate=False)
            if values.get(name) is None:
                parser.error(f'{name} is unset')
            env[name] = values[name]
        else:
            env[name] = os.environ[name]
    key = Path(os.environ.get('RUNNER_SSH_KEY', str(Path.home() / '.ssh/village_vultr')))
    ssh = ['ssh', '-i', str(key), '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10',
           '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3']
    target = 'runner@' + ip
    sp.run([*ssh, target, 'true'], check=True)
    rsync = os.environ.get('RSYNC') or shutil.which('rsync')
    if not rsync:
        bundled = root / 'ops/runner/.runtime/usr/bin/rsync.exe'
        if bundled.exists():
            rsync = str(bundled)
        else:
            parser.error('rsync is required (see docs/infra/REMOTE_RUNNER.md)')
    # MSYS DLL dependencies are adjacent to the bundled rsync executable.
    os.environ['PATH'] = str(Path(rsync).parent) + os.pathsep + os.environ['PATH']
    name = re.sub(r'[^A-Za-z0-9_-]', '-', root.name)
    name += '-' + hashlib.sha256(str(root).encode()).hexdigest()[:8]
    remote = '/srv/runs/' + name
    transport = shlex.join(['ssh', '-i', posix(key), *ssh[3:]])
    sync = [rsync, '-az', '-e', transport]
    started = time.monotonic()
    def remaining():
        seconds = 1800 - (time.monotonic() - started)
        if seconds <= 0:
            raise TimeoutError('Remote run exceeded 30 minutes')
        return max(1, int(seconds))
    lock = sp.Popen([*ssh, target, f'flock -w 1800 /srv/runner-locks/{name} '
                     "bash -c 'echo READY; cat >/dev/null'"],
                    stdin=sp.PIPE, stdout=sp.PIPE, text=True)
    try:
        if lock.stdout.readline().strip() != 'READY':
            raise RuntimeError('could not acquire runner lock')
        sp.run([*ssh, target, 'mkdir -p ' + remote], check=True, timeout=remaining())
        sp.run([*sync, '--delete', '--include=/packages/catalog/dist/***',
                *[f'--exclude={x}' for x in EXCLUDES],
                posix(root) + '/', target + ':' + remote + '/'], check=True, timeout=remaining())
        payload = dict(root=remote, cwd=cwd, command=args.command, env=env,
                       with_api=args.with_api, name=name)
        # The remote helper reads stdin before spawning children. No secret argv/files.
        budget = remaining()
        proc = sp.Popen([*ssh, target, f'timeout --signal=TERM --kill-after=10s {budget} '
                         'python3 ' + remote + '/ops/runner/execute.py'], stdin=sp.PIPE)
        try:
            proc.stdin.write((json.dumps(payload) + '\n').encode())
            proc.stdin.flush()
            proc.wait(timeout=budget + 20)
        finally:
            # EOF tells the remote supervisor to clean up before releasing the lock.
            proc.stdin.close()
            try:
                proc.wait(timeout=20)
            except sp.TimeoutExpired:
                proc.terminate()
                proc.wait(timeout=10)
        code = proc.returncode
        includes = ['--include=*/'] + [f'--include=**/{p}/***' for p in
                    ('test-results', 'artifacts', 'playwright-report', '*screenshot*')]
        destination = Path(os.environ.get('RUNNER_ARTIFACT_DIR', str(root)))
        destination.mkdir(parents=True, exist_ok=True)
        copied = sp.run([*sync, '--no-perms', '--no-owner', '--no-group', '-m',
                         *includes, '--exclude=*', target + ':' + remote + '/',
                         posix(destination) + '/'], timeout=60 if code == 124 else remaining()).returncode
        if copied:
            print('Artifact download failed', file=sys.stderr)
        print(f'Remote wall time including sync/cache: {time.monotonic()-started:.2f}s; exit={code}')
        return code or copied
    finally:
        lock.stdin.close()
        lock.wait(timeout=20)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (sp.CalledProcessError, RuntimeError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except (TimeoutError, sp.TimeoutExpired):
        print('Remote run exceeded its time limit', file=sys.stderr)
        sys.exit(124)
