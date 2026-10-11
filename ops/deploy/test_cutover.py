"""Offline safety regressions; no SSH, database writes, credentials or providers."""
import importlib.util
from pathlib import Path
import subprocess
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('switch', HERE / 'caddy_switch.py')
switch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(switch)
LIVE = '''207-246-81-187.sslip.io {
  encode gzip
  @houselive path_regexp ^/api/houses/[^/]+/live$
  handle @houselive {
    reverse_proxy 127.0.0.1:8090
  }
  handle {
    reverse_proxy 127.0.0.1:8080
  }
}

import /etc/caddy/village-stage.Caddyfile
'''

class CutoverTests(unittest.TestCase):
    def test_site_replacement_preserves_staging(self):
        new = switch.candidate(LIVE)
        self.assertNotIn(':8090', new)
        self.assertNotIn(':8080', new)
        self.assertEqual(new.count('reverse_proxy 127.0.0.1:8082'), 1)
        self.assertEqual(new[new.index('\n\nimport'):], LIVE[LIVE.index('\n\nimport'):])

    def test_refuses_ambiguous_changed_or_already_switched_config(self):
        for text in [LIVE + LIVE, LIVE.replace(':8090', ':8099'), switch.candidate(LIVE), LIVE.replace('sslip.io', 'other.io')]:
            with self.assertRaises(ValueError):
                switch.candidate(text)

    def test_shell_syntax(self):
        for path in HERE.glob('*.sh'):
            subprocess.run(['bash', '-n'], input=path.read_bytes(), check=True)

    def test_no_secret_values_in_example(self):
        for line in (HERE / 'prod.env.example').read_text().splitlines():
            self.assertRegex(line, r'^[A-Z][A-Z0-9_]*=$')

if __name__ == '__main__':
    unittest.main()
