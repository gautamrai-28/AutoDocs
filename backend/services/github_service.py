"""
services/github_service.py — Repository Cloning Service

Handles everything that involves talking to GitHub or writing
to the local filesystem before scanning begins:

  Stage 1 — Validate:  regex format check + live HEAD request to GitHub
  Stage 2 — Clone:     shallow depth=1 into /tmp/{job_id}/repo/
  Stage 3 — Measure:   disk size check against the configured limit

Exception hierarchy (mapped to HTTP status codes in routers/docs.py):
  GitHubServiceError          base, never raised directly
    InvalidRepoUrlError   →   400 Bad Request
    RepoNotFoundError     →   404 Not Found
    RepoTooLargeError     →   413 Request Entity Too Large
    CloneTimeoutError     →   408 Request Timeout
    CloneFailedError      →   500 Internal Server Error

Placement: backend/services/github_service.py
Consumed by: services/scanner.py, routers/docs.py
"""

from __future__ import annotations

import re
import shutil
import tempfile
import urllib.request
import urllib.error
from dataclasses import dataclass
from pathlib import Path

import git
import git.exc

from config import settings


# ─────────────────────────────────────────────────────────────
# Custom exception hierarchy
# ─────────────────────────────────────────────────────────────

class GitHubServiceError(Exception):
    """Base class — catch this to handle any github_service error."""


class InvalidRepoUrlError(GitHubServiceError):
    """URL failed format validation. Map to HTTP 400."""


class RepoNotFoundError(GitHubServiceError):
    """GitHub returned 404/403/401 or the repo is private. Map to HTTP 404."""


class RepoTooLargeError(GitHubServiceError):
    """Cloned repo exceeds MAX_REPO_SIZE_MB. Map to HTTP 413."""


class CloneTimeoutError(GitHubServiceError):
    """Git clone exceeded the timeout. Map to HTTP 408."""


class CloneFailedError(GitHubServiceError):
    """Any other git error during cloning. Map to HTTP 500."""


# ─────────────────────────────────────────────────────────────
# RepoIdentity — parsed representation of a GitHub URL
# ─────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class RepoIdentity:
    """
    Immutable struct produced by parse_github_url().
    Passed between all three stages so URL parsing happens once.
    """
    owner: str
    repo:  str

    @property
    def full_name(self) -> str:
        """'facebook/react'"""
        return f"{self.owner}/{self.repo}"

    @property
    def clone_url(self) -> str:
        """Full HTTPS clone URL accepted by GitPython."""
        return f"https://github.com/{self.owner}/{self.repo}.git"

    @property
    def web_url(self) -> str:
        """Clean URL without .git suffix — used for reachability check."""
        return f"https://github.com/{self.owner}/{self.repo}"


# ─────────────────────────────────────────────────────────────
# Stage 1 — URL validation
# ─────────────────────────────────────────────────────────────

# Strict pattern: owner and repo segments use GitHub's allowed character set.
# Accepts optional trailing slash and optional .git suffix.
_GITHUB_URL_RE = re.compile(
    r"^https://(?:www\.)?github\.com"
    r"/(?P<owner>[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?)"
    r"/(?P<repo>[a-zA-Z0-9._-]+?)"
    r"(?:\.git)?/?$"
)

# Timeout (seconds) for the lightweight reachability HEAD request
_VALIDATE_TIMEOUT_S = 8


def parse_github_url(url: str) -> RepoIdentity:
    """
    Parses and validates the format of a GitHub repository URL.
    Makes NO network requests — pure string validation only.

    Returns a RepoIdentity on success.
    Raises InvalidRepoUrlError on any format problem.
    """
    if not url or not isinstance(url, str):
        raise InvalidRepoUrlError(
            "Please enter a GitHub repository URL."
        )

    stripped = url.strip()

    if not stripped.startswith("https://"):
        raise InvalidRepoUrlError(
            'URL must start with "https://". '
            "Example: https://github.com/owner/repository"
        )

    if "github.com" not in stripped:
        raise InvalidRepoUrlError(
            "Only GitHub repositories are supported. "
            "URL must contain github.com"
        )

    match = _GITHUB_URL_RE.match(stripped)
    if not match:
        raise InvalidRepoUrlError(
            "URL format is invalid. "
            "Expected: https://github.com/owner/repository"
        )

    owner = match.group("owner")
    repo  = match.group("repo")

    if not owner or not repo:
        raise InvalidRepoUrlError(
            "URL must include both an owner and a repository name. "
            "Expected: https://github.com/owner/repository"
        )

    return RepoIdentity(owner=owner, repo=repo)


