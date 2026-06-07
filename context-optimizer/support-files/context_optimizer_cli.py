import json
import sys
from typing import Any, Dict, NoReturn


def emit(payload: Dict[str, Any], exit_code: int = 0) -> NoReturn:
    sys.stdout.write(json.dumps(payload))
    sys.stdout.flush()
    raise SystemExit(exit_code)


def emit_error(error_code: str, message: str, exit_code: int = 1) -> NoReturn:
    emit(
        {
            "ok": False,
            "error_code": error_code,
            "message": message,
        },
        exit_code=exit_code,
    )


ContextOptimizer: Any = None
try:
    from context_optimizer import ContextOptimizer
except ModuleNotFoundError as exc:
    emit_error("dependency_missing", str(exc))


def main() -> None:
    raw = sys.stdin.read()
    payload: Dict[str, Any] = {}
    try:
        payload = json.loads(raw or "{}")
    except json.JSONDecodeError as exc:
        emit_error("invalid_input", str(exc))

    docs = payload.get("docs") or []
    query = payload.get("query", "")
    options = payload.get("options") or {}

    if not isinstance(docs, list):
        emit_error("invalid_input", "docs must be a list of strings")

    if not docs:
        emit({"ok": True, "optimized_context": "", "initial_size": 0, "final_size": 0})
        return

    if any(not isinstance(doc, str) for doc in docs):
        emit_error("invalid_input", "docs must contain strings only")

    safe_docs = docs

    initial_size = sum(len(doc) for doc in safe_docs)

    optimized = ""
    try:
        optimizer = ContextOptimizer(**options) if ContextOptimizer is not None else None
        if optimizer is None:
            emit_error("dependency_missing", "ContextOptimizer import unavailable")

        optimized = optimizer.optimize(query=query, graph_ctx=safe_docs, memory_ctx=[])
    except Exception as exc:
        emit_error("runtime_error", str(exc))

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
