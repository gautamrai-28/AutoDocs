"""
generators/folder_summariser.py — Folder-Level AI Summary Prompts

Builds the prompt that asks the AI to summarise a single
directory's purpose, given the explanations already generated
for the files inside it by file_explainer.py.

Design decision — same pattern as file_explainer.py:
  - build_folder_summary_prompt() builds the system + user
    messages from a folder path + its child file explanations
  - parse_folder_summary_response() cleans up the raw model text
  - The actual OpenAI call is owned by services/ai_service.py

This file never reads files from disk and never calls OpenAI —
it only transforms data already produced by an earlier stage
(file_explainer's output) into the next prompt in the pipeline.

Consumed by: services/ai_service.py
Depends on: utils/token_counter.py (for trimming combined context)

Placement: backend/generators/folder_summariser.py
"""

from __future__ import annotations

from dataclasses import dataclass

from utils.token_counter import count_tokens, TokenBudget


# ─────────────────────────────────────────────────────────────
# Data structures
# ─────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class FileExplanationEntry:
    """
    One file's explanation, scoped to a single folder.
    This is the input unit ai_service.py groups by folder
    before calling build_folder_summary_prompt().

    filename     — name only, e.g. "auth.py" (not the full path)
    explanation  — the text produced by file_explainer's pipeline
    """
    filename:    str
    explanation: str


@dataclass(frozen=True)
class FolderSummaryPrompt:
    """
    The two messages needed for a chat completion call
    that summarises one folder. Provider-agnostic — mirrors
    FileExplanationPrompt's
    shape in file_explainer.py for consistency across generators.
    """
    system: str
    user:   str
    max_response_tokens: int


# ─────────────────────────────────────────────────────────────
# System prompt
# ─────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = (
    "You are a senior software engineer writing internal technical "
    "documentation for a codebase. You are given short explanations "
    "of the files inside a single directory, and your job is to "
    "summarise the directory's overall purpose and responsibility "
    "within the project. Write one focused paragraph — not a list, "
    "not separate sentences per file. Describe the folder as a "
    "cohesive unit. No markdown headers, no code fences. "
    "If only one file's explanation is provided, summarise the "
    "folder based on that file alone without claiming there are others."
)


# ─────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────

def build_folder_summary_prompt(
    folder_path: str,
    file_explanations: list[FileExplanationEntry],
) -> FolderSummaryPrompt:
    """
    Builds the system + user prompt pair for summarising one folder.

    The combined file explanations are truncated to fit within
    TokenBudget.MAX_REQUEST_TOKENS minus a reserved margin for the
    system prompt and instructions, so a folder with many files
    never blows the per-request budget.

    Args:
      folder_path        — relative path, e.g. "backend/services"
      file_explanations  — explanations of files directly inside
                            this folder (not subfolders)

    Returns:
      FolderSummaryPrompt ready to pass to the OpenAI client.

    Raises:
      ValueError — if file_explanations is empty. A folder summary
                   with zero file context is meaningless; the caller
                   (ai_service.py) should skip folders with no
                   analysed files rather than calling this function.

    >>> entries = [FileExplanationEntry("auth.py", "Handles login.")]
    >>> p = build_folder_summary_prompt("services", entries)
    >>> "auth.py" in p.user
    True
    """
    if not file_explanations:
        raise ValueError(
            f"Cannot build a folder summary prompt for '{folder_path}' "
            "with zero file explanations. Skip folders with no "
            "analysed files before calling this function."
        )

    # Reserve room for the instruction text itself
    budget_for_files = TokenBudget.MAX_REQUEST_TOKENS - 500

    file_blocks = []
    running_tokens = 0

    for entry in file_explanations:
        block = f"- {entry.filename}: {entry.explanation}"
        block_tokens = count_tokens(block)

        if running_tokens + block_tokens > budget_for_files:
            # Stop adding files once the budget is reached rather
            # than truncating mid-explanation, which would produce
            # garbled context for the model.
            file_blocks.append(
                f"- [{len(file_explanations) - len(file_blocks)} more "
                f"file(s) omitted for length]"
            )
            break

        file_blocks.append(block)
        running_tokens += block_tokens

    files_section = "\n".join(file_blocks)

    user_prompt = (
        f"Folder: {folder_path}\n\n"
        f"This folder contains the following files, each with a "
        f"short explanation of what it does:\n\n"
        f"{files_section}\n\n"
        f"Write one paragraph summarising what this folder is "
        f"responsible for in the overall project."
    )

    return FolderSummaryPrompt(
        system=_SYSTEM_PROMPT,
        user=user_prompt,
        max_response_tokens=TokenBudget.MAX_FOLDER_SUMMARY_RESPONSE,
    )


def parse_folder_summary_response(raw_response: str) -> str:
    """
    Cleans up the raw text returned by the OpenAI API into the
    final folder summary string.

    Uses the same cleanup rules as file_explainer's response
    parser (strip whitespace, strip accidental code fences,
    strip an echoed "Folder: ..." line) so behaviour is
    consistent across both generators.

    >>> parse_folder_summary_response("  A summary.  ")
    'A summary.'
    """
    if not raw_response or not raw_response.strip():
        return "No summary could be generated for this folder."

    cleaned = raw_response.strip()

    # Strip wrapping code fences if present
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    # Strip an echoed "Folder: ..." line if the model repeated it
    lines = cleaned.split("\n")
    if lines and lines[0].strip().lower().startswith("folder:"):
        cleaned = "\n".join(lines[1:]).strip()

    return cleaned or "No summary could be generated for this folder."


# ─────────────────────────────────────────────────────────────
# Helper: group flat file explanations by their parent folder
# ─────────────────────────────────────────────────────────────

def group_explanations_by_folder(
    file_paths_with_explanations: list[tuple[str, str]],
) -> dict[str, list[FileExplanationEntry]]:
    """
    Groups (path, explanation) pairs by their immediate parent
    folder, producing the input shape build_folder_summary_prompt()
    expects for each folder.

    This is the bridge function ai_service.py calls between
    "I have explanations for 15 files" and "I need to summarise
    each folder those files live in."

    Files at the repository root (no parent folder) are grouped
    under the key "" (empty string) — callers can choose to skip
    generating a summary for the root or label it specially.

    Args:
      file_paths_with_explanations — list of (relative_path, explanation)
        e.g. [("backend/services/auth.py", "Handles login."), ...]

    Returns:
      dict mapping folder_path -> list[FileExplanationEntry]

    >>> result = group_explanations_by_folder([
    ...     ("backend/services/auth.py", "Handles login."),
    ...     ("backend/services/user.py", "Manages users."),
    ...     ("main.py", "Entry point."),
    ... ])
    >>> sorted(result.keys())
    ['', 'backend/services']
    >>> len(result["backend/services"])
    2
    """
    grouped: dict[str, list[FileExplanationEntry]] = {}

    for path, explanation in file_paths_with_explanations:
        normalised = path.replace("\\", "/")
        parts      = normalised.rsplit("/", 1)

        if len(parts) == 1:
            # File is at the repository root — no parent folder
            folder_path = ""
            filename    = parts[0]
        else:
            folder_path, filename = parts

        grouped.setdefault(folder_path, []).append(
            FileExplanationEntry(filename=filename, explanation=explanation)
        )

    return grouped