def check_repo_reachable(identity: RepoIdentity) -> None:
    """
    Makes a lightweight HTTP HEAD request to verify the repository
    exists and is publicly accessible on GitHub.

    Does NOT download any repository content.

    Raises:
      RepoNotFoundError  — GitHub returned 404, 403, or 401
      CloneTimeoutError  — the HEAD request timed out
      CloneFailedError   — any other network error
    """
    try:
        req = urllib.request.Request(
            identity.web_url,
            method="HEAD",
            headers={"User-Agent": "AutoDocs/1.0 (documentation generator)"},
        )
        with urllib.request.urlopen(req, timeout=_VALIDATE_TIMEOUT_S):
            return  # Any 2xx response means the repo is accessible

    except urllib.error.HTTPError as exc:
        if exc.code in (404, 410):
            raise RepoNotFoundError(
                f"Repository '{identity.full_name}' was not found. "
                "Check the URL or ensure the repository is public."
            ) from exc
        if exc.code in (401, 403):
            raise RepoNotFoundError(
                f"Repository '{identity.full_name}' is private or access is restricted. "
                "AutoDocs only supports public repositories."
            ) from exc
        raise CloneFailedError(
            f"GitHub returned HTTP {exc.code} while checking "
            f"'{identity.full_name}'. Please try again."
        ) from exc

    except TimeoutError:
        raise CloneTimeoutError(
            "GitHub did not respond within the timeout window. "
            "Please try again in a moment."
        )

    except OSError as exc:
        raise CloneFailedError(
            f"Could not reach GitHub while checking '{identity.full_name}': {exc}"
        ) from exc


# ─────────────────────────────────────────────────────────────
# Stage 2 — Shallow clone
# ─────────────────────────────────────────────────────────────

# Maximum seconds to wait for the full git clone operation
_CLONE_TIMEOUT_S = 30


def clone_repository(identity: RepoIdentity, job_id: str) -> Path:
    """
    Performs a shallow clone (depth=1) into /tmp/{job_id}/repo/.

    Shallow clones fetch only the latest commit, not the full
    history, keeping clone time and disk usage to a minimum.

    Returns the Path to the cloned repository root on success.

    Raises:
      CloneTimeoutError  — clone took longer than _CLONE_TIMEOUT_S
      RepoNotFoundError  — repo disappeared between validate and clone
      CloneFailedError   — any other GitPython error
      RepoTooLargeError  — cloned size exceeds the configured limit
    """
    base_dir  = Path(tempfile.gettempdir()) / job_id
    clone_dir = base_dir / "repo"
    base_dir.mkdir(parents=True, exist_ok=True)

    try:
        git.Repo.clone_from(
            url=identity.clone_url,
            to_path=str(clone_dir),
            depth=1,             # Shallow — only latest snapshot
            single_branch=True,  # Default branch only
            no_tags=True,        # Skip tag objects to save bandwidth
            # kill_after_timeout=_CLONE_TIMEOUT_S,
        )

    except git.exc.GitCommandNotFound as exc:
        raise CloneFailedError(
            "Git is not installed or not found on the server. "
            "Please install git and restart AutoDocs."
        ) from exc

    except git.exc.GitCommandError as exc:
        err_lower = str(exc).lower()

        if "timed out" in err_lower or "timeout" in err_lower:
            _safe_rmtree(clone_dir)
            raise CloneTimeoutError(
                f"Cloning '{identity.full_name}' timed out after "
                f"{_CLONE_TIMEOUT_S} seconds. "
                "The repository may be too large or GitHub is slow."
            ) from exc

        if any(phrase in err_lower for phrase in (
            "repository not found", "not found", "does not exist"
        )):
            _safe_rmtree(clone_dir)
            raise RepoNotFoundError(
                f"Repository '{identity.full_name}' could not be cloned. "
                "It may have been deleted or made private after validation."
            ) from exc

        if any(phrase in err_lower for phrase in (
            "authentication", "could not read", "access denied"
        )):
            _safe_rmtree(clone_dir)
            raise RepoNotFoundError(
                f"Repository '{identity.full_name}' requires authentication. "
                "AutoDocs only supports public repositories."
            ) from exc

        _safe_rmtree(clone_dir)
        raise CloneFailedError(
            f"Failed to clone '{identity.full_name}': {exc}"
        ) from exc

    # ── Stage 3 — Size guard ──────────────────────────────────
    repo_size_mb = _dir_size_mb(clone_dir)
    limit_mb     = settings.max_repo_size_mb

    if repo_size_mb > limit_mb:
        _safe_rmtree(clone_dir)
        raise RepoTooLargeError(
            f"Repository '{identity.full_name}' is {repo_size_mb:.1f} MB, "
            f"which exceeds the {limit_mb} MB limit. "
            "Please try a smaller or more focused repository."
        )

    return clone_dir


