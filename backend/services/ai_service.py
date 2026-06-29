"""
services/ai_service.py — AI orchestration for the current Groq pipeline.

This module owns the provider client and coordinates the current
documentation flow: batch analysis of screened files followed by README
synthesis. The prompt builders in the generators package remain
provider-agnostic and only receive prompt text plus parsed responses.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

from groq import AsyncGroq, APIError

from config import settings
from services.scanner import ScanResult, ScannedFile

from generators.file_explainer import (
    build_batch_analysis_prompt,
    parse_batch_analysis_response,
    read_file_content,
)
from generators.readme_generator import (
    build_readme_prompt,
    parse_readme_response,
    build_readme_preview,
    RepoContext,
)
from utils.batch_builder import BatchBuilder, TokenizedFile
from utils.rate_limiter import TPMRateLimiter
from utils.token_counter import count_tokens


# ─────────────────────────────────────────────────────────────
# Exception hierarchy
# ─────────────────────────────────────────────────────────────

class AIServiceError(Exception):
    """Base class for all ai_service errors."""


class AIConfigError(AIServiceError):
    """Raised when GROQ_API_KEY is missing or invalid. Map to HTTP 500."""


class AIGenerationError(AIServiceError):
    """Raised when the Groq API call fails after retries. Map to HTTP 502."""


# ─────────────────────────────────────────────────────────────
# Result data structure
# ─────────────────────────────────────────────────────────────

@dataclass
class AIPipelineResult:
    """
    Everything the AI layer produces for a single generation job.

    file_explanations  — {relative_path: explanation_text}
    folder_summaries   — {folder_path: summary_text}
    readme_content     — full generated README.md text
    readme_preview     — first ~500 chars for ReadmePreview.jsx
    doc_count          — total markdown documents this represents
                          (1 README + 1 per folder summary + 1 per
                          file explanation), used for GenerateResponse
    """
    file_explanations: dict[str, str]
    folder_summaries:  dict[str, str]
    readme_content:    str
    readme_preview:    str
    doc_count:         int


# ─────────────────────────────────────────────────────────────
# Groq client — async-safe module-level singleton
# ─────────────────────────────────────────────────────────────

_client: AsyncGroq | None = None

# Guards _client construction against the concurrent-first-request
# race: without this, two FastAPI requests arriving before either
# has finished initialising could both observe `_client is None`
# and each construct a separate AsyncGroq. The lock makes
# "check, then construct" atomic with respect to other coroutines
# on the same event loop.
_client_lock = asyncio.Lock()


async def _get_client() -> AsyncGroq:
    """
    Lazily creates and caches the Groq client, protected by
    _client_lock so only one client is ever constructed per
    process even under concurrent first requests.

    Raises AIConfigError immediately with a clear message if the
    API key is missing, rather than letting the first real API
    call fail with an opaque authentication error deep in the
    pipeline.

    Reads settings.groq_api_key (config.py adds this field).

    Note: this function is async because it must acquire _client_lock,
    which requires an event loop. All callers already run inside async
    functions, so this is a transparent change to internal call sites;
    the public run_full_pipeline() interface is unaffected.
    """
    global _client

    if _client is not None:
        return _client

    async with _client_lock:
        if _client is None:
            api_key = getattr(settings, "groq_api_key", "")
            if not api_key:
                raise AIConfigError(
                    "GROQ_API_KEY is not set. Add it to your .env file "
                    "before generating documentation."
                )
            _client = AsyncGroq(api_key=api_key)

    return _client


# ─────────────────────────────────────────────────────────────
# Low-level Groq call wrapper
# ─────────────────────────────────────────────────────────────

# Retry up to this many times on retryable errors (rate limits,
# server errors) before giving up on a single prompt.
_MAX_RETRIES = 2

# HTTP status codes worth retrying — transient/rate-limit conditions
# where a second attempt has a real chance of succeeding.
_RETRYABLE_STATUS_CODES = frozenset({429, 500, 502, 503, 504})


def _is_retryable(exc: APIError) -> bool:
    """
    Returns True if an APIError represents a transient condition
    worth retrying (429 rate limit, 5xx server error).

    Returns False for non-retryable client errors (400, 401, 403,
    404, and any other 4xx) — retrying these wastes time and an
    API call slot, since an identical request will fail the same way.

    APIError.status_code is populated by the Groq SDK when available,
    so we check it first; if not available, we treat it as non-retryable
    for safety.
    """
    status_code = getattr(exc, "status_code", None)
    if status_code is None:
        return False
    return status_code in _RETRYABLE_STATUS_CODES


def _extract_response_text(response) -> str:
    """
    Safely extracts text from a Groq response, converting every
    failure mode into a single, predictable outcome the caller can
    handle uniformly.

    Three things can go wrong here in practice:
      1. response.choices is empty or None — the API returns no choices,
         which can happen if the response is blocked or otherwise empty.
      2. response.choices[0].message.content is None — defensive check
         in case an unexpected response shape occurs.
      3. response.choices[0].message.content is an empty/whitespace-only
         string — treated identically to None; there's nothing useful
         to return.

    Raises:
      AIGenerationError — in all three failure cases above, with a
                           message indicating which one occurred so
                           it's distinguishable in logs.
    """
    try:
        if not response.choices or len(response.choices) == 0:
            raise AIGenerationError(
                "Groq returned no choices in response. The response may have been "
                "blocked or contained no valid content."
            )

        text = response.choices[0].message.content
    except (AttributeError, IndexError, TypeError) as exc:
        raise AIGenerationError(
            f"Failed to extract text from Groq response: {exc}"
        ) from exc

    if text is None:
        raise AIGenerationError(
            "Groq returned no text content in the message."
        )

    stripped = text.strip()
    if not stripped:
        raise AIGenerationError("Groq returned an empty text response.")

    return stripped


async def _call_groq(
    system_prompt: str,
    user_prompt:   str,
    max_output_tokens: int,
) -> str:
    """
    Makes a single Groq chat completion call and returns the
    raw text response.

    Uses the SDK's native async interface (client.chat.completions.create)
    which is fully async (awaitable coroutine) and does not require
    thread wrapping. This avoids consuming a thread from Python's
    default thread pool executor for the full duration of each call —
    holds no OS threads.

    Retry policy: only retries on transient errors (429, 5xx) via
    _is_retryable(). Non-retryable errors (400, 401, 403, 404, and
    any other 4xx) raise immediately on the first attempt — there
    is no reasonable expectation that an identical retried request
    succeeds, so retrying them only adds latency.

    Raises:
      AIConfigError     — missing/invalid API key
      AIGenerationError — call failed after exhausting retries, or
                          failed on the first attempt with a
                          non-retryable error
    """
    client = await _get_client()

    last_error: Exception | None = None

    for attempt in range(_MAX_RETRIES + 1):
        try:
            response = await client.chat.completions.create(
                model=settings.groq_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=max_output_tokens,
                temperature=0.3,
            )

            return _extract_response_text(response)

        except APIError as exc:
            last_error = exc

            if not _is_retryable(exc):
                status_code = getattr(exc, "status_code", "unknown")
                raise AIGenerationError(
                    f"Groq API call failed with non-retryable error "
                    f"{status_code}: {exc}"
                ) from exc

            if attempt < _MAX_RETRIES:
                await asyncio.sleep(1.5 * (attempt + 1))
                continue

            status_code = getattr(exc, "status_code", "unknown")
            raise AIGenerationError(
                f"Groq API call failed after {_MAX_RETRIES + 1} attempts "
                f"(last error {status_code}): {exc}"
            ) from exc

        except AIGenerationError as exc:
            last_error = exc
            if attempt < _MAX_RETRIES:
                await asyncio.sleep(1.5 * (attempt + 1))
                continue
            raise

    raise AIGenerationError(f"Groq API call failed: {last_error}")


# ─────────────────────────────────────────────────────────────
# Stage 1 — Batch analysis
# ─────────────────────────────────────────────────────────────

async def analyse_all_at_once(scan: ScanResult) -> tuple[dict[str, str], dict[str, str]]:
    """
    Reads every prioritised file once, estimates each file's token cost,
    packs them into batches, sends one Groq request per batch, and merges
    the parsed file explanations and folder summaries into the final
    return value.
    """
    if not scan.prioritised_files:
        return {}, {}

    tokenized_files: list[TokenizedFile] = []
    prepared_contents: dict[str, str] = {}

    for scanned_file in scan.prioritised_files:
        content = read_file_content(scanned_file.absolute_path)
        estimated_tokens = count_tokens(content)

        tokenized_files.append(
            TokenizedFile(
                file=scanned_file,
                estimated_tokens=estimated_tokens,
            )
        )
        prepared_contents[scanned_file.path] = content

    batch_builder = BatchBuilder()
    batches = batch_builder.build_batches(tokenized_files)
    rate_limiter = TPMRateLimiter()

    merged_file_explanations: dict[str, str] = {}
    merged_folder_summaries: dict[str, str] = {}

    for batch in batches:
        batch_files = []
        for scanned_file in batch.files:
            content = prepared_contents[scanned_file.path]
            batch_files.append(
                {
                    "file_path": scanned_file.path,
                    "file_role": scanned_file.role,
                    "language": scanned_file.language,
                    "file_content": content,
                }
            )

        prompt = build_batch_analysis_prompt(files=batch_files)
        batch_tokens = count_tokens(prompt.system) + count_tokens(prompt.user)

        await rate_limiter.wait_if_needed(batch_tokens)

        raw_response = await _call_groq(
            prompt.system,
            prompt.user,
            prompt.max_response_tokens,
        )

        file_explanations, folder_summaries = parse_batch_analysis_response(
            raw_response
        )

        if not file_explanations or not folder_summaries:
            raise AIGenerationError(
                "Failed to parse batch analysis response into file_explanations "
                "and folder_summaries."
            )

        merged_file_explanations.update(file_explanations)
        merged_folder_summaries.update(folder_summaries)

    return merged_file_explanations, merged_folder_summaries


# ─────────────────────────────────────────────────────────────
# Stage 2 — README generation
# ─────────────────────────────────────────────────────────────

async def generate_readme(
    repo_name:         str,
    file_count:        int,
    folder_count:      int,
    prioritised_files: list[ScannedFile],
    folder_summaries:  dict[str, str],
) -> tuple[str, str]:
    """
    Generates the final README using everything produced by the
    earlier stages. Returns (full_readme_content, preview_snippet).

    Raises AIGenerationError if the call fails — unlike file/folder
    failures, a failed README has no reasonable per-item fallback
    since it's the single headline document of the whole job.
    """
    languages = _detect_languages(prioritised_files)
    key_paths = [f.path for f in prioritised_files]

    context = RepoContext(
        repo_name=repo_name,
        file_count=file_count,
        folder_count=folder_count,
        languages=languages,
        key_file_paths=key_paths,
        folder_summaries=folder_summaries,
    )

    prompt = build_readme_prompt(context)
    raw_response = await _call_groq(
        prompt.system, prompt.user, prompt.max_response_tokens
    )

    readme_content = parse_readme_response(raw_response)
    preview = build_readme_preview(readme_content, max_chars=500)

    return readme_content, preview


def _detect_languages(files: list[ScannedFile]) -> list[str]:
    """
    Returns distinct languages from the prioritised files,
    ordered by frequency (most common first). Used to populate
    RepoContext.languages for the README prompt.
    """
    counts: dict[str, int] = {}
    for f in files:
        if f.language and f.language != "Unknown":
            counts[f.language] = counts.get(f.language, 0) + 1
    return [lang for lang, _ in sorted(counts.items(), key=lambda kv: -kv[1])]


# ─────────────────────────────────────────────────────────────
# Full pipeline orchestration
# ─────────────────────────────────────────────────────────────

async def run_full_pipeline(repo_name: str, scan: ScanResult) -> AIPipelineResult:
    """
    Runs the complete AI documentation pipeline in the correct
    dependency order:

      1. analyse_all_at_once() — needs scan.prioritised_files
      2. generate_readme()      — needs outputs from step 1

    This is the single function routers/docs.py calls — it does
    not need to know about the internal structure.

    Raises:
      AIConfigError      — missing API key, fails fast before any
                            Groq calls are attempted
      AIGenerationError  — batch analysis or README generation failed
    """
    # Fail fast on missing config before spending any time on
    # file I/O or building prompts that will never be sent.
    await _get_client()

    file_explanations, folder_summaries = await analyse_all_at_once(scan)

    readme_content, readme_preview = await generate_readme(
        repo_name=repo_name,
        file_count=scan.file_count,
        folder_count=scan.folder_count,
        prioritised_files=scan.prioritised_files,
        folder_summaries=folder_summaries,
    )

    doc_count = 1 + len(folder_summaries) + len(file_explanations)

    return AIPipelineResult(
        file_explanations=file_explanations,
        folder_summaries=folder_summaries,
        readme_content=readme_content,
        readme_preview=readme_preview,
        doc_count=doc_count,
    )