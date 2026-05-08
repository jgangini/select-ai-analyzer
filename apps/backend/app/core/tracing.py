"""
Minimal runtime tracing: JSONL to logs/runtime_trace.jsonl when TRACE=1.
Provides: trace decorator (enter/exit/exception + duration_ms + depth),
checkpoint(name, tags), and context propagation via trace_id.
TRACE=0 (default): no file, no I/O, near-zero overhead.
"""
import contextvars
import functools
import inspect
import json
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

_TRACE_ENABLED = os.environ.get("TRACE", "0") == "1"
_run_id: str = str(uuid.uuid4())
_trace_id_ctx: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "trace_id", default=None
)
_depth_ctx: contextvars.ContextVar[int] = contextvars.ContextVar("depth", default=0)

# Runtime root for migrated backend (`apps/backend`).
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_TRACE_LOG_PATH = _BACKEND_ROOT / "logs" / "runtime_trace.jsonl"
_file_handle: Optional[Any] = None


def _ensure_trace_file():
    """Open trace file in append mode, create logs/ if needed. Only when TRACE=1."""
    global _file_handle
    if _file_handle is not None:
        return
    _TRACE_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    _file_handle = open(_TRACE_LOG_PATH, "a", encoding="utf-8")


def _write_line(record: dict) -> None:
    if not _TRACE_ENABLED:
        return
    try:
        _ensure_trace_file()
        line = json.dumps(record, ensure_ascii=False) + "\n"
        _file_handle.write(line)
        _file_handle.flush()
    except Exception:
        pass  # do not break app on trace write failure


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_trace_id() -> Optional[str]:
    return _trace_id_ctx.get()


def set_trace_id(trace_id: str) -> None:
    _trace_id_ctx.set(trace_id)


def checkpoint(name: str, tags: Optional[dict] = None) -> None:
    """Log event=checkpoint with name and optional tags. No-op when TRACE=0."""
    if not _TRACE_ENABLED:
        return
    record = {
        "ts": _ts(),
        "event": "checkpoint",
        "name": name,
        "trace_id": get_trace_id(),
        "run_id": _run_id,
    }
    if tags:
        record["tags"] = {k: v for k, v in tags.items() if isinstance(v, (str, int, float, bool, type(None)))}
    _write_line(record)


def _write_trace_event(name: str, event: str, depth: int, extra: Optional[dict[str, Any]] = None) -> None:
    record = {
        "ts": _ts(),
        "event": event,
        "name": name,
        "depth": depth,
        "trace_id": get_trace_id(),
        "run_id": _run_id,
    }
    if extra:
        record.update(extra)
    _write_line(record)


def _enter_trace(name: str) -> int:
    depth = _depth_ctx.get(0)
    _depth_ctx.set(depth + 1)
    _write_trace_event(name, "enter", depth + 1)
    return depth


def _duration_ms(start: float) -> float:
    return round((time.perf_counter() - start) * 1000, 2)


def _exit_trace(name: str, depth: int, start: float) -> None:
    _write_trace_event(name, "exit", depth + 1, {"duration_ms": _duration_ms(start)})


def _exception_trace(name: str, depth: int, start: float, exc: Exception) -> None:
    _write_trace_event(
        name,
        "exception",
        depth + 1,
        {
            "duration_ms": _duration_ms(start),
            "error": f"{type(exc).__name__}: {str(exc)}",
        },
    )


def _trace_impl_sync(f: Callable, name: str):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        if not _TRACE_ENABLED:
            return f(*args, **kwargs)
        depth = _enter_trace(name)
        start = time.perf_counter()
        try:
            out = f(*args, **kwargs)
            _exit_trace(name, depth, start)
            return out
        except Exception as e:
            _exception_trace(name, depth, start, e)
            raise
        finally:
            _depth_ctx.set(depth)
    return wrapper


def _trace_impl_async(f: Callable, name: str):
    @functools.wraps(f)
    async def wrapper(*args, **kwargs):
        if not _TRACE_ENABLED:
            return await f(*args, **kwargs)
        depth = _enter_trace(name)
        start = time.perf_counter()
        try:
            out = await f(*args, **kwargs)
            _exit_trace(name, depth, start)
            return out
        except Exception as e:
            _exception_trace(name, depth, start, e)
            raise
        finally:
            _depth_ctx.set(depth)
    return wrapper


def trace(f: Callable) -> Callable:
    """Decorator: log enter/exit/exception + duration_ms + depth. No-op when TRACE=0."""
    name = f"{f.__module__}.{f.__qualname__}"
    if not _TRACE_ENABLED:
        return f
    if inspect.iscoroutinefunction(f):
        return _trace_impl_async(f, name)
    return _trace_impl_sync(f, name)


class TracingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if os.environ.get("TRACE", "0") != "1":
            return await call_next(request)
        trace_id = str(uuid.uuid4())
        set_trace_id(trace_id)
        checkpoint("request_start", tags={"method": request.method, "path": request.url.path})
        start = time.perf_counter()
        try:
            response = await call_next(request)
            checkpoint(
                "request_end",
                tags={
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": round((time.perf_counter() - start) * 1000, 2),
                },
            )
            return response
        except Exception:
            checkpoint(
                "request_end",
                tags={
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": round((time.perf_counter() - start) * 1000, 2),
                    "error": True,
                },
            )
            raise
