import json
import sys


def emit(payload: dict, exit_code: int = 0) -> None:
    sys.stdout.write(json.dumps(payload))
    sys.stdout.flush()
    raise SystemExit(exit_code)


try:
    from context_optimizer import ContextOptimizer
except ModuleNotFoundError as exc:
    emit(
        {
            "ok": False,
            "error_code": "dependency_missing",
            "message": str(exc),
        },
        exit_code=0,
    )


def main() -> None:
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw or "{}")
    except json.JSONDecodeError as exc:
        emit(
            {
                "ok": False,
                "error_code": "invalid_input",
                "message": str(exc),
            }
        )

    docs = payload.get("docs") or []
    query = payload.get("query", "")
    options = payload.get("options") or {}

    if not isinstance(docs, list):
        emit(
            {
                "ok": False,
                "error_code": "invalid_input",
                "message": "docs must be a list of strings",
            }
        )

    if not docs:
        emit({"ok": True, "optimized_context": ""})

    try:
        optimizer = ContextOptimizer(**options)
        optimized = optimizer.optimize(query=query, graph_ctx=docs, memory_ctx=[])
    except Exception as exc:
        emit(
            {
                "ok": False,
                "error_code": "runtime_error",
                "message": str(exc),
            }
        )

    emit({"ok": True, "optimized_context": optimized})


if __name__ == "__main__":
    main()
