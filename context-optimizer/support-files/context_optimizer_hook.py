import sys
import inspect

try:
    from context_optimizer import ContextOptimizer
except Exception:
    ContextOptimizer = None

_optimizer = None
_init_failed = False


def _log(message):
    try:
        sys.stderr.write(f"[context-optimizer] {message}\n")
        sys.stderr.flush()
    except Exception:
        pass


def _get_optimizer():
    # Lazily construct the optimizer on first use so importing this module does
    # not download or load the (multi-GB) models as an import side effect.
    global _optimizer, _init_failed

    if _optimizer is not None:
        return _optimizer
    if _init_failed or ContextOptimizer is None:
        return None

    try:
        _optimizer = ContextOptimizer()
    except Exception as exc:
        _init_failed = True
        _optimizer = None
        _log(f"optimizer initialization failed: {type(exc).__name__}: {exc}")
        return None

    return _optimizer


def run(context):
    optimizer = _get_optimizer()
    if optimizer is None:
        context["optimized_context_error"] = "optimizer initialization failed"
        return context

    query = context.get("query", "")
    graph_ctx = context.get("graph_ctx", [])
    memory_ctx = context.get("memory_ctx", [])
    docs = context.get("docs", [])
    model = context.get("model", "")
    options = context.get("options", {})

    try:
        optimize_kwargs = {
            "query": query,
            "graph_ctx": graph_ctx,
            "memory_ctx": memory_ctx,
            "docs": docs,
        }
        try:
            signature = inspect.signature(optimizer.optimize)
            if "model" in signature.parameters:
                optimize_kwargs["model"] = model
            if "options" in signature.parameters:
                optimize_kwargs["options"] = options
        except (TypeError, ValueError):
            optimize_kwargs["model"] = model
            optimize_kwargs["options"] = options

        optimized = optimizer.optimize(
            **optimize_kwargs,
        )
    except Exception as exc:
        _log(f"optimizer optimization failed: {type(exc).__name__}: {exc}")
        context["optimized_context_error"] = "optimizer optimization failed"
        return context

    context["optimized_context"] = optimized
    context.pop("optimized_context_error", None)
    return context
