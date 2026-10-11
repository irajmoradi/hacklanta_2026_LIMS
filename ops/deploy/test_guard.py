"""Exercise libpq DSN parsing and process launch guards without any network I/O."""
import os
from pathlib import Path
import runpy
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).with_name("api-start.py")
SAFE = "postgresql://postgres@127.0.0.1:55432/village_stage"


class GuardTests(unittest.TestCase):
    def test_rejects_live_ambiguous_and_redirected_targets(self):
        for dsn in ("", "invalid", SAFE.replace("55432", "5432"),
                    SAFE.replace("village_stage", "village_live"),
                    SAFE.replace("127.0.0.1", "example.invalid"),
                    SAFE + "?hostaddr=203.0.113.5", SAFE + "?service=production",
                    "host=127.0.0.1,example.invalid port=55432 dbname=village_stage user=postgres"):
            with self.subTest(dsn=dsn), patch.dict(os.environ, {"DATABASE_URL": dsn}, clear=True), patch("os.execv") as launch:
                with self.assertRaises(SystemExit):
                    runpy.run_path(str(SCRIPT), run_name="__main__")
                launch.assert_not_called()

    def test_scratch_launch_suppresses_paid_keys_and_scheduler(self):
        with patch.dict(os.environ, {"DATABASE_URL": SAFE, "GOOGLE_API_KEY": "synthetic",
                                     "ELEVENLABS_API_KEY": "synthetic", "OPENROUTER_API_KEY": "synthetic",
                                     "MAYOR_SCHEDULER": "1", "DEMO_DEBUG": "1",
                                     "PGHOSTADDR": "203.0.113.5", "PGSERVICE": "production",
                                     "GPU_WORKER_URL": "http://127.0.0.1:1"}, clear=True), patch("os.execv") as launch:
            runpy.run_path(str(SCRIPT), run_name="__main__")
            launch.assert_called_once()
            self.assertEqual(os.environ["DATABASE_URL"], SAFE)
            self.assertEqual(os.environ["MAYOR_SCHEDULER"], "0")
            self.assertEqual(os.environ["DEMO_DEBUG"], "0")
            self.assertEqual(os.environ["VILLAGE_ENV_FILE"], "/dev/null")
            self.assertEqual(os.environ["GPU_WORKER_URL"], "http://127.0.0.1:1")
            self.assertNotIn("PGHOSTADDR", os.environ)
            self.assertNotIn("PGSERVICE", os.environ)
            self.assertFalse(any(k in os.environ for k in ("GOOGLE_API_KEY", "ELEVENLABS_API_KEY", "OPENROUTER_API_KEY")))


if __name__ == "__main__":
    unittest.main()
