try:
    from context_optimizer import ContextOptimizer
except Exception:
    ContextOptimizer = None

_optimizer = None
_init_failed = False


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
    except Exception:
        _init_failed = True
        return None

    return _optimizer


def run(context):
    optimizer = _get_optimizer()
    if optimizer is None:
        return context

    query = context.get("query", "")
    graph_ctx = context.get("graph_ctx", [])
    memory_ctx = context.get("memory_ctx", [])

    try:
        optimized = optimizer.optimize(
            query=query,
            graph_ctx=graph_ctx,
            memory_ctx=memory_ctx,
        )
    except Exception:
        return context

    context["optimized_context"] = optimized
    return context
