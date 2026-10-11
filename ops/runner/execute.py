"""Runs only on the disposable Linux runner, never on the demo host."""
import fcntl
from contextlib import nullcontext
import hashlib
import json
import os
from pathlib import Path
import signal
import socket
import subprocess as sp
import sys
import threading
import time
import urllib.request


def run(argv, **kwargs):
    process = sp.Popen(argv, stdin=sp.DEVNULL, start_new_session=True, **kwargs)
    try:
        code = process.wait()
        if code:
            raise sp.CalledProcessError(code, argv)
    except BaseException:
        try:
            os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=8)
        except ProcessLookupError:
            pass
        except sp.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
        raise


def install(directory, env):
    directory = Path(directory)
    locks = [p for p in [directory/'bun.lock', directory/'uv.lock'] if p.exists()]
    if not locks:
        return
    digest = hashlib.sha256()
    digest.update(b'runner-cache-v2-system-python')
    for file in locks + [p for p in (directory/'package.json', directory/'pyproject.toml',
                                    directory/'src/components/pot/package-lock.json') if p.exists()]:
        digest.update(file.read_bytes())
    # The pot component installs packages/pot-client by copy (--install-links), so its sources are part of the key.
    pot_client = directory.parent.parent/'packages/pot-client'
    if (directory/'src/components/pot/package-lock.json').exists() and pot_client.exists():
        for file in sorted(p for p in pot_client.rglob('*') if p.is_file() and 'node_modules' not in p.parts):
            digest.update(str(file.relative_to(pot_client)).encode()); digest.update(file.read_bytes())
    digest.update(sp.check_output(['bun', '--version']))
    cache = Path(env['RUNNER_CACHE']) / hashlib.sha256(str(directory).encode()).hexdigest()[:12]
    cache.mkdir(parents=True, exist_ok=True)
    stamp = cache / 'hash'
    wanted = digest.hexdigest()
    if stamp.exists() and stamp.read_text() == wanted and all(
            (directory / ('node_modules' if p.name == 'bun.lock' else '.venv')).exists() for p in locks):
        print(f'Dependency cache hit: {directory}', flush=True)
        return
    for lock in locks:
        if lock.name == 'uv.lock':
            run(['uv', 'venv', '.venv', '--allow-existing', '--python', '/usr/bin/python3.12'],
                cwd=directory, env=env)
        run(['bun', 'install', '--frozen-lockfile'] if lock.name == 'bun.lock'
            else ['uv', 'sync', '--frozen', '--python', '/usr/bin/python3.12'], cwd=directory, env=env)
    stamp.write_text(wanted)


def main():
    request = json.loads(sys.stdin.readline())
    root = Path(request['root'])
    env = dict(os.environ, **request['env'])
    env.update(VILLAGE_ENV_FILE='/dev/null', PLAYWRIGHT_BROWSERS_PATH='/opt/playwright',
               RUNNER_CACHE='/srv/runner-cache/' + request['name'],
               DATABASE_URL='postgresql://postgres@127.0.0.1:5432/village_test',
               VILLAGE_TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:5432/village_test',
               MAYOR_SCHEDULER='0', MAYOR_VOICE='0', DEMO_AUTH='1')
    # Browser/API smoke runs get a database separate from the pytest migration DB.
    db = 'run_' + hashlib.sha256(request['name'].encode()).hexdigest()[:16]
    api = None
    child = None
    db_created = False
    def interrupted(signum, frame):
        raise SystemExit(128 + signum)
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    signal.signal(signal.SIGHUP, interrupted)
    def disconnected():
        sys.stdin.read()
        os.kill(os.getpid(), signal.SIGTERM)
    threading.Thread(target=disconnected, daemon=True).start()
    cwd = root / request['cwd']
    try:
        install(cwd, env)
        if request['with_api']:
            install(root/'apps/api', env)
            run(['createdb', '-h', '127.0.0.1', '-U', 'postgres', db])
            db_created = True
            env.update(DATABASE_URL='postgresql://postgres@127.0.0.1:5432/' + db,
                       DEMO_DEBUG='1', ASSET_DIR=str(root/'apps/api/.runtime/assets'))
            for script in ('migrate.py', 'seed.py', 'sync_catalog.py'):
                run(['uv', 'run', 'python', 'scripts/' + script], cwd=root/'apps/api', env=env)
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0))
                port = sock.getsockname()[1]
            env['VILLAGE_API_URL'] = f'http://127.0.0.1:{port}'
            api = sp.Popen(['uv', 'run', 'uvicorn', 'app.main:app', '--host', '127.0.0.1',
                            '--port', str(port)], cwd=root/'apps/api', env=env,
                           stdin=sp.DEVNULL, start_new_session=True)
            for attempt in range(120):
                if api.poll() is not None:
                    raise RuntimeError('Disposable API failed to start')
                try:
                    urllib.request.urlopen(env['VILLAGE_API_URL'] + '/api/health', timeout=1).close()
                    break
                except OSError:
                    time.sleep(.5)
            else:
                raise RuntimeError('Disposable API readiness timed out')
        # Existing pytest fixtures share a migration DB; serialize API suites across worktrees.
        # Browser suites also use fixed Vite ports; lock them when invoked directly.
        command = request['command']
        # Browser suites pin a Vite port per config, so only identical commands can collide:
        # lock per command instead of globally, letting different specs run in parallel.
        lockname = 'api-tests' if cwd == root/'apps/api' else (
            'web-' + hashlib.sha1(' '.join(command).encode()).hexdigest()[:10])
        independent_web = cwd == root/'apps/web' and not request['with_api'] and (
            command[:3] in (['bun', 'run', 'test'], ['bun', 'run', 'build'])
            or command[:2] == ['bun', 'test'])
        with (nullcontext() if independent_web else open('/srv/runner-locks/' + lockname, 'w')) as lock:
            if lock is not None:
                fcntl.flock(lock, fcntl.LOCK_EX)
            child = sp.Popen(request['command'], cwd=cwd, env=env,
                             stdin=sp.DEVNULL, start_new_session=True)
            code = child.wait()
            return 128 - code if code < 0 else code
    finally:
        for process in (child, api):
            if process:
                try:
                    os.killpg(process.pid, signal.SIGTERM)
                    process.wait(timeout=8)
                except ProcessLookupError:
                    pass
                except sp.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
        if db_created:
            sp.run(['dropdb', '--if-exists', '--force', '-h', '127.0.0.1', '-U', 'postgres', db])


if __name__ == '__main__':
    sys.exit(main())
