"""FastAPI entrypoint for Select AI Analytics."""

from __future__ import annotations

import asyncio
import logging
import sys
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from apps.backend.app.core import security
from apps.backend.app.core.config import get_settings
from apps.backend.app.core.database import DatabaseManager
from apps.backend.app.core.logging_config import configure_logging
from apps.backend.app.core.tracing import checkpoint, set_trace_id
from apps.backend.app.api.routes import (
    agent_builder,
    analytics,
    auth,
    config,
    data_sources,
    dashboards,
    health,
    settings as settings_route,
    setup,
    users,
)


def _ensure_utf8_console() -> None:
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if stream is None:
            continue
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass


_ensure_utf8_console()
configure_logging()
logger = logging.getLogger(__name__)

settings = get_settings()
security.set_settings(settings)
db_manager = DatabaseManager.get_instance(settings)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Select AI Analytics...")
    logger.info("Database pool initializes on first login")
    try:
        yield
    except asyncio.CancelledError:
        logger.info("Shutdown signal received")
        raise
    finally:
        logger.info("Shutting down...")
        try:
            db_manager.close_pool()
        except Exception:
            pass


app = FastAPI(title="Select AI Analytics API", version="1.0.0", lifespan=lifespan)


class TracingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if __import__("os").environ.get("TRACE", "0") != "1":
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


app.add_middleware(TracingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

setup.settings = settings
setup.db_manager = db_manager
auth.settings = settings
auth.db_manager = db_manager
users.settings = settings
users.db_manager = db_manager

app.include_router(setup.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(health.router, prefix="/api")
app.include_router(config.router, prefix="/api")
app.include_router(settings_route.router, prefix="/api")
app.include_router(data_sources.router, prefix="/api")
app.include_router(dashboards.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(agent_builder.router, prefix="/api")


@app.get("/")
def root():
    return {"app": "Select AI Analytics", "version": "1.0.0", "status": "running"}
