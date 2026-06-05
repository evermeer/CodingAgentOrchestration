from context_optimizer import ContextOptimizer

optimizer = ContextOptimizer()

def run(context):
    query = context.get("query", "")
    graph_ctx = context.get("graph_ctx", [])
    memory_ctx = context.get("memory_ctx", [])

    optimized = optimizer.optimize(
        query=query,
        graph_ctx=graph_ctx,
        memory_ctx=memory_ctx,
    )

    context["optimized_context"] = optimized
    return context
