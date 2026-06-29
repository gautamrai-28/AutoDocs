"""
utils/token_counter.py — Token Counting Utilities

Thin wrapper around tiktoken so the rest of the codebase never
imports tiktoken directly. Centralises:
  - Which encoding to use (must match the OpenAI model family)
  - How file content gets trimmed to fit a token budget
  - How prompt assembly stays within per-request limits

No imports from the rest of the codebase — pure utility.

Consumed by: generators/file_explainer.py, generators/folder_summariser.py,
             generators/readme_generator.py, services/ai_service.py

Placement: backend/utils/token_counter.py
"""

from __future__ import annotations

import tiktoken

# ─────────────────────────────────────────────────────────────
# Encoding selection
# ─────────────────────────────────────────────────────────────

# "o200k_base" is the encoding used by gpt-4o and gpt-4o-mini.
# Cached at module load — tiktoken downloads/parses the encoding
# once and reuses it for every call in this process.
_ENCODING_NAME = "o200k_base"
_encoding: tiktoken.Encoding | None = None

# Sentinel flag so we only attempt (and fail) the network load once,
# not on every single count_tokens() invocation.
_encoding_load_failed = [False]


def _get_encoding() -> tiktoken.Encoding | None:
    """
    Lazily loads and caches the tiktoken encoding.

    Returns None if the encoding cannot be loaded — e.g. in
    sandboxed or fully offline environments where tiktoken's
    BPE vocabulary file can't be downloaded and isn't cached
    locally. Callers fall back to _estimate_tokens() in that case.

    This is NOT a normal failure mode in a real deployment (the
    encoding is small and downloads once, then caches to disk),
    but the fallback means token counting never crashes the
    request pipeline even in a restricted network environment.
    """
    global _encoding
    if _encoding is None and not _encoding_load_failed[0]:
        try:
            _encoding = tiktoken.get_encoding(_ENCODING_NAME)
        except Exception:
            try:
                _encoding = tiktoken.get_encoding("cl100k_base")
            except Exception:
                _encoding_load_failed[0] = True
    return _encoding


def _estimate_tokens(text: str) -> int:
    """
    Pure-Python fallback token estimator — used only when the
    real tiktoken encoding can't be loaded (see _get_encoding).

    Approximation: ~4 characters per token for English text and
    code, which is the commonly cited average for GPT tokenizers.
    Errs slightly high to keep truncation conservative (safer to
    under-fill the budget than overflow it).
    """
    if not text:
        return 0
    return max(1, len(text) // 4)


# ─────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────

def count_tokens(text: str) -> int:
    """
    Returns the token count for a string.

    Uses tiktoken's exact encoding when available. Falls back to
    a character-based estimate (_estimate_tokens) if the encoding
    can't be loaded — see _get_encoding() for why that can happen.

    >>> count_tokens("Hello, world!") > 0
    True
    >>> count_tokens("") == 0
    True
    """
    if not text:
        return 0

    encoding = _get_encoding()
    if encoding is None:
        return _estimate_tokens(text)

    return len(encoding.encode(text))


def truncate_to_tokens(text: str, max_tokens: int) -> str:
    """
    Truncates text to at most max_tokens tokens, preserving
    the beginning of the text (most files have their most
    important content — imports, class/function signatures —
    near the top).

    Returns the text unchanged if it already fits.
    Falls back to a character-based truncation (4 chars/token
    estimate) if the tiktoken encoding can't be loaded.

    >>> truncate_to_tokens("short text", 1000) == "short text"
    True
    """
    if not text or max_tokens <= 0:
        return ""

    encoding = _get_encoding()

    if encoding is None:
        # Character-based fallback truncation
        max_chars = max_tokens * 4
        if len(text) <= max_chars:
            return text
        return text[:max_chars] + "\n\n... [truncated for length]"

    tokens = encoding.encode(text)

    if len(tokens) <= max_tokens:
        return text

    truncated_tokens = tokens[:max_tokens]
    truncated_text   = encoding.decode(truncated_tokens)

    return truncated_text + "\n\n... [truncated for length]"


def fits_in_budget(text: str, max_tokens: int) -> bool:
    """
    Quick boolean check — avoids truncating when not needed.

    >>> fits_in_budget("hi", 100)
    True
    """
    return count_tokens(text) <= max_tokens


# ─────────────────────────────────────────────────────────────
# Budget constants
# ─────────────────────────────────────────────────────────────

class TokenBudget:
    """
    Centralised token limits for every AI call the application
    makes. Changing a limit here changes it everywhere — no
    magic numbers scattered across the generator files.
    """

    # Per-file content sent for explanation (Phase 3 file_explainer)
    MAX_FILE_CONTENT_TOKENS = 3_000

    # Total tokens in a single OpenAI request (prompt + content)
    MAX_REQUEST_TOKENS = 8_000

    # Per-file explanation response length (max_tokens param to OpenAI)
    MAX_FILE_EXPLANATION_RESPONSE = 350

    # Folder summary response length
    MAX_FOLDER_SUMMARY_RESPONSE = 200

    # README generation — larger because it synthesises everything
    MAX_README_RESPONSE = 1_200

    # How many file explanations to include when building the
    # README prompt context (avoids re-sending all 15 in full)
    MAX_SUMMARIES_FOR_README = 15


def estimate_request_cost_tokens(
    prompt: str,
    expected_response_tokens: int,
) -> int:
    """
    Rough total token estimate for a single request — used for
    logging / budget checks before calling the OpenAI API.
    Not billed precisely (OpenAI bills prompt + completion
    separately) but useful for pre-flight sanity checks.
    """
    return count_tokens(prompt) + expected_response_tokens