"""
routers/docs.py — Documentation generation API router.

The generate endpoint creates a job, validates and clones a repository,
scans it for structure and ranking data, runs the AI pipeline, and
persists the generated documentation for later download.
"""

from __future__ import annotations

import io
import re
import zipfile

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from config import settings
from models.schemas import (
    GenerateRequest,
    GenerateResponse,
    KeyFile,
    StatusResponse,
    ValidateRequest,
    ValidateResponse,
)
from services.github_service import (
    validate_and_clone,
    delete_clone,
    InvalidRepoUrlError,
    RepoNotFoundError,
    RepoTooLargeError,
    CloneTimeoutError,
    CloneFailedError,
)
from services.scanner import scan_repository
from services.ai_service import (
    run_full_pipeline,
    AIConfigError,
    AIGenerationError,
)
from services.zip_service import build_documentation_zip
from utils.job_store import job_store

router = APIRouter(prefix="/api", tags=["docs"])


# ─────────────────────────────────────────────────────────────
# POST /api/generate
# ─────────────────────────────────────────────────────────────

@router.post(
    "/generate",
    response_model=GenerateResponse,
    summary="Generate documentation for a GitHub repository",
    responses={
        400: {"description": "Invalid GitHub URL format"},
        404: {"description": "Repository not found or private"},
        408: {"description": "Clone timed out"},
        413: {"description": "Repository too large"},
        500: {"description": "Internal server error"},
        502: {"description": "AI generation failed"},
    },
)
async def generate_docs(request: GenerateRequest) -> GenerateResponse:
    """
    Run the full generation flow:
      create job → validate URL → clone → scan → AI analysis
      → delete clone → persist result.

    AI analysis runs before the clone is deleted because it reads file
    content from each ScannedFile's absolute_path inside the clone
    directory.
    """

    # ── Step 1: create job entry ──────────────────────────────
    # Extract a display name before full validation so the job
    # store has something useful even if cloning fails.
    repo_name = _extract_repo_name(request.repo_url)
    job_id    = job_store.create_job(
        repo_url=request.repo_url,
        repo_name=repo_name,
    )

    try:
        # ── Step 2: validate URL + shallow clone ──────────────
        identity, clone_path = validate_and_clone(request.repo_url, job_id)

        # Update repo_name with the canonical parsed value
        repo_name = identity.full_name

        # ── Step 3: scan the repository ───────────────────────
        scan = scan_repository(
            clone_path=clone_path,
            max_ai_files=settings.max_files_to_analyse,
        )

        # ── Step 4: run the AI pipeline ───────────────────────
        # Must execute HERE — inside this try block, before the
        # finally clause below calls delete_clone(job_id) — because
        # ai_service.read_file_content() reads from each scanned
        # file's absolute_path, which lives inside the clone
        # directory deleted at the end of this try/finally. Moving
        # this call after the clone is deleted would not raise an
        # exception; it would silently degrade every file
        # explanation to a "file could not be read" fallback.
        pipeline_result = await run_full_pipeline(repo_name, scan)

    except InvalidRepoUrlError as exc:
        job_store.set_error(job_id, str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    except RepoNotFoundError as exc:
        job_store.set_error(job_id, str(exc))
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    except CloneTimeoutError as exc:
        job_store.set_error(job_id, str(exc))
        raise HTTPException(status_code=408, detail=str(exc)) from exc

    except RepoTooLargeError as exc:
        job_store.set_error(job_id, str(exc))
        raise HTTPException(status_code=413, detail=str(exc)) from exc

    except CloneFailedError as exc:
        job_store.set_error(job_id, str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    except AIConfigError as exc:
        job_store.set_error(job_id, str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    except AIGenerationError as exc:
        job_store.set_error(job_id, str(exc))
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    except Exception as exc:
        job_store.set_error(job_id, str(exc))
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during generation: {exc}",
        ) from exc

    finally:
        # ── Step 5: always delete the clone ───────────────────
        # Runs whether we succeeded or failed — prevents disk
        # buildup. By the time this runs, the AI pipeline above
        # has already read every file it needs (or failed trying,
        # in which case an exception was raised and handled above
        # before this finally block executes). In Phase 4 the real
        # ZIP is written before this point too, so the clone can
        # always be deleted immediately after both scanning and
        # AI analysis are complete.
        delete_clone(job_id)

    # ── Step 6: build and persist the response ────────────────
    # Wrapped in its own try/except so any failure here marks the
    # job as error instead of leaving it stuck in 'pending' state.
    try:
        result_data = {
            "job_id":         job_id,
            "repo_name":      repo_name,
            "file_count":     scan.file_count,
            "folder_count":   scan.folder_count,
            "doc_count":      pipeline_result.doc_count,
            "folder_tree":    scan.folder_tree,
            "key_files":      scan.key_files,
            "readme_preview": pipeline_result.readme_preview,
            "readme_content": pipeline_result.readme_content,

            # Internal-only fields — NOT part of GenerateResponse's
            # schema. Pydantic's default extra="ignore" behaviour
            # means GenerateResponse(**result_data) below silently
            # drops these keys, and FastAPI's response_model
            # enforcement strips them before they ever reach the
            # frontend. They're persisted here purely so Phase 4's
            # ZIP builder can read them back via
            # job_store.get_job(job_id)["result"][...] without
            # re-running the AI pipeline.
            "file_explanations": pipeline_result.file_explanations,
            "folder_summaries":  pipeline_result.folder_summaries,
        }

        # Build the downloadable ZIP bundle from the generated
        # documentation content so /api/download exposes the
        # actual README and scan summary files.
        zip_bytes = build_documentation_zip(
            repo_name=repo_name,
            scan=scan,
            readme_content=pipeline_result.readme_content,
            doc_count=pipeline_result.doc_count,
        )
        _mock_zips[job_id] = zip_bytes

        job_store.set_done(
            job_id=job_id,
            result=result_data,
            zip_path=f"__mock__{job_id}",
        )

    except Exception as exc:
        job_store.set_error(job_id, f"Failed to build response: {exc}")
        raise HTTPException(
            status_code=500,
            detail=f"Documentation was generated but response packaging failed: {exc}",
        ) from exc

    return GenerateResponse(
        **{
            **result_data,
            "key_files": [KeyFile(**f) for f in result_data["key_files"]],
        }
    )


# ─────────────────────────────────────────────────────────────
# GET /api/status/{job_id}
# ─────────────────────────────────────────────────────────────

@router.get(
    "/status/{job_id}",
    response_model=StatusResponse,
    summary="Poll the status of a generation job",
)
async def get_job_status(job_id: str) -> StatusResponse:
    job = job_store.get_job(job_id)
    if job is None:
        raise HTTPException(
            status_code=404,
            detail=f"Job '{job_id}' not found. It may have expired.",
        )

    result_response = None
    if job["status"] == "done" and job["result"]:
        r = job["result"]
        # r may contain the internal-only keys (readme_content,
        # file_explanations, folder_summaries) persisted in Step 6
        # above — GenerateResponse(**r) silently ignores any keys
        # not in its schema, so they never leak into this response.
        result_response = GenerateResponse(
            **{
                **r,
                "key_files": [KeyFile(**f) for f in r.get("key_files", [])],
            }
        )

    return StatusResponse(
        job_id=job_id,
        status=job["status"],
        step=job["step"],
        result=result_response,
        error=job["error"],
    )


# ─────────────────────────────────────────────────────────────
# GET /api/download/{job_id}
# ─────────────────────────────────────────────────────────────

# In-memory manifest ZIPs for the current download flow.
_mock_zips: dict[str, bytes] = {}


def purge_mock_zips(expired_job_ids: list[str]) -> int:
    """
    Removes entries from _mock_zips for jobs that job_store has
    already expired. Called by the TTL cleanup task so this in-memory
    dict does not grow without bound.

    Returns the number of entries actually removed.
    """
    removed = 0
    for job_id in expired_job_ids:
        if _mock_zips.pop(job_id, None) is not None:
            removed += 1
    return removed


@router.get(
    "/download/{job_id}",
    summary="Download the generated documentation ZIP",
)
async def download_zip(job_id: str) -> StreamingResponse:
    job = job_store.get_job(job_id)

    if job is None:
        raise HTTPException(
            status_code=404,
            detail=f"Job '{job_id}' not found or has expired.",
        )
    if job["status"] in ("pending", "processing"):
        raise HTTPException(
            status_code=425,
            detail="Documentation generation is still in progress.",
        )
    if job["status"] == "error":
        raise HTTPException(
            status_code=500,
            detail=f"Generation failed: {job['error']}",
        )

    zip_bytes = _mock_zips.get(job_id)
    if zip_bytes is None:
        raise HTTPException(
            status_code=404,
            detail="ZIP file not found. The job may have expired.",
        )

    repo_name = job_store.get_repo_name(job_id)
    filename  = repo_name.replace("/", "-") + "-docs.zip"

    return StreamingResponse(
        content=iter([zip_bytes]),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length":      str(len(zip_bytes)),
        },
    )


# ─────────────────────────────────────────────────────────────
# POST /api/validate
# ─────────────────────────────────────────────────────────────

_GITHUB_URL_PATTERN = re.compile(
    r"^https?://(?:www\.)?github\.com/([a-zA-Z0-9_.-]+)/([a-zA-Z0-9_.-]+?)(?:\.git)?/?$"
)


@router.post(
    "/validate",
    response_model=ValidateResponse,
    summary="Validate a GitHub repository URL",
)
async def validate_repo_url(request: ValidateRequest) -> ValidateResponse:
    url = request.repo_url.strip()
    if not url:
        return ValidateResponse(valid=False, message="Please enter a GitHub URL.")
    if not url.startswith("https://github.com/"):
        return ValidateResponse(
            valid=False,
            message="Only GitHub repositories are supported (github.com).",
        )
    match = _GITHUB_URL_PATTERN.match(url)
    if not match:
        return ValidateResponse(
            valid=False,
            message="URL format is invalid. Expected: https://github.com/owner/repository",
        )
    owner, repo = match.group(1), match.group(2)
    return ValidateResponse(
        valid=True,
        message=f"Repository {owner}/{repo} looks valid.",
    )


# ─────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────

def _extract_repo_name(repo_url: str) -> str:
    """Extracts 'owner/repo' from a GitHub URL for display."""
    match = re.match(
        r"https?://(?:www\.)?github\.com/([^/]+/[^/]+?)(?:\.git)?/?$",
        repo_url.strip(),
    )
    return match.group(1) if match else "unknown/repo"


def _build_scan_zip(repo_name: str, scan) -> bytes:
    """
    Builds a ZIP containing the scan manifest (folder structure
    and key file list). Replaced by the full generated
    documentation ZIP (README + file explanations + folder
    summaries as markdown files) in Phase 4.
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:

        # Scan summary
        file_lines = "\n".join(
            f"- {f['path']} [{f['role']}]"
            for f in scan.key_files
        )
        zf.writestr(
            "SCAN_SUMMARY.md",
            f"# {repo_name} — Scan Summary\n\n"
            f"**Files scanned:** {scan.file_count}\n"
            f"**Folders found:** {scan.folder_count}\n"
            f"**Files analysed by AI:** {len(scan.prioritised_files)}\n\n"
            f"## Key Files\n\n{file_lines}\n\n"
            f"*Full generated documentation is included in the README "
            f"preview and will be packaged as individual markdown files "
            f"in this ZIP starting in Phase 4.*\n"
        )

        # Folder tree as text
        tree_lines = _tree_to_text(scan.folder_tree)
        zf.writestr(
            "FOLDER_STRUCTURE.md",
            f"# Folder Structure\n\n```\n{tree_lines}\n```\n"
        )

    buf.seek(0)
    return buf.read()


def _tree_to_text(node: dict, indent: str = "") -> str:
    """Converts the folder_tree dict into an ASCII tree string."""
    lines = []
    items = list(node.items())
    for i, (name, value) in enumerate(items):
        is_last    = i == len(items) - 1
        connector  = "└── " if is_last else "├── "
        child_pfx  = indent + ("    " if is_last else "│   ")
        if isinstance(value, dict):
            lines.append(f"{indent}{connector}{name}/")
            lines.append(_tree_to_text(value, child_pfx))
        else:
            lines.append(f"{indent}{connector}{name}")
    return "\n".join(line for line in lines if line)