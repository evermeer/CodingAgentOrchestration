import json
import subprocess
import sys
import unittest
import tempfile
import shutil
import textwrap
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
CLI = REPO_ROOT / "context-optimizer" / "support-files" / "context_optimizer_cli.py"


def run_cli(payload, cli_path=CLI):
    return subprocess.run(
        [sys.executable, str(cli_path)],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        check=False,
    )


def run_cli_raw(raw_input, cli_path=CLI):
    return subprocess.run(
        [sys.executable, str(cli_path)],
        input=raw_input,
        text=True,
        capture_output=True,
        check=False,
    )


def run_cli_with_stub(payload, stub_source):
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        temp_cli = temp_path / "context_optimizer_cli.py"
        temp_module = temp_path / "context_optimizer.py"

        shutil.copy2(CLI, temp_cli)
        temp_module.write_text(textwrap.dedent(stub_source), encoding="utf-8")

        return run_cli(payload, cli_path=temp_cli)


def run_cli_raw_with_stub(raw_input, stub_source):
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        temp_cli = temp_path / "context_optimizer_cli.py"
        temp_module = temp_path / "context_optimizer.py"

        shutil.copy2(CLI, temp_cli)
        temp_module.write_text(textwrap.dedent(stub_source), encoding="utf-8")

        return run_cli_raw(raw_input, cli_path=temp_cli)


