import json
import subprocess
import sys
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
CLI = REPO_ROOT / "context-optimizer" / "context_optimizer_cli.py"


def run_cli(payload):
    return subprocess.run(
        [sys.executable, str(CLI)],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        check=False,
    )


class ContextOptimizerCliTests(unittest.TestCase):
    def test_cli_returns_structured_error_for_invalid_json(self):
        proc = subprocess.run(
            [sys.executable, str(CLI)],
            input="{not-json}",
            text=True,
            capture_output=True,
            check=False,
        )

        data = json.loads(proc.stdout)
        self.assertFalse(data["ok"])
        self.assertEqual(data["error_code"], "invalid_input")

    def test_cli_returns_empty_context_for_empty_docs(self):
        proc = run_cli({"query": "hello", "docs": []})
        data = json.loads(proc.stdout)
        self.assertTrue(data["ok"])
        self.assertEqual(data["optimized_context"], "")


if __name__ == "__main__":
    unittest.main()
