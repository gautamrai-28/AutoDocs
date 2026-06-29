"""
generators/file_explainer.py — Prompt builders for file explanations.

This module builds the prompt text used by the documentation pipeline and
parses the model response into a plain-English explanation. It does not
perform network calls directly; services/ai_service.py owns the provider
request lifecycle.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

from utils.token_counter import truncate_to_tokens, TokenBudget


# ─────────────────────────────────────────────────────────────
# Prompt data structure
# ─────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class FileExplanationPrompt:
    """
    The system and user messages needed for a chat completion request.
    The shape stays provider-agnostic so the request layer can swap
    implementations without changing prompt construction.
    """
    system: str
    user:   str
    max_response_tokens: int


@dataclass(frozen=True)
class BatchAnalysisPrompt:
    """
    A prompt bundle for batched repository analysis.

    The current pipeline uses this structure when multiple files are sent
    to the provider in a single request.
    """
    system: str
    user:   str
    max_response_tokens: int


# ─────────────────────────────────────────────────────────────
# System prompt — sets the AI's role and output constraints
# ─────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = (
    "You are a senior software engineer writing internal technical "
    "documentation for a codebase. You explain source files clearly "
    "and concisely for other developers who have not read the code. "
    "You write in plain English prose — no markdown headers, no code "
    "fences, no bullet-point lists. Two to three short paragraphs. "
    "Never invent functionality that isn't shown in the file content. "
    "If the file content appears truncated, explain what's visible "
    "and note that the file continues beyond what was shown."
)


# ─────────────────────────────────────────────────────────────
# Role-specific framing
# ─────────────────────────────────────────────────────────────

# Adjusts the instruction slightly based on the file's role,
# so an entry point gets framed differently from a config file.
_ROLE_FRAMING: dict[str, str] = {
    "entry":  "This file is the application's entry point.",
    "core":   "This file is a core service or utility module.",
    "ui":     "This file is a frontend UI component.",
    "config": "This file is a configuration or manifest file.",
    "test":   "This file contains tests.",
    "docs":   "This file is documentation.",
}


def _build_role_hint(role: str) -> str:
    """Returns a short framing sentence for the given file role."""
    return _ROLE_FRAMING.get(role, "This file is part of the codebase.")


# ─────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────

def build_file_explanation_prompt(
    file_path:    str,
    file_role:    str,
    language:     str,
    file_content: str,
) -> FileExplanationPrompt:
    """
    Builds the system + user prompt pair for explaining one file.

    The file content is truncated to TokenBudget.MAX_FILE_CONTENT_TOKENS
    before being embedded in the prompt — this keeps any single file
    from blowing the per-request token budget regardless of its
    actual size on disk.

    Args:
      file_path     — relative path, e.g. "backend/services/auth.py"
      file_role     — one of: entry, core, ui, config, test, docs
      language      — human-readable language name, e.g. "Python"
      file_content  — raw source code as a string

    Returns:
      FileExplanationPrompt ready to pass to the OpenAI client.

    >>> p = build_file_explanation_prompt("main.py", "entry", "Python", "x = 1")
    >>> "main.py" in p.user
    True
    """
    trimmed_content = truncate_to_tokens(
        file_content,
        TokenBudget.MAX_FILE_CONTENT_TOKENS,
    )

    role_hint = _build_role_hint(file_role)

    user_prompt = (
        f"File: {file_path}\n"
        f"Language: {language}\n"
        f"{role_hint}\n\n"
        f"Explain what this file does, its key functions or components, "
        f"and how it likely fits into the broader project. "
        f"Write for a developer who has never seen this codebase.\n\n"
        f"--- FILE CONTENT START ---\n"
        f"{trimmed_content}\n"
        f"--- FILE CONTENT END ---"
    )

    return FileExplanationPrompt(
        system=_SYSTEM_PROMPT,
        user=user_prompt,
        max_response_tokens=TokenBudget.MAX_FILE_EXPLANATION_RESPONSE,
    )


def parse_file_explanation_response(raw_response: str) -> str:
    """
    Cleans up the raw text returned by the OpenAI API into the
    final explanation string stored against the file.

    Handles common model output quirks:
      - Strips leading/trailing whitespace
      - Removes accidental markdown code fences if the model
        wrapped its prose in ``` despite instructions not to
      - Removes a leading "File: ..." echo if the model repeats
        the prompt's framing line back

    Returns an empty-string-safe fallback message if the response
    is empty or whitespace-only, so downstream code never has to
    guard against None or "".

    >>> parse_file_explanation_response("  Some explanation.  ")
    'Some explanation.'
    """
    if not raw_response or not raw_response.strip():
        return "No explanation could be generated for this file."

    cleaned = raw_response.strip()

    # Strip wrapping code fences if present (```...```)
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        lines = lines[1:]  # drop opening fence (may include language tag)
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]  # drop trailing fence
        cleaned = "\n".join(lines).strip()

    # Strip an echoed "File: ..." line if the model repeated it
    lines = cleaned.split("\n")
    if lines and lines[0].strip().lower().startswith("file:"):
        cleaned = "\n".join(lines[1:]).strip()

    return cleaned or "No explanation could be generated for this file."


def build_batch_analysis_prompt(
    files: list[dict[str, str]],
    repo_name: str | None = None,
) -> BatchAnalysisPrompt:
    """
    Builds a batch analysis prompt for future staged refactoring.

    This function is intentionally unused in Step 1. It exists to
    prepare the application for a later refactor where the AI will
    analyse many files together in a single request and return a
    structured JSON object.

    Args:
      files — a list of file metadata dictionaries. Each item must
               include the keys: file_path, file_role, language, and
               file_content.
      repo_name — optional display name for the repository.

    Returns:
      BatchAnalysisPrompt ready to pass to the Groq client.
    """
    repo_section = f"Repository: {repo_name}\n\n" if repo_name else ""

    file_blocks = []
    for file in files:
        file_blocks.append(
            (
                "--- FILE START ---\n"
                f"Path: {file['file_path']}\n"
                f"Role: {file['file_role']}\n"
                f"Language: {file['language']}\n"
                "Content:\n"
                f"{file['file_content']}\n"
                "--- FILE END ---"
            )
        )

    user_prompt = (
        f"{repo_section}"
        "You are a senior software engineer analysing a repository at scale. "
        "Analyse every supplied file together and produce a single JSON "
        "object with exactly two top-level keys: file_explanations and "
        "folder_summaries. Return valid JSON only, with no markdown, no "
        "code fences, and no extra explanation outside the JSON object. "
        "Include every supplied file in the output.\n\n"
        "Files:\n"
        + "\n\n".join(file_blocks)
    )

    return BatchAnalysisPrompt(
        system=(
            "You are a senior software engineer analysing a repository at "
            "scale. You will be given multiple files and must extract a "
            "clear explanation for each file along with grouped folder "
            "summaries. Return only valid JSON with no markdown, no code "
            "fences, and no extra prose outside the JSON object. The JSON "
            "must include both file_explanations and folder_summaries."
        ),
        user=user_prompt,
        max_response_tokens=TokenBudget.MAX_README_RESPONSE,
    )


def parse_batch_analysis_response(
    raw_response: str,
) -> tuple[dict[str, str], dict[str, str]]:
    """
    Parses the JSON response from a future batch analysis flow.

    Strips optional code fences and attempts to decode the response as
    JSON. If parsing fails or the structure is unexpected, this function
    returns two empty dictionaries rather than raising, so the current
    runtime remains unaffected during Step 1.
    """
    if not raw_response or not raw_response.strip():
        return {}, {}

    cleaned = raw_response.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        return {}, {}

    if not isinstance(payload, dict):
        return {}, {}

    file_explanations = payload.get("file_explanations")
    folder_summaries = payload.get("folder_summaries")

    if not isinstance(file_explanations, dict) or not isinstance(folder_summaries, dict):
        return {}, {}

    sanitized_files = {
        str(key): str(value)
        for key, value in file_explanations.items()
        if isinstance(key, str)
    }
    sanitized_folders = {
        str(key): str(value)
        for key, value in folder_summaries.items()
        if isinstance(key, str)
    }

    return sanitized_files, sanitized_folders


def read_file_content(absolute_path) -> str:
    """
    Safely reads a file's text content for prompt building.

    Returns an empty string (rather than raising) if the file
    can't be read — ai_service.py treats an empty content string
    as "skip this file" rather than crashing the whole batch.

    Accepts a Path or str; kept loosely typed so callers in
    services/ai_service.py don't need an extra import just to
    satisfy a type hint.
    """
    try:
        with open(absolute_path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except (OSError, PermissionError, UnicodeDecodeError):
        return ""