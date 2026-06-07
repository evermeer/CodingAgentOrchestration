try:
    from context_optimizer import ContextOptimizer
except Exception:
    ContextOptimizer = None

optimizer = None
if ContextOptimizer is not None:
    try:
        optimizer = ContextOptimizer()
    except Exception:
        optimizer = None

def run(context):
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
