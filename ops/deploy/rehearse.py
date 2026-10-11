"""Local Docker fixture -> SSH restore -> VM checks -> drop both scratch DBs."""
from pathlib import Path
import os
import shutil
import subprocess as sp
import tempfile
import time

root = Path(__file__).resolve().parents[2]
here = root / 'ops/deploy'
db = 'village_rehearsal_' + str(int(time.time()))
ssh = ['ssh', '-o', 'BatchMode=yes', '-i', str(Path.home() / '.ssh/village_vultr'), 'root@207.246.81.187']
remote = '/opt/village/prod-current/ops/deploy'
def local(command, **kwargs):
    return sp.run(['docker', 'exec', '-i', 'village-db', 'sh', '-c', command, '_', db], check=True, **kwargs)
created_local = created_remote = False
env = {**os.environ, 'MSYS_NO_PATHCONV': '1'}
bash = shutil.which('bash')  # Absolute path avoids Windows' System32 WSL bash.
try:
    local('createdb -U "$POSTGRES_USER" "$1"')
    created_local = True
    for path in [root / 'packages/contracts/schema.sql', here / 'rehearsal_fixture.sql']:
        local('psql -X -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1"', input=path.read_bytes(), stdout=sp.DEVNULL)
    sp.run(ssh + [f'bash {remote}/db_remote.sh create {db}'], check=True)
    created_remote = True
    sp.run([bash, (here / 'db_cutover.sh').as_posix(), 'rehearsal', db, db], check=True, env=env)
    with tempfile.TemporaryDirectory(prefix='village-cutover-assets-') as tmp:
        asset = Path(tmp) / 'avatars/13370000-0000-4000-8000-000000000001/probe.txt'
        asset.parent.mkdir(parents=True)
        asset.write_text('Synthetic cutover asset\n')
        source = tmp.replace('\\', '/')
        if os.name == 'nt':
            source = '/' + source[0].lower() + source[2:]
        for _ in range(2):
            sp.run([bash, (here / 'sync_assets.sh').as_posix(), source, '/var/lib/village-prod/rehearsal-assets-cutover001'], check=True, env=env)
        sp.run(ssh + [f'python3 {remote}/rehearse_vm.py {db}'], check=True)
finally:
    if created_remote:
        sp.run(ssh + [f'bash {remote}/db_remote.sh drop {db}'], check=True)
    if created_local:
        local('dropdb -U "$POSTGRES_USER" "$1"')
    # Exact known scratch directory only; no production asset deletion.
    sp.run(ssh + ["python3 -c \"from pathlib import Path; import shutil; p=Path('/var/lib/village-prod/rehearsal-assets-cutover001'); assert p.resolve()==p; shutil.rmtree(p) if p.exists() else None\""], check=True)
print('PASS: rehearsal completed; local/VM scratch databases and test assets removed')
