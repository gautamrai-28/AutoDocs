"""
main.py — AutoDocs FastAPI Application
Placement: backend/main.py
Run with: uvicorn main:app --reload --port 8000
"""

import asyncio
import os
import shutil
import tempfile
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import docs
from utils.job_store import job_store


@asynccontextmanager
async def lifespan(app: FastAPI):
    cleanup_task = asyncio.create_task(_cleanup_expired_jobs())
    yield
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


async def _cleanup_expired_jobs() -> None:
    """
    Runs every 30 minutes. Removes job_store entries older than
    JOB_TTL_SECONDS, deletes their /tmp/{job_id}/ directories
    (Fix #3 — removes the empty parent dir left by delete_clone),
    and purges any in-memory mock ZIP bytes (Fix #1 — prevents
    _mock_zips from growing unbounded).
    """
    while True:
        await asyncio.sleep(30 * 60)
        try:
            expired = job_store.expire_old_jobs(settings.job_ttl_seconds)

            for job_id in expired:
                # Remove the entire /tmp/{job_id}/ tree, including
                # the empty directory left behind by delete_clone()
                tmp_dir = os.path.join(tempfile.gettempdir(), job_id)
                if os.path.exists(tmp_dir):
                    shutil.rmtree(tmp_dir, ignore_errors=True)

            if expired:
                docs.purge_mock_zips(expired)
        except Exception:
            continue


def create_app() -> FastAPI:
    application = FastAPI(
        title="AutoDocs API",
        description="AI-powered GitHub repository documentation generator.",
        version="1.0.0",
        docs_url="/docs"       if settings.is_development else None,
        redoc_url="/redoc"     if settings.is_development else None,
        openapi_url="/openapi.json" if settings.is_development else None,
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Accept", "Authorization"],
        expose_headers=["Content-Disposition"],
    )

    application.include_router(docs.router)
    return application


app = create_app()


@app.get("/health", tags=["system"])
async def health_check() -> dict:
    return {
        "status":  "ok",
        "version": "1.0.0",
        "env":     settings.env,
        "jobs":    len(job_store),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.is_development,
    )