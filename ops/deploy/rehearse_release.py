"""Root-only front-VM rehearsal with disposable systemd services; never production.

Uses synthetic HTTP/WS services, migration and build fixtures to exercise the actual
deployment controller. No DB/password/provider/production env access. Cleans up.
"""
import importlib.util
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess as sp
import time
import uuid

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('release', HERE / 'prod-release.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

SERVER = r'''
import base64, hashlib, http.client, json, sys, signal
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
kind, port, upstream = sys.argv[1:]
mode = Path(__file__).with_name('mode').read_text()
if mode == 'stubborn':
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
if mode == 'restart':
    sys.exit(1)
class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    def log_message(self, *args): pass
    def do_GET(self):
        if kind == 'proxy':
            c = http.client.HTTPConnection('127.0.0.1', int(upstream), timeout=1)
            try:
                c.request('GET', self.path, headers=dict(self.headers))
                r = c.getresponse()
                self.send_response(r.status)
                for k, v in r.getheaders(): self.send_header(k, v)
                self.end_headers()
                if r.status != 101: self.wfile.write(r.read())
            except OSError:
                self.close_connection = True
            finally: c.close()
        elif self.path == '/api/health':
            body = json.dumps({'ok': True, 'db': 'down' if mode == 'health' else 'up'}).encode()
            self.send_response(200)
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path.startswith('/api/houses/') and mode != 'websocket':
            key = self.headers['Sec-WebSocket-Key']
            accept = base64.b64encode(hashlib.sha1((key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest()).decode()
            self.send_response(101)
            self.send_header('Connection', 'Upgrade')
            self.send_header('Upgrade', 'websocket')
            self.send_header('Sec-WebSocket-Accept', accept)
            self.end_headers()
        else:
            self.send_response(404)
            self.send_header('Content-Length', '0')
            self.end_headers()
ThreadingHTTPServer(('127.0.0.1', int(port)), Handler).serve_forever()
'''


def run(*args):
    return sp.run(args, check=True, stdout=sp.DEVNULL, stderr=sp.DEVNULL)


def free_port():
    for port in range(18100, 18999):
        with socket.socket() as sock:
            try:
                sock.bind(('127.0.0.1', port))
            except OSError:
                continue
            return port
    raise RuntimeError('No scratch port')


def main():
    assert os.geteuid() == 0
    root = Path('/opt/village/deploy002-' + uuid.uuid4().hex[:10])
    root.mkdir(mode=0o755)
    state = root / 'state'
    state.mkdir()
    run('chown', 'village-prod:village-prod', str(state))
    releases = root / 'prod-releases'
    releases.mkdir()
    env = root / 'scratch.env'
    env.write_text('DEPLOY_REHEARSAL_SENTINEL=synthetic\n')
    env.chmod(0o600)
    api_port = free_port()
    # Hold API port until selecting a distinct web port.
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', api_port))
        web_port = free_port()
    deployment = module.Deployment(root, True, web_port)
    incoming_dirs = []
    unit_files = []

    def fixture(path, mode='ok', delay=0.1):
        api = path / 'apps/api'
        (api / '.venv/bin').mkdir(parents=True)
        (api / '.venv/bin/python').symlink_to('/usr/bin/python3')
        (api / 'scripts').mkdir()
        (api / 'server.py').write_text(SERVER)
        (api / 'mode').write_text(mode)
        (api / 'scripts/migrate.py').write_text(
            'import os\nfrom pathlib import Path\n'
            'assert os.environ["DEPLOY_REHEARSAL_SENTINEL"] == "synthetic"\n'
            'assert os.environ["VILLAGE_ENV_FILE"] == "/dev/null"\n'
            + ('raise RuntimeError("synthetic migration failure")\n' if mode == 'migration' else
               f'Path({str(state / "migrated")!r}).touch()\n'))
        deploy = path / 'ops/deploy'
        deploy.mkdir(parents=True)
        (deploy / 'prod-build.sh').write_text(
            '#!/bin/bash\nset -eu\nread -r a; read -r b; read -r c\n'
            f'touch {state}/building\nsleep {delay}\nrm {state}/building\n'
            + ('exit 1\n' if mode == 'build' else 'true\n'))

    def launch(n, mode='ok', delay=0.1):
        incoming = Path('/tmp/village-prod.' + uuid.uuid4().hex)
        incoming.mkdir(mode=0o700)
        incoming_dirs.append(incoming)
        fixture(incoming, mode, delay)
        process = sp.Popen(['python3', str(HERE / 'prod-release.py'), f'{n:040x}', str(incoming),
                           '--scratch-root', str(root), '--scratch-port', str(web_port)],
                          stdin=sp.PIPE, stdout=sp.PIPE, stderr=sp.STDOUT, text=True)
        process.stdin.write('synthetic\nsynthetic\nsynthetic\n')
        process.stdin.close()
        return process

    def finish(process, expected):
        output = process.stdout.read()
        code = process.wait(timeout=90)
        print(output, end='', flush=True)
        assert (code == 0) == expected, (code, expected)
        deployment.healthy(5)

    try:
        initial = releases / ('a' * 40)
        fixture(initial, 'stubborn')
        deployment.current.symlink_to(initial)
        for unit, command in zip(deployment.units, [
            f'/usr/bin/python3 {deployment.current}/apps/api/server.py api {api_port} 0',
            '/usr/bin/sleep infinity',
            f'/usr/bin/python3 {deployment.current}/apps/api/server.py proxy {web_port} {api_port}',
        ]):
            path = Path('/etc/systemd/system') / (unit + '.service')
            unit_files.append(path)
            path.write_text('[Unit]\nDescription=DEPLOY-002 disposable rehearsal\n'
                            '[Service]\nUser=village-prod\nGroup=village-prod\n'
                            f'ExecStart={command}\nTimeoutStopSec=2\n')
        run('systemctl', 'daemon-reload')
        deployment.restart()
        deployment.healthy(5)
        # Observe actual old health and unchanged PIDs during a deliberately slow build.
        before = sp.check_output(['systemctl', 'show', '-p', 'MainPID', *deployment.units])
        process = launch(1, delay=3)
        deadline = time.monotonic() + 10
        while not (state / 'building').exists():
            if process.poll() is not None or time.monotonic() >= deadline:
                raise AssertionError(process.stdout.read())
            time.sleep(0.05)
        for _ in range(8):
            deployment.probe()
            assert sp.check_output(['systemctl', 'show', '-p', 'MainPID', *deployment.units]) == before
            time.sleep(0.15)
        finish(process, True)
        assert (state / 'migrated').exists()
        print('PASS: old services/HTTP/WS remain live throughout build; protected migration env', flush=True)
        for n, mode in enumerate(('build', 'migration', 'health', 'websocket', 'restart'), 2):
            previous = deployment.current.resolve()
            finish(launch(n, mode), False)
            assert deployment.current.resolve() == previous
            assert not (releases / f'{n:040x}').exists()
            print(f'PASS: {mode} failure preserves/restores healthy previous release', flush=True)
        # A failed SHA may be retried; successful SHA must never be overwritten.
        finish(launch(2), True)
        finish(launch(2), False)
        first, second = launch(7, delay=2), launch(8, delay=2)
        finish(first, True)
        finish(second, True)
        assert deployment.current.resolve().name in (f'{7:040x}', f'{8:040x}')
        assert len(list(releases.iterdir())) == 3
        print('PASS: concurrent deployments serialize, failed SHA retry, immutable releases, retention=3', flush=True)
        previous = deployment.current.resolve()
        process = launch(9, mode='websocket')
        deadline = time.monotonic() + 10
        while deployment.current.resolve() == previous:
            assert process.poll() is None and time.monotonic() < deadline
            time.sleep(0.05)
        time.sleep(1)  # Interrupt readiness retries, not just the restart subprocess.
        process.send_signal(signal.SIGTERM)
        finish(process, False)
        assert deployment.current.resolve() == previous
        print('PASS: interrupted activation restores healthy previous release', flush=True)
    finally:
        sp.run(['systemctl', 'stop', *deployment.units], stdout=sp.DEVNULL, stderr=sp.DEVNULL)
        for path in unit_files:
            path.unlink(missing_ok=True)
            directory = path.with_name(path.name + '.d')
            if directory.exists(): shutil.rmtree(directory)
        run('systemctl', 'daemon-reload')
        sp.run(['systemctl', 'reset-failed', *deployment.units], stdout=sp.DEVNULL, stderr=sp.DEVNULL)
        for path in incoming_dirs:
            if path.exists(): shutil.rmtree(path)
        shutil.rmtree(root)
        print('Scratch services, releases and synthetic environment removed.', flush=True)


if __name__ == '__main__':
    main()
