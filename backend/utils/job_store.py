"""
utils/job_store.py — In-Memory Job Store
Placement: backend/utils/job_store.py
"""
import threading
import time
import uuid
from typing import Any


class JobStore:
    def __init__(self) -> None:
        self._store: dict[str, dict[str, Any]] = {}
        self._lock  = threading.RLock()

    def create_job(self, repo_url: str, repo_name: str) -> str:
        job_id = str(uuid.uuid4())
        with self._lock:
            self._store[job_id] = {
                "status":     "pending",
                "step":       -1,
                "result":     None,
                "zip_path":   None,
                "repo_name":  repo_name,
                "repo_url":   repo_url,
                "error":      None,
                "created_at": time.time(),
            }
        return job_id

    def set_step(self, job_id: str, step: int) -> None:
        with self._lock:
            if job_id in self._store:
                self._store[job_id]["step"]   = step
                self._store[job_id]["status"] = "processing"

    def set_done(self, job_id: str, result: dict, zip_path: str) -> None:
        with self._lock:
            if job_id in self._store:
                self._store[job_id].update({
                    "status":   "done",
                    "step":     -1,
                    "result":   result,
                    "zip_path": zip_path,
                    "error":    None,
                })

    def set_error(self, job_id: str, message: str) -> None:
        with self._lock:
            if job_id in self._store:
                self._store[job_id].update({
                    "status": "error",
                    "step":   -1,
                    "error":  message,
                })

    def get_job(self, job_id: str) -> dict | None:
        with self._lock:
            return self._store.get(job_id)

    def job_exists(self, job_id: str) -> bool:
        with self._lock:
            return job_id in self._store

    def get_zip_path(self, job_id: str) -> str | None:
        with self._lock:
            job = self._store.get(job_id)
            return job["zip_path"] if job else None

    def get_repo_name(self, job_id: str) -> str:
        with self._lock:
            job = self._store.get(job_id)
            return job["repo_name"] if job else "documentation"

    def expire_old_jobs(self, ttl_seconds: int) -> list[str]:
        now     = time.time()
        expired = []
        with self._lock:
            for job_id, job in list(self._store.items()):
                if now - job["created_at"] > ttl_seconds:
                    expired.append(job_id)
                    del self._store[job_id]
        return expired

    def __len__(self) -> int:
        with self._lock:
            return len(self._store)


job_store = JobStore()