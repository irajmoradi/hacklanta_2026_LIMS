"""VM-side serialized build, atomic activation, health validation and rollback.

No secret file is opened here. systemd supplies the protected migration environment.
Run via prod-deploy.py; production must already be provisioned by the integrator.
"""
import argparse
import base64
import fcntl
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import shutil
import signal
import stat
import subprocess as sp
import sys
import time
import uuid


class DeploymentInterrupted(Exception):
    """Do not treat an operator/SSH interruption as a retryable health error."""


class Deployment:
    def __init__(self, root=Path('/opt/village'), scratch=False, port=8082):
        self.root = root
        self.releases = root / 'prod-releases'
        self.current = root / 'prod-current'
        self.env = root / 'scratch.env' if scratch else Path('/etc/village/prod.env')
        self.prefix = root.name if scratch else 'village-prod'
        self.scratch = scratch
        self.port = port
        self.units = [self.prefix + '-' + name for name in ('api', 'bridge', 'web')]

    def run(self, args, **kwargs):
        data = kwargs.pop('input', None)
        timeout = kwargs.pop('timeout', None)
        if data is not None:
            kwargs['stdin'] = sp.PIPE
        process = sp.Popen(args, start_new_session=True, **kwargs)
        try:
            stdout, stderr = process.communicate(data, timeout=timeout)
        except BaseException:
            # A killed build shell must not leave Bun/uv writing a removed release.
            try:
                os.killpg(process.pid, signal.SIGTERM)
                process.wait(timeout=5)
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            except sp.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
            raise
        if process.returncode:
            raise sp.CalledProcessError(process.returncode, args)
        return sp.CompletedProcess(args, process.returncode, stdout, stderr)

    def restart(self):
        # Bound a stuck service stop; do not change installed unit definitions.
        # A failed candidate must not exhaust systemd's burst limit for rollback.
        try:
            self.run(['systemctl', 'reset-failed', *self.units],
                     stdout=sp.DEVNULL, stderr=sp.DEVNULL, timeout=5)
        except sp.CalledProcessError:
            # An inactive/unloaded unit has no counters to clear. Restart still
            # must succeed; missing/broken unit definitions are not ignored there.
            pass
        self.run(['systemctl', 'restart', *self.units], timeout=45)

    def stop_limits(self):
        # Persistent compatibility settings, also needed when rolling back to old code.
        # Do not install arbitrary new unit files or change Caddy's configuration.
        units = self.units + ([] if self.scratch else ['village-prod-imessage'])
        for unit in units:
            directory = Path('/etc/systemd/system') / (unit + '.service.d')
            directory.mkdir(exist_ok=True)
            content = '[Service]\nTimeoutStopSec=5\n'
            if unit == 'village-prod-api':
                content += ('ExecStart=\nExecStart=/opt/village/prod-current/apps/api/.venv/bin/python '
                            '-m uvicorn app.main:app --host 127.0.0.1 --port 8012 '
                            '--no-proxy-headers --timeout-graceful-shutdown 3\n')
            candidate = directory / '.deploy-stop-limits.next'
            candidate.write_text(content)
            os.replace(candidate, directory / 'deploy-stop-limits.conf')
        self.run(['systemctl', 'daemon-reload'], timeout=15)

    def probe(self):
        conn = http.client.HTTPConnection('127.0.0.1', self.port, timeout=1)
        try:
            conn.request('GET', '/api/health')
            response = conn.getresponse()
            if response.status != 200:
                raise RuntimeError('HTTP health status')
            health = json.loads(response.read(65536))
            if health.get('ok') is not True or health.get('db') != 'up':
                raise RuntimeError('DB health')
        finally:
            conn.close()
        # A real 101 with verified accept key. Disconnect before auth/presence/writes.
        key = base64.b64encode(os.urandom(16)).decode()
        uid = '00000000-0000-0000-0000-000000000000'
        conn = http.client.HTTPConnection('127.0.0.1', self.port, timeout=1)
        try:
            conn.request('GET', f'/api/houses/{uid}/live?vid={uid}', headers={
                'Connection': 'Upgrade', 'Upgrade': 'websocket',
                'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': key,
            })
            response = conn.getresponse()
            expected = base64.b64encode(hashlib.sha1(
                (key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest()).decode()
            if (response.status != 101 or response.getheader('Sec-WebSocket-Accept') != expected
                    or response.getheader('Upgrade', '').lower() != 'websocket'
                    or 'upgrade' not in response.getheader('Connection', '').lower()):
                raise RuntimeError('House WebSocket upgrade')
        finally:
            conn.close()

    def healthy(self, budget=15):
        deadline = time.monotonic() + budget
        while True:
            try:
                self.probe()
                states = self.run(['systemctl', 'is-active', *self.units],
                                  stdout=sp.PIPE, stderr=sp.DEVNULL, timeout=3, text=True)
                if states.stdout.splitlines() != ['active'] * len(self.units):
                    raise RuntimeError('Not all deployment services are active')
                return
            except (OSError, ValueError, RuntimeError, http.client.HTTPException, sp.SubprocessError):
                if time.monotonic() >= deadline:
                    raise RuntimeError('HTTP/DB/WebSocket/service readiness failed') from None
                time.sleep(0.2)

    def swap(self, target):
        link = self.root / ('prod-current.next-' + uuid.uuid4().hex)
        try:
            link.symlink_to(target)
            os.replace(link, self.current)
        finally:
            link.unlink(missing_ok=True)

    def migrate(self, release):
        unit = self.prefix + '-migrate-' + uuid.uuid4().hex
        try:
            self.run(['systemd-run', '--quiet', '--wait', '--collect',
                  '--unit=' + unit,
                  '-p', 'User=village-prod', '-p', 'Group=village-prod',
                  '-p', 'WorkingDirectory=' + str(release / 'apps/api'),
                  '-p', 'EnvironmentFile=' + str(self.env),
                  '-p', 'Environment=VILLAGE_ENV_FILE=/dev/null',
                  '-p', 'RuntimeMaxSec=120', '-p', 'TimeoutStopSec=5',
                  '-p', 'StandardOutput=null', '-p', 'StandardError=null',
                  # Migrations, then the additive catalog sync (production is never seeded; new
                  # catalog items such as ASSET-013 wearables only reach the DB through this step).
                  '/bin/sh', '-c', 'set -e; PY="$0"; "$PY" scripts/migrate.py; PYTHONPATH=. "$PY" scripts/sync_catalog.py',
                  str(release / 'apps/api/.venv/bin/python')],
                 timeout=135, stdout=sp.DEVNULL, stderr=sp.DEVNULL)
        finally:
            # Stop an interrupted/timed-out migration before removing its release.
            sp.run(['systemctl', 'stop', unit], stdout=sp.DEVNULL, stderr=sp.DEVNULL, timeout=15)

    def prune(self, previous):
        # Successful activation time, not directory/build mtime. Preserve rollback target.
        candidates = [p for p in self.releases.iterdir() if re.fullmatch('[a-f0-9]{40}', p.name)
                      and p.is_dir() and not p.is_symlink()]
        def activated(p):
            marker = p / '.deploy-success'
            return marker.stat().st_mtime if marker.exists() else p.stat().st_mtime
        keep = {self.current.resolve(), previous}
        for path in sorted(candidates, key=activated, reverse=True):
            if len(keep) < 3:
                keep.add(path)
            elif path not in keep:
                shutil.rmtree(path)

    def deploy(self, sha, incoming, public):
        started = time.monotonic()
        with (self.root / 'prod-deploy.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            previous = self.current.resolve(strict=True)
            if (not self.current.is_symlink() or previous.parent != self.releases
                    or not re.fullmatch('[a-f0-9]{40}', previous.name)):
                raise RuntimeError('Existing current release must be a managed SHA symlink')
            mode = self.env.lstat()
            if not stat.S_ISREG(mode.st_mode) or mode.st_uid != 0 or stat.S_IMODE(mode.st_mode) != 0o600:
                raise RuntimeError('Protected environment must be root-owned regular file mode 600')
            release = self.releases / sha
            if release.exists() or release.is_symlink():
                raise RuntimeError('Release already exists; use a new commit (never overwrite a release)')
            incoming.rename(release)
            release.chmod(0o755)
            try:
                print(f'Building release {sha}; serving {previous.name}', flush=True)
                self.run(['chown', '-R', 'village-prod:village-prod', str(release)])
                self.run(['bash', str(release / 'ops/deploy/prod-build.sh'), str(release)],
                         input=public, timeout=1800)
                self.run(['chown', '-R', 'root:root', str(release)])
                print(f'Build complete; current release kept serving. elapsed={time.monotonic()-started:.2f}s', flush=True)
                migration = time.monotonic()
                print('Running protected migration with current release still serving.', flush=True)
                self.migrate(release)
                print(f'Migration complete; elapsed={time.monotonic()-migration:.2f}s', flush=True)
                self.stop_limits()
            except BaseException:
                shutil.rmtree(release)
                raise
            activation = time.monotonic()
            try:
                print('Activating release and checking HTTP/DB/house WebSocket readiness.', flush=True)
                self.swap(release)
                self.restart()
                self.healthy()
            except BaseException:
                # Also recover on SIGTERM/SIGHUP/interrupt. Ignore a second signal during recovery.
                for sig in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
                    signal.signal(sig, signal.SIG_IGN)
                try:
                    self.swap(previous)
                    self.restart()
                    self.healthy()
                except BaseException:
                    raise RuntimeError('ROLLBACK FAILED; releases retained; inspect service health on VM') from None
                shutil.rmtree(release)
                print(f'ROLLBACK healthy; activation/recovery={time.monotonic()-activation:.2f}s', flush=True)
                raise RuntimeError('Activation failed; previous release restored') from None
            elapsed = time.monotonic() - activation
            (release / '.deploy-success').touch()
            self.prune(previous)
            print(f'DEPLOY OK {sha}; restart-to-healthy={elapsed:.2f}s; total={time.monotonic()-started:.2f}s', flush=True)
            if elapsed >= 10:
                print('NOTICE: restart-to-healthy exceeded the 10s target.', flush=True)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('sha')
    p.add_argument('incoming', type=Path)
    p.add_argument('--scratch-root', type=Path, help='Isolated /opt/village/deploy002-* rehearsal only')
    p.add_argument('--scratch-port', type=int, default=18082)
    a = p.parse_args()
    if os.geteuid() != 0 or not re.fullmatch('[a-f0-9]{40}', a.sha):
        p.error('Require root and a full lowercase commit SHA')
    if (a.incoming.parent != Path('/tmp') or not re.fullmatch(r'village-prod\.[a-zA-Z0-9]+', a.incoming.name)
            or a.incoming.is_symlink() or not a.incoming.is_dir()):
        p.error('Unexpected incoming source directory')
    root = a.scratch_root or Path('/opt/village')
    if a.scratch_root and (root.parent != Path('/opt/village') or root.is_symlink()
                          or not re.fullmatch('deploy002-[a-z0-9]+', root.name)
                          or not 18000 <= a.scratch_port <= 18999):
        p.error('Unsafe scratch namespace/port')
    public = b''.join(sys.stdin.buffer.readline() for _ in range(4))
    parts = public.splitlines()
    if len(parts) not in (3, 4) or any(not s for s in parts[:3]):
        p.error('Three public Auth0 settings and optional enable flag required')
    if len(parts) == 4 and parts[3] not in (b'0', b'1'):
        p.error('Auth0 enable flag must be 0 or 1')
    def interrupted(signum, frame):
        raise DeploymentInterrupted('Deployment interrupted')
    for sig in (signal.SIGHUP, signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, interrupted)
    try:
        Deployment(root, bool(a.scratch_root), a.scratch_port if a.scratch_root else 8082).deploy(a.sha, a.incoming, public)
    except Exception as exc:
        # Never echo subprocess output/commands that could include service credentials.
        print(f'DEPLOY FAILED ({type(exc).__name__}): {str(exc) if isinstance(exc, RuntimeError) else "see deployment phase above"}', file=sys.stderr)
        return 1
    finally:
        if a.incoming.exists():
            shutil.rmtree(a.incoming)
    return 0


if __name__ == '__main__':
    sys.exit(main())
