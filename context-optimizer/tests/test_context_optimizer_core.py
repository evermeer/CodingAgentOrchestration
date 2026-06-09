import importlib.util
import contextlib
import io
import sys
import types
import unittest
from pathlib import Path
from typing import Any, cast


REPO_ROOT = Path(__file__).resolve().parents[2]
CORE = REPO_ROOT / "context-optimizer" / "support-files" / "context_optimizer.py"
HOOK = REPO_ROOT / "context-optimizer" / "support-files" / "context_optimizer_hook.py"


class _Score:
    def __init__(self, value):
        self._value = value

    def item(self):
        return self._value


def load_core_module():
    fake_sentence_transformers = cast(Any, types.ModuleType("sentence_transformers"))

    class FakeCrossEncoder:
        def __init__(self, model_name, **kwargs):
            self.model_name = model_name
            self.kwargs = kwargs

        def predict(self, pairs):
            score_map = {
                "beta": 3,
                "alpha": 2,
                "gamma": 1,
            }
            return [score_map.get(doc, 0) for _, doc in pairs]

    class FakeSentenceTransformer:
        def __init__(self, model_name, **kwargs):
            self.model_name = model_name
            self.kwargs = kwargs

        def encode(self, docs, convert_to_tensor=True):
            return list(docs)

    def fake_cos_sim(left, right):
        return _Score(1.0 if left == right else 0.0)

    setattr(fake_sentence_transformers, "CrossEncoder", FakeCrossEncoder)
    setattr(fake_sentence_transformers, "SentenceTransformer", FakeSentenceTransformer)
    setattr(fake_sentence_transformers, "util", types.SimpleNamespace(cos_sim=fake_cos_sim))

    fake_llmlingua = cast(Any, types.ModuleType("llmlingua"))

    class FakePromptCompressor:
        def __init__(self, model_name, **kwargs):
            self.model_name = model_name
            self.kwargs = kwargs

        def compress_prompt(self, combined, rate):
            return {"compressed_prompt": f"{'\n\n'.join(combined)} [rate={rate}]"}

    setattr(fake_llmlingua, "PromptCompressor", FakePromptCompressor)

    original_sentence_transformers = sys.modules.get("sentence_transformers")
    original_llmlingua = sys.modules.get("llmlingua")
    sys.modules["sentence_transformers"] = fake_sentence_transformers
    sys.modules["llmlingua"] = fake_llmlingua

    spec = importlib.util.spec_from_file_location("context_optimizer_under_test", CORE)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    if original_sentence_transformers is not None:
        sys.modules["sentence_transformers"] = original_sentence_transformers
    else:
        del sys.modules["sentence_transformers"]

    if original_llmlingua is not None:
        sys.modules["llmlingua"] = original_llmlingua
    else:
        del sys.modules["llmlingua"]

    return module


def load_hook_module(context_optimizer_module):
    original_module = sys.modules.get("context_optimizer")
    sys.modules["context_optimizer"] = context_optimizer_module

    spec = importlib.util.spec_from_file_location("context_optimizer_hook_under_test", HOOK)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    if original_module is not None:
        sys.modules["context_optimizer"] = original_module
    else:
        del sys.modules["context_optimizer"]

    return module


