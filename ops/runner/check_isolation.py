"""Run with remote_run.sh --with-api --env RUNNER_CANARY python ..."""
import os
from pathlib import Path
import urllib.request

assert os.environ['RUNNER_CANARY'] == 'synthetic value with spaces $ and quotes\"'
assert 'RUNNER_UNREQUESTED' not in os.environ
assert os.environ['VILLAGE_ENV_FILE'] == '/dev/null'
assert os.environ['MAYOR_SCHEDULER'] == '0'
assert '/run_' in os.environ['DATABASE_URL']
assert os.environ['VILLAGE_TEST_DATABASE_URL'].endswith('/village_test')
url = os.environ['VILLAGE_API_URL']
assert url.startswith('http://127.0.0.1:') and not url.endswith(':8010')
with urllib.request.urlopen(url + '/api/health') as response:
    assert response.status == 200
root = Path(__file__).resolve().parents[2]
assert not (root / '.env').exists()
output = root / 'ops/runner/.runtime/artifacts/isolation.txt'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text('Disposable API health, scratch DSNs, env allowlist and argv encoding passed.\n')
print(output.read_text().strip())
