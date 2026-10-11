"""Run from apps/api through remote_run.sh --with-api (disposable DB only)."""
import importlib.util
import os
from pathlib import Path
import socket
import subprocess as sp
import time
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('release', HERE / 'prod-release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


def main():
    dsn = os.environ.get('DATABASE_URL', '')
    assert dsn.startswith('postgresql://postgres@127.0.0.1:5432/run_'), 'Disposable runner DB required'
    base = urlsplit(os.environ['VILLAGE_API_URL'])
    assert base.hostname == '127.0.0.1'
    release.Deployment(port=base.port).probe()
    print('PASS: production health/house upgrade probe against actual scratch API', flush=True)
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    api = sp.Popen(['.venv/bin/python', '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1',
                    '--port', str(port), '--timeout-graceful-shutdown', '3', '--no-proxy-headers'],
                   stdout=sp.DEVNULL, stderr=sp.DEVNULL)
    ws = None
    try:
        deadline = time.monotonic() + 15
        while True:
            try:
                release.Deployment(port=port).probe()
                break
            except Exception:
                assert api.poll() is None and time.monotonic() < deadline
                time.sleep(0.1)
        ws = socket.create_connection(('127.0.0.1', port), timeout=5)
        uid = '00000000-0000-0000-0000-000000000000'
        ws.sendall((f'GET /api/houses/{uid}/live?vid={uid} HTTP/1.1\r\n'
                    f'Host: 127.0.0.1:{port}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n'
                    'Sec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n').encode())
        assert b'101 Switching Protocols' in ws.recv(4096)
        started = time.monotonic()
        api.terminate()
        api.wait(timeout=5)
        elapsed = time.monotonic() - started
        assert elapsed < 5
        print(f'PASS: actual Uvicorn stops with an open, non-cooperating house socket in {elapsed:.2f}s', flush=True)
    finally:
        if ws: ws.close()
        if api.poll() is None:
            api.kill()
            api.wait()


if __name__ == '__main__':
    main()