class ContextOptimizerCliTests(unittest.TestCase):
    def test_cli_returns_structured_error_for_invalid_json(self):
        proc = run_cli_raw_with_stub(
            "{not-json}",
            """
            class ContextOptimizer:
                def __init__(self, **kwargs):
                    pass

                def optimize(self, query, graph_ctx=None, memory_ctx=None):
                    return "stub"
            """,
        )

        data = json.loads(proc.stdout)
        self.assertFalse(data["ok"])
        self.assertEqual(data["error_code"], "invalid_input")
        self.assertNotEqual(proc.returncode, 0)

    def test_cli_returns_empty_context_for_empty_docs(self):
        proc = run_cli_with_stub(
            {"query": "hello", "docs": []},
            """
            class ContextOptimizer:
                def __init__(self, **kwargs):
                    pass

                def optimize(self, query, graph_ctx=None, memory_ctx=None):
                    return "stub"
            """,
        )
        data = json.loads(proc.stdout)
        self.assertTrue(data["ok"])
        self.assertEqual(data["status"], "no_optimization")
        self.assertEqual(data["optimized_context"], "")

    def test_cli_returns_structured_error_for_invalid_docs_type(self):
        proc = run_cli_with_stub(
            {"query": "hello", "docs": "not-a-list"},
            """
            class ContextOptimizer:
                def __init__(self, **kwargs):
                    pass

                def optimize(self, query, graph_ctx=None, memory_ctx=None):
                    return "stub"
            """,
        )

        data = json.loads(proc.stdout)
        self.assertFalse(data["ok"])
        self.assertEqual(data["error_code"], "invalid_input")
        self.assertNotEqual(proc.returncode, 0)

    def test_cli_skips_optimization_below_threshold(self):
        proc = run_cli_with_stub(
            {"query": "hello", "docs": ["alpha", "beta"], "options": {"min_input_size": 100}},
            """
            class ContextOptimizer:
                def __init__(self, **kwargs):
                    self.kwargs = kwargs

                def optimize(self, query, graph_ctx=None, memory_ctx=None):
                    return "should not be called"
            """,
        )

        data = json.loads(proc.stdout)
        self.assertTrue(data["ok"])
        self.assertEqual(data["status"], "no_optimization")
        self.assertIn("below the threshold", data["reason"])
        self.assertEqual(data["optimized_context"], "")
        self.assertEqual(data["initial_size"], 9)
        self.assertEqual(data["final_size"], 9)
        self.assertEqual(proc.returncode, 0)

    def test_cli_rejects_mixed_docs_lists(self):
        proc = run_cli_with_stub(
            {"query": "hello", "docs": ["alpha", 123, None]},
            """
            class ContextOptimizer:
                def __init__(self, **kwargs):
                    pass

                def optimize(self, query, graph_ctx=None, memory_ctx=None):
                    return "stub"
            """,
        )

        data = json.loads(proc.stdout)
        self.assertFalse(data["ok"])
        self.assertEqual(data["error_code"], "invalid_input")
        self.assertNotEqual(proc.returncode, 0)

    def test_cli_uses_stubbed_optimizer_for_happy_path(self):
        proc = run_cli_with_stub(
            {"query": "hello", "docs": ["alpha", "beta"], "options": {"compression_rate": 0.25}},
            """
            class ContextOptimizer:
                def __init__(self, **kwargs):
                    self.kwargs = kwargs

                def optimize(self, query, graph_ctx=None, memory_ctx=None):
                    return f"{query}:{'|'.join(graph_ctx)}:{self.kwargs['compression_rate']}"
            """,
        )

        data = json.loads(proc.stdout)
        self.assertTrue(data["ok"])
        self.assertEqual(data["optimized_context"], "hello:alpha|beta:0.25")
        self.assertEqual(data["initial_size"], 9)
        self.assertEqual(data["final_size"], len("hello:alpha|beta:0.25"))
        self.assertEqual(proc.returncode, 0)

    def test_cli_does_not_forward_min_input_size_to_constructor(self):
        proc = run_cli_with_stub(
            {"query": "hello", "docs": ["alpha" * 300, "beta" * 300], "options": {"min_input_size": 100, "compression_rate": 0.25}},
            """
            class ContextOptimizer:
                def __init__(self, **kwargs):
                    self.kwargs = kwargs

                def optimize(self, query, graph_ctx=None, memory_ctx=None, docs=None, model=None, options=None):
                    return f"{self.kwargs.get('min_input_size')}:{options['compression_rate']}"
            """,
        )

        data = json.loads(proc.stdout)
        self.assertTrue(data["ok"])
        self.assertEqual(data["optimized_context"], "None:0.25")
        self.assertEqual(proc.returncode, 0)

    def test_cli_exposes_model_and_policy_inputs_to_optimizer(self):
        proc = run_cli_with_stub(
            {
                "query": "hello",
                "docs": ["alpha", "beta"],
                "model": "gpt-4o-mini",
                "options": {"compression_rate": 0.25, "protected_prefixes": ["protected:"]},
            },
            """
            class ContextOptimizer:
                def __init__(self, **kwargs):
                    self.kwargs = kwargs

                def optimize(self, query, graph_ctx=None, memory_ctx=None, docs=None, model=None, options=None):
                    return f"{model}:{options['compression_rate']}:{options['protected_prefixes'][0]}"
            """,
        )

        data = json.loads(proc.stdout)
        self.assertTrue(data["ok"])
        self.assertEqual(data["optimized_context"], "gpt-4o-mini:0.25:protected:")
        self.assertEqual(proc.returncode, 0)

    def test_cli_returns_non_zero_for_runtime_error(self):
        proc = run_cli_with_stub(
            {"query": "hello", "docs": ["alpha"]},
            """
            class ContextOptimizer:
                def __init__(self, **kwargs):
                    pass

                def optimize(self, query, graph_ctx=None, memory_ctx=None):
                    raise RuntimeError("boom")
            """,
        )

        data = json.loads(proc.stdout)
        self.assertFalse(data["ok"])
        self.assertEqual(data["error_code"], "runtime_error")
        self.assertNotEqual(proc.returncode, 0)

    def test_cli_returns_non_zero_when_dependency_is_missing(self):
        proc = run_cli(
            {"query": "hello", "docs": ["alpha"]},
            cli_path=Path(tempfile.mkdtemp()) / "missing_cli.py",
        )

        self.assertNotEqual(proc.returncode, 0)


if __name__ == "__main__":
    unittest.main()
