"""Reporter failure paths must stay safe and return useful output."""
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("health", Path(__file__).resolve().parents[2] / "ops/health.py")
health = importlib.util.module_from_spec(spec)
spec.loader.exec_module(health)


class HealthTests(unittest.TestCase):
    def test_all_services_down_still_exits_zero(self):
        env = {**os.environ, "QA_API_URL": "http://127.0.0.1:1/api", "QA_WEB_URL": "http://127.0.0.1:1", "QA_GPU_HEALTH_URL": "http://127.0.0.1:1/health", "DATABASE_URL": "postgresql://qa:secret-placeholder@127.0.0.1:1/qa"}
        result = subprocess.run([sys.executable, str(Path(health.__file__)), "--format", "json"], env=env, capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0)
        self.assertTrue(all(s["status"] == "down" for s in json.loads(result.stdout)["services"].values()))
        self.assertNotIn("secret-placeholder", result.stdout + result.stderr)

    def test_errors_do_not_disclose_connection_details(self):
        with patch.object(health.urllib.request, "urlopen", side_effect=RuntimeError("secret-token")):
            result = health.probe("http://example.invalid")
        self.assertEqual(result["status"], "down")
        self.assertGreaterEqual(result["latency_ms"], 0)
        self.assertNotIn("secret-token", json.dumps(result))

    def test_failed_report_still_returns_zero_and_json(self):
        output = io.StringIO()
        with patch.object(health, "report", side_effect=RuntimeError("secret-password")), patch("sys.argv", ["health.py", "--format", "json"]), patch("sys.stdout", output):
            self.assertEqual(health.main(), 0)
        result = json.loads(output.getvalue())
        self.assertEqual(result["error"], "RuntimeError")
        self.assertNotIn("secret-password", output.getvalue())

    def test_unhealthy_json_is_down_even_with_http_200(self):
        response = io.BytesIO(b'{"ok":false,"build":"test"}')
        with patch.object(health.urllib.request, "urlopen", return_value=response):
            self.assertEqual(health.probe("http://example.invalid", True)["status"], "down")


if __name__ == "__main__":
    unittest.main()
