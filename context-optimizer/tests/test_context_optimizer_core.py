import importlib.util
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
            return {"compressed_prompt": f"{combined} [rate={rate}]"}

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


class ContextOptimizerHookTests(unittest.TestCase):
    def test_run_attaches_optimized_context(self):
        core = load_core_module()

        class StubOptimizer:
            def optimize(self, query, graph_ctx=None, memory_ctx=None):
                graph_items = cast(list[str], graph_ctx or [])
                memory_items = cast(list[str], memory_ctx or [])
                return f"{query}:{'|'.join(graph_items)}:{'|'.join(memory_items)}"

        setattr(core, "ContextOptimizer", lambda: StubOptimizer())
        hook = load_hook_module(core)

        context = cast(dict[str, Any], {"query": "hello", "graph_ctx": ["g1"], "memory_ctx": ["m1"]})
        result = hook.run(context)

        self.assertIs(result, context)
        self.assertEqual(result["optimized_context"], "hello:g1:m1")

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


if __name__ == "__main__":
    unittest.main()
