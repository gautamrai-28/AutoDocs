"""ZIP packaging helpers for generated documentation downloads."""

from __future__ import annotations

import io
import zipfile
from typing import Any


def build_documentation_zip(
    repo_name: str,
    scan,
    readme_content: str,
    doc_count: int,
) -> bytes:
    """Build a ZIP archive containing the generated markdown documents."""
    buf = io.BytesIO()

    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("README.md", readme_content or "# README\n\nDocumentation generation completed.\n")

        key_files = "\n".join(
            f"- {item['path']} [{item['role']}]"
            for item in getattr(scan, "key_files", [])
        ) or "- None"

        summary = (
            f"# Scan Summary\n\n"
            f"- Repository: {repo_name}\n"
            f"- Files scanned: {getattr(scan, 'file_count', 0)}\n"
            f"- Folders scanned: {getattr(scan, 'folder_count', 0)}\n"
            f"- Files analysed by AI: {len(getattr(scan, 'prioritised_files', []))}\n"
            f"- Number of generated documents: {doc_count}\n\n"
            f"## Key files\n\n{key_files}\n"
        )
        zf.writestr("Scan_Summary.md", summary)

        tree_lines = _tree_to_text(getattr(scan, "folder_tree", {}))
        tree_content = f"# Folder Structure\n\n```text\n{tree_lines}\n```\n"
        zf.writestr("Folder_Structure.md", tree_content)

    buf.seek(0)
    return buf.read()


def _tree_to_text(node: dict[str, Any], indent: str = "") -> str:
    """Converts the folder_tree dict into an ASCII tree string."""
    lines: list[str] = []
    items = list(node.items())
    for i, (name, value) in enumerate(items):
        is_last = i == len(items) - 1
        connector = "└── " if is_last else "├── "
        child_pfx = indent + ("    " if is_last else "│   ")
        if isinstance(value, dict):
            lines.append(f"{indent}{connector}{name}/")
            lines.append(_tree_to_text(value, child_pfx))
        else:
            lines.append(f"{indent}{connector}{name}")
    return "\n".join(line for line in lines if line)