class ContextOptimizerCoreTests(unittest.TestCase):
    def test_context_optimizer_initialization_logs_device_and_models(self):
        module = load_core_module()
        stderr = io.StringIO()

        with contextlib.redirect_stderr(stderr):
            optimizer = module.ContextOptimizer()

        self.assertIsNotNone(optimizer)
        output = stderr.getvalue()
        self.assertIn("initializing optimizer", output)
        self.assertRegex(output, r"device=(cuda|cpu)")
        self.assertIn("reranker=", output)
        self.assertIn("compressor=", output)

    def test_optimize_reranks_and_compresses_combined_context(self):
        module = load_core_module()
        optimizer = module.ContextOptimizer(compression_rate=0.25, max_chunks=2)

        result = optimizer.optimize(
            query="best chunk",
            graph_ctx=cast(list[str], ["alpha", "gamma"]),
            memory_ctx=cast(list[str], ["beta"]),
        )

        self.assertEqual(result, "beta\n\nalpha [rate=0.25]")

    def test_optimize_deduplicates_exact_duplicate_chunks(self):
        module = load_core_module()
        optimizer = module.ContextOptimizer(compression_rate=0.5, max_chunks=6)

        result = optimizer.optimize(
            query="best chunk",
            graph_ctx=cast(list[str], ["beta", "beta", "alpha"]),
            memory_ctx=cast(list[str], []),
        )

        self.assertEqual(result, "beta\n\nalpha [rate=0.5]")

    def test_optimize_returns_empty_string_for_no_context(self):
        module = load_core_module()
        optimizer = module.ContextOptimizer()

        self.assertEqual(optimizer.optimize(query="anything"), "")

    def test_optimize_drops_error_chunks_before_pruning(self):
        module = load_core_module()
        optimizer = module.ContextOptimizer(compression_rate=0.5, max_chunks=6)

        result = optimizer.optimize(
            query="best chunk",
            graph_ctx=cast(list[str], ["[error] broken tool output", "alpha"]),
            memory_ctx=cast(list[str], []),
        )

        self.assertNotIn("[error] broken tool output", result)
        self.assertIn("alpha", result)

    def test_optimize_preserves_protected_docs_over_error_purge(self):
        module = load_core_module()
        optimizer = module.ContextOptimizer(compression_rate=0.5, max_chunks=6)

        result = optimizer.optimize(
            query="best chunk",
            graph_ctx=cast(list[str], ["protected: keep this", "[error] broken tool output"]),
            memory_ctx=cast(list[str], []),
        )

        self.assertIn("protected: keep this", result)
        self.assertNotIn("[error] broken tool output", result)

    def test_optimize_applies_model_specific_limits(self):
        module = load_core_module()
        optimizer = module.ContextOptimizer(
            compression_rate=0.5,
            max_chunks=6,
        )

        optimizer.model_limits = {
            "gpt-4o-mini": {"compression_rate": 0.2, "max_chunks": 2},
        }

        result = optimizer.optimize(
            query="best chunk",
            graph_ctx=cast(list[str], ["alpha", "beta", "gamma"]),
            memory_ctx=cast(list[str], []),
            docs=cast(list[str], ["delta"]),
            model="gpt-4o-mini",
        )

        self.assertIn("[rate=0.2]", result)

    def test_optimize_normalizes_tuple_docs_with_three_values(self):
        module = load_core_module()
        optimizer = module.ContextOptimizer(compression_rate=0.5, max_chunks=6)

        result = optimizer.optimize(
            query="best chunk",
            graph_ctx=cast(list[Any], [("graph", "alpha", "source-a")]),
            memory_ctx=cast(list[Any], [("memory", "beta", "source-b")]),
        )

        self.assertEqual(result, "graph alpha source-a\n\nmemory beta source-b [rate=0.5]")

    def test_optimize_pre_prunes_low_value_docs_before_rerank_and_compress(self):
        module = load_core_module()
        optimizer = module.ContextOptimizer(
            compression_rate=0.5,
            max_chunks=6,
            graph_budget_chars=5,
            memory_budget_chars=5,
            docs_budget_chars=5,
            total_prune_budget_chars=10,
        )

        result = optimizer.optimize(
            query="best chunk",
            graph_ctx=cast(list[str], ["alpha", "gamma"]),
            memory_ctx=cast(list[str], ["beta"]),
            docs=cast(list[str], ["low-value docs"]),
        )

        self.assertIn("beta", result)
        self.assertNotIn("low-value docs", result)

    def test_optimize_keeps_high_value_chunk_even_when_it_exceeds_bucket_budget(self):
        module = load_core_module()
        optimizer = module.ContextOptimizer(
            compression_rate=0.5,
            max_chunks=6,
            graph_budget_chars=3,
            memory_budget_chars=3,
            docs_budget_chars=3,
            total_prune_budget_chars=10,
        )

        result = optimizer.optimize(
            query="best chunk",
            graph_ctx=cast(list[str], ["alpha"]),
            memory_ctx=cast(list[str], []),
            docs=cast(list[str], []),
        )

        self.assertIn("alpha", result)

    def test_optimize_borrows_budget_toward_high_density_docs_bucket(self):
        module = load_core_module()
        optimizer = module.ContextOptimizer(
            compression_rate=0.5,
            max_chunks=6,
            graph_budget_chars=10,
            memory_budget_chars=10,
            docs_budget_chars=10,
            total_prune_budget_chars=8,
        )
        optimizer.reranker = types.SimpleNamespace(
            predict=lambda pairs: [10 if doc.startswith("d") else 1 for _, doc in pairs]
        )

        result = optimizer.optimize(
            query="best chunk",
            graph_ctx=cast(list[str], ["g01", "g02"]),
            memory_ctx=cast(list[str], ["m01"]),
            docs=cast(list[str], ["d1", "d2", "d3"]),
        )

        self.assertIn("d1", result)
        self.assertIn("d2", result)
        self.assertIn("d3", result)
        self.assertLess(result.index("d1"), result.index("g01"))


