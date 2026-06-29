"""
services/scanner.py — Repository Scanner.

Walks a cloned repository, filters noise, and builds the data
structures used by the API and frontend: folder trees, key files, and
prioritised files for AI analysis.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from utils.file_utils import (
    should_skip_dir,
    should_skip_file,
    get_file_role,
    get_language,
    score_file,
    is_text_file,
)


# ─────────────────────────────────────────────────────────────
# Result dataclasses
# ─────────────────────────────────────────────────────────────

@dataclass
class ScannedFile:
    """
    Represents a single file identified during scanning.

    name          — filename only,          e.g. "main.py"
    path          — path relative to repo,  e.g. "backend/main.py"
    absolute_path — full path on disk       (used by AI layer to read content)
    role          — "entry" | "core" | "ui" | "config" | "test" | "docs"
    language      — human-readable language, e.g. "Python"
    size_bytes    — file size on disk
    score         — importance score computed by file_utils.score_file()
    """
    name:          str
    path:          str
    absolute_path: Path
    role:          str
    language:      str
    size_bytes:    int
    score:         int


@dataclass
class ScanResult:
    """
    Everything scanner.py produces for a single repository.

    folder_tree       — nested dict for FolderTree.jsx
    key_files         — top-20 files as dicts for FileList.jsx / schemas.py
    prioritised_files — top-N ScannedFile objects for the AI layer (Phase 3)
    file_count        — total scannable files found across the repo
    folder_count      — total non-skipped directories found
    all_files         — every scanned file, sorted by score desc
    """
    folder_tree:        dict[str, Any]
    key_files:          list[dict]          # [{name, path, role}, ...]
    prioritised_files:  list[ScannedFile]   # top-N for AI analysis
    file_count:         int
    folder_count:       int
    all_files:          list[ScannedFile]   # full ranked list


# ─────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────

# Maximum files to surface in key_files (shown in the UI)
_MAX_KEY_FILES = 20

# Default maximum files to prepare for AI analysis
_DEFAULT_MAX_AI_FILES = 15


def scan_repository(
    clone_path: Path,
    max_ai_files: int = _DEFAULT_MAX_AI_FILES,
) -> ScanResult:
    """
    Entry point for the scanner. Accepts the path returned by
    github_service.clone_repository() and returns a ScanResult.

    Steps:
      1. Walk the directory tree, skipping noise (node_modules, etc.)
      2. Score every discovered file using file_utils
      3. Sort by score descending
      4. Build folder_tree (nested dict)
      5. Build key_files (top-20 dicts for the frontend)
      6. Build prioritised_files (top-N ScannedFiles for the AI)

    Args:
      clone_path   — absolute Path to the cloned repo root
      max_ai_files — how many files to include in prioritised_files

    Returns:
      ScanResult with all fields populated

    Raises:
      ValueError  — if clone_path does not exist
    """
    if not clone_path.exists():
        raise ValueError(
            f"Clone path does not exist: {clone_path}. "
            "Ensure github_service.clone_repository() completed successfully."
        )

    # ── Walk the tree ─────────────────────────────────────────
    all_files:    list[ScannedFile] = []
    folder_count: int               = 0

    for dirpath, dirnames, filenames in os.walk(clone_path):
        current_dir = Path(dirpath)

        # ── Prune directories in-place ────────────────────────
        # Modifying dirnames[:] tells os.walk not to recurse into them.
        dirnames[:] = [
            d for d in dirnames
            if not should_skip_dir(d)
        ]

        # Count this directory (unless it's the repo root itself)
        if current_dir != clone_path:
            folder_count += 1

        # ── Process files ─────────────────────────────────────
        for filename in filenames:
            file_path = current_dir / filename

            # Skip noise files
            if should_skip_file(file_path):
                continue

            # Skip unreadable / binary files
            try:
                size_bytes = file_path.stat().st_size
            except OSError:
                continue

            # Relative path from the repo root (for display)
            try:
                rel_path = file_path.relative_to(clone_path)
            except ValueError:
                continue

            role     = get_file_role(rel_path)
            language = get_language(rel_path)
            score    = score_file(rel_path, size_bytes)

            all_files.append(ScannedFile(
                name=filename,
                path=str(rel_path).replace("\\", "/"),   # normalise to forward slashes
                absolute_path=file_path,
                role=role,
                language=language,
                size_bytes=size_bytes,
                score=score,
            ))

    # ── Sort by score descending ──────────────────────────────
    all_files.sort(key=lambda f: f.score, reverse=True)

    # ── Build outputs ─────────────────────────────────────────
    folder_tree       = _build_folder_tree(all_files, clone_path)
    key_files         = _build_key_files(all_files, _MAX_KEY_FILES)
    prioritised_files = _build_prioritised_files(all_files, max_ai_files)

    return ScanResult(
        folder_tree       = folder_tree,
        key_files         = key_files,
        prioritised_files = prioritised_files,
        file_count        = len(all_files),
        folder_count      = folder_count,
        all_files         = all_files,
    )


# ─────────────────────────────────────────────────────────────
# Internal builders
# ─────────────────────────────────────────────────────────────

def _build_folder_tree(
    files: list[ScannedFile],
    clone_path: Path,
) -> dict[str, Any]:
    """
    Builds a nested dict representing the repository's folder structure.
    The shape matches what FolderTree.jsx expects:

      {
        "backend": {
          "services": {
            "scanner.py": None
          },
          "main.py": None
        },
        "frontend": {
          "src": { ... }
        }
      }

    Leaf values are None (files). Interior values are dicts (folders).
    Only directories that contain at least one non-skipped file are included.
    """
    tree: dict[str, Any] = {}

    for scanned_file in files:
        parts = scanned_file.path.split("/")
        node  = tree

        # Navigate / create interior folder nodes
        for part in parts[:-1]:
            if part not in node or not isinstance(node[part], dict):
                node[part] = {}
            node = node[part]

        # Place the file as a leaf (None value)
        node[parts[-1]] = None

    return tree


def _build_key_files(
    files: list[ScannedFile],
    max_files: int,
) -> list[dict]:
    """
    Returns the top-N files as plain dicts for the frontend.
    Shape matches the KeyFile schema in models/schemas.py:
      { "name": str, "path": str, "role": str }

    Files are already sorted by score — we just take the top slice.
    We skip pure docs and test files from the visible list since
    they are less interesting to display but still sent to the AI.
    """
    display_files = [
        f for f in files
        if f.role not in ("docs",)
    ]

    return [
        {"name": f.name, "path": f.path, "role": f.role}
        for f in display_files[:max_files]
    ]


def _build_prioritised_files(
    files: list[ScannedFile],
    max_files: int,
) -> list[ScannedFile]:
    """
    Returns the top-N ScannedFile objects for the AI analysis layer.

    Selection strategy:
      1. Exclude binary / non-text files (verified by reading first 8 KB)
      2. Exclude files larger than 200 KB (too large for useful AI analysis)
      3. Take the top-N by score from what remains

    The is_text_file check is done here (not during the walk) so the
    walk remains fast — we only pay the I/O cost for files that are
    actually candidates.
    """
    MAX_FILE_SIZE = 200_000  # 200 KB

    candidates: list[ScannedFile] = []

    for f in files:
        if len(candidates) >= max_files:
            break

        # Hard size limit
        if f.size_bytes > MAX_FILE_SIZE:
            continue

        # Binary / unreadable files
        if not is_text_file(f.absolute_path):
            continue

        candidates.append(f)

    return candidates