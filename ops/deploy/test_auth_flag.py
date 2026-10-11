"""Offline release-input checks. Never deploys, connects, or touches a release."""
import importlib.util
import io
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

if sys.platform == 'win32':
    sys.modules.setdefault('fcntl', types.ModuleType('fcntl'))
spec = importlib.util.spec_from_file_location('auth_flag_release', Path(__file__).with_name('prod-release.py'))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class AuthFlagTests(unittest.TestCase):
    def run_input(self, body):
        with (patch.object(sys, 'argv', ['release', 'a'*40, '/tmp/village-prod.synthetic']),
              patch.object(sys, 'stdin', types.SimpleNamespace(buffer=io.BytesIO(body))),
              patch.object(release.os, 'geteuid', return_value=0, create=True),
              patch.object(Path, 'is_symlink', return_value=False),
              patch.object(Path, 'is_dir', return_value=True),
              patch.object(Path, 'exists', return_value=False),
              patch.object(release.signal, 'signal'),
              patch.object(release.signal, 'SIGHUP', 1, create=True),
              patch.object(release.Deployment, 'deploy') as deploy):
            result = release.main()
            self.assertEqual(result, 0)
            self.assertEqual(deploy.call_args.args[2], body)

    def test_backward_compatible_three_values(self):
        self.run_input(b'domain\nclient\naudience\n')

    def test_enable_and_disable_reach_build_unchanged(self):
        for flag in (b'0', b'1'):
            self.run_input(b'domain\nclient\naudience\n'+flag+b'\n')

    def test_invalid_flag_rejected(self):
        with self.assertRaises(SystemExit) as error:
            self.run_input(b'domain\nclient\naudience\ninvalid\n')
        self.assertEqual(error.exception.code, 2)


if __name__ == '__main__':
    unittest.main()