class ContextOptimizerHookTests(unittest.TestCase):
    def test_run_attaches_optimized_context(self):
        core = load_core_module()

        class StubOptimizer:
            def optimize(self, query, graph_ctx=None, memory_ctx=None, docs=None):
                graph_items = cast(list[str], graph_ctx or [])
                memory_items = cast(list[str], memory_ctx or [])
                doc_items = cast(list[str], docs or [])
                return f"{query}:{'|'.join(graph_items)}:{'|'.join(memory_items)}:{'|'.join(doc_items)}"

        setattr(core, "ContextOptimizer", lambda: StubOptimizer())
        hook = load_hook_module(core)

        context = cast(dict[str, Any], {
            "query": "hello",
            "graph_ctx": ["g1"],
            "memory_ctx": ["m1"],
            "docs": ["d1"],
        })
        result = hook.run(context)

        self.assertIs(result, context)
        self.assertEqual(result["optimized_context"], "hello:g1:m1:d1")

    def test_run_passes_docs_through_to_optimizer(self):
        core = load_core_module()

        class StubOptimizer:
            def optimize(self, query, graph_ctx=None, memory_ctx=None, docs=None):
                graph_items = cast(list[str], graph_ctx or [])
                memory_items = cast(list[str], memory_ctx or [])
                doc_items = cast(list[str], docs or [])
                return f"{query}:{'|'.join(graph_items)}:{'|'.join(memory_items)}:{'|'.join(doc_items)}"

        setattr(core, "ContextOptimizer", lambda: StubOptimizer())
        hook = load_hook_module(core)

        context = cast(dict[str, Any], {
            "query": "hello",
            "graph_ctx": ["g1"],
            "memory_ctx": ["m1"],
            "docs": ["d1"],
        })

        result = hook.run(context)

        self.assertIs(result, context)
        self.assertEqual(result["optimized_context"], "hello:g1:m1:d1")

    def test_run_returns_original_context_when_optimizer_cannot_initialize(self):
        core = load_core_module()

        class RaisingOptimizer:
            def __init__(self):
                raise RuntimeError("boom")

        setattr(core, "ContextOptimizer", RaisingOptimizer)
        hook = load_hook_module(core)

        context = cast(dict[str, Any], {"query": "hello"})
        result = hook.run(context)

        self.assertIs(result, context)
        self.assertNotIn("optimized_context", result)
        self.assertEqual(result.get("optimized_context_error"), "optimizer initialization failed")

    def test_run_logs_initialization_failure(self):
        core = load_core_module()

        class RaisingOptimizer:
            def __init__(self):
                raise RuntimeError("boom")

        setattr(core, "ContextOptimizer", RaisingOptimizer)
        hook = load_hook_module(core)

        context = cast(dict[str, Any], {"query": "hello"})
        stderr = io.StringIO()

        with contextlib.redirect_stderr(stderr):
            result = hook.run(context)

        self.assertIs(result, context)
        self.assertIn("optimizer initialization failed", stderr.getvalue())

    def test_run_returns_original_context_with_error_marker_when_optimization_fails(self):
        core = load_core_module()

        class StubOptimizer:
            def optimize(self, query, graph_ctx=None, memory_ctx=None, docs=None):
                raise RuntimeError("boom")

        setattr(core, "ContextOptimizer", lambda: StubOptimizer())
        hook = load_hook_module(core)

        context = cast(dict[str, Any], {"query": "hello"})
        result = hook.run(context)

        self.assertIs(result, context)
        self.assertNotIn("optimized_context", result)
        self.assertEqual(result.get("optimized_context_error"), "optimizer optimization failed")

    def test_run_logs_optimization_failure(self):
        core = load_core_module()

        class StubOptimizer:
            def optimize(self, query, graph_ctx=None, memory_ctx=None, docs=None):
                raise RuntimeError("boom")

        setattr(core, "ContextOptimizer", lambda: StubOptimizer())
        hook = load_hook_module(core)

        context = cast(dict[str, Any], {"query": "hello"})
        stderr = io.StringIO()

        with contextlib.redirect_stderr(stderr):
            result = hook.run(context)

        self.assertIs(result, context)
        self.assertIn("optimizer optimization failed", stderr.getvalue())

    def test_run_preserves_model_and_policy_options(self):
        core = load_core_module()

        class StubOptimizer:
            def __init__(self):
                self.calls = []

            def optimize(self, query, graph_ctx=None, memory_ctx=None, docs=None, model=None, options=None):
                self.calls.append({
                    "query": query,
                    "graph_ctx": list(graph_ctx or []),
                    "memory_ctx": list(memory_ctx or []),
                    "docs": list(docs or []),
                    "model": model,
                    "options": options,
                })
                return "optimized"

        stub = StubOptimizer()
        setattr(core, "ContextOptimizer", lambda: stub)
        hook = load_hook_module(core)

        context = cast(dict[str, Any], {
            "query": "hello",
            "graph_ctx": ["g1"],
            "memory_ctx": ["m1"],
            "docs": ["d1"],
            "model": "gpt-4o-mini",
            "options": {"compression_rate": 0.2},
        })

        result = hook.run(context)

        self.assertIs(result, context)
        self.assertEqual(stub.calls[0]["model"], "gpt-4o-mini")
        self.assertEqual(stub.calls[0]["options"], {"compression_rate": 0.2})


if __name__ == "__main__":
    unittest.main()
