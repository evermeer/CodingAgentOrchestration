import json
import sys
from typing import Any, Dict, NoReturn


def emit(payload: Dict[str, Any], exit_code: int = 0) -> NoReturn:
    sys.stdout.write(json.dumps(payload))
    sys.stdout.flush()
    raise SystemExit(exit_code)


ContextOptimizer: Any = None
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
    payload: Dict[str, Any] = {}
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
        return

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
        return

    if not docs:
        emit({"ok": True, "optimized_context": "", "initial_size": 0, "final_size": 0})
        return

    safe_docs = [doc for doc in docs if isinstance(doc, str)]
    if not safe_docs:
        emit({"ok": True, "optimized_context": "", "initial_size": 0, "final_size": 0})
        return

    initial_size = sum(len(doc) for doc in safe_docs)

    optimized = ""
    try:
        optimizer = ContextOptimizer(**options) if ContextOptimizer is not None else None
        if optimizer is None:
            emit(
                {
                    "ok": False,
                    "error_code": "dependency_missing",
                    "message": "ContextOptimizer import unavailable",
                }
            )
            return

        optimized = optimizer.optimize(query=query, graph_ctx=safe_docs, memory_ctx=[])
    except Exception as exc:
        emit(
            {
                "ok": False,
                "error_code": "runtime_error",
                "message": str(exc),
            }
        )
        return

    emit(
        {
            "ok": True,
            "optimized_context": optimized,
            "initial_size": initial_size,
            "final_size": len(optimized),
        }
    )


if __name__ == "__main__":
    main()