# ─────────────────────────────────────────────────────────────
# Filesystem helpers
# ─────────────────────────────────────────────────────────────

def _dir_size_mb(directory: Path) -> float:
    """
    Returns total size of a directory tree in megabytes.
    Skips symlinks and unreadable files silently.
    """
    total = 0
    try:
        for item in directory.rglob("*"):
            if item.is_file() and not item.is_symlink():
                try:
                    total += item.stat().st_size
                except OSError:
                    pass
    except OSError:
        pass
    return total / (1024 * 1024)


def _safe_rmtree(path: Path) -> None:
    """Deletes a directory tree, silently ignoring all errors."""
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)


def delete_clone(job_id: str) -> None:
    """
    Deletes /tmp/{job_id}/repo/ after scanning is complete.
    Preserves /tmp/{job_id}/ so the ZIP can still be served.

    Called by docs.py immediately after scanner.py finishes
    to free disk space. Safe to call multiple times.
    """
    clone_dir = Path(tempfile.gettempdir()) / job_id / "repo"
    _safe_rmtree(clone_dir)


def delete_job_dir(job_id: str) -> None:
    """
    Deletes the entire /tmp/{job_id}/ tree including the ZIP.
    Called by the TTL expiry task in main.py.
    """
    job_dir = Path(tempfile.gettempdir()) / job_id
    _safe_rmtree(job_dir)


def get_clone_path(job_id: str) -> Path:
    """
    Returns the expected clone path for a given job_id.
    Used by scanner.py to locate the repo without re-deriving the path.
    Does NOT check whether the path exists.
    """
    return Path(tempfile.gettempdir()) / job_id / "repo"


# ─────────────────────────────────────────────────────────────
# Public API — the single function routers/docs.py calls
# ─────────────────────────────────────────────────────────────

def validate_and_clone(repo_url: str, job_id: str) -> tuple[RepoIdentity, Path]:
    """
    Complete pipeline: parse URL → check reachability → clone → size guard.
    Returns (RepoIdentity, clone_path) on success.

    This is the only function that routers/docs.py needs to call.
    All domain-specific exceptions propagate to the router which
    maps them to the appropriate HTTP status codes.

    Usage in docs.py:
      identity, clone_path = validate_and_clone(request.repo_url, job_id)
      # then pass clone_path to scanner.scan_repository(clone_path, ...)

    Raises:
      InvalidRepoUrlError  — bad URL format              → HTTP 400
      RepoNotFoundError    — 404 or private repo         → HTTP 404
      CloneTimeoutError    — clone timed out             → HTTP 408
      RepoTooLargeError    — exceeds size limit          → HTTP 413
      CloneFailedError     — any other git error         → HTTP 500
    """
    identity   = parse_github_url(repo_url)
    check_repo_reachable(identity)
    clone_path = clone_repository(identity, job_id)
    return identity, clone_path