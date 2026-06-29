"""
generators/readme_generator.py — README synthesis prompt builder.

This module turns repository facts into the final README prompt and
cleans the provider response into markdown content. The actual request
execution remains in services/ai_service.py.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from utils.token_counter import count_tokens, TokenBudget


# ─────────────────────────────────────────────────────────────
# Data structures
# ─────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class RepoContext:
    """
    Everything the README prompt needs to know about the
    repository, assembled by ai_service.py from earlier
    pipeline stages (scanner.py + file_explainer.py +
    folder_summariser.py outputs).

    repo_name        — "owner/repo"
    file_count       — total files scanned
    folder_count     — total folders scanned
    languages        — distinct languages detected, most common first
                        e.g. ["Python", "JavaScript", "TypeScript"]
    key_file_paths   — relative paths of the most important files,
                        already ranked by scanner.py's scoring
    folder_summaries — dict of folder_path -> summary text, produced
                        by folder_summariser.py via ai_service.py
    """
    repo_name:        str
    file_count:        int
    folder_count:      int
    languages:         list[str] = field(default_factory=list)
    key_file_paths:    list[str] = field(default_factory=list)
    folder_summaries:  dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class ReadmePrompt:
    """
    The two messages needed for a chat completion call that
    generates the README. Provider-agnostic — mirrors
    FileExplanationPrompt and FolderSummaryPrompt's shape for
    consistency across all three generators.
    """
    system: str
    user:   str
    max_response_tokens: int


# ─────────────────────────────────────────────────────────────
# System prompt
# ─────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = (
    "You are a senior software engineer writing a professional "
    "README.md for a GitHub repository. You are given structured "
    "facts about the repository — its name, detected languages, "
    "folder summaries, and key files — and must synthesise them "
    "into a complete, well-organised README.\n\n"
    "Write valid Markdown using these sections in order: "
    "a title (# heading using the repo name), a one-paragraph "
    "overview, a Features section (bulleted), a Project Structure "
    "section (briefly describing the main folders using the "
    "provided summaries), an Installation section with a plausible "
    "generic setup (e.g. clone, install dependencies, run), and a "
    "Usage section. "
    "Do not invent specific commands, package names, or version "
    "numbers that were not implied by the provided facts — use "
    "general, safe placeholders (e.g. 'install dependencies using "
    "your package manager') when specifics are not given. "
    "Do not wrap the entire output in a code fence."
)


# ─────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────

def build_readme_prompt(context: RepoContext) -> ReadmePrompt:
    """
    Builds the system + user prompt pair for generating the
    final README.

    Folder summaries are the most token-expensive part of this
    prompt since there can be many of them — they are capped at
    TokenBudget.MAX_SUMMARIES_FOR_README entries (the highest-
    value folders, i.e. those listed first by the caller) and the
    combined section is hard-truncated to fit the request budget
    as a final safety net.

    Args:
      context — RepoContext assembled from earlier pipeline stages

    Returns:
      ReadmePrompt ready to pass to the AI client.

    Raises:
      ValueError — if context.repo_name is empty. A README
                   without a repository name to anchor the title
                   is not usable output.

    >>> ctx = RepoContext(repo_name="acme/widget", file_count=10, folder_count=3)
    >>> p = build_readme_prompt(ctx)
    >>> "acme/widget" in p.user
    True
    """
    if not context.repo_name or not context.repo_name.strip():
        raise ValueError(
            "Cannot build a README prompt without a repo_name. "
            "Ensure RepoContext is populated before calling this function."
        )

    languages_line = (
        ", ".join(context.languages)
        if context.languages
        else "not detected"
    )

    key_files_line = (
        "\n".join(f"- {path}" for path in context.key_file_paths[:20])
        if context.key_file_paths
        else "(no key files identified)"
    )

    folder_summaries_section = _build_folder_summaries_section(
        context.folder_summaries
    )

    user_prompt = (
        f"Repository: {context.repo_name}\n"
        f"Files scanned: {context.file_count}\n"
        f"Folders scanned: {context.folder_count}\n"
        f"Detected languages: {languages_line}\n\n"
        f"Key files:\n{key_files_line}\n\n"
        f"Folder summaries:\n{folder_summaries_section}\n\n"
        f"Write the complete README.md now."
    )

    return ReadmePrompt(
        system=_SYSTEM_PROMPT,
        user=user_prompt,
        max_response_tokens=TokenBudget.MAX_README_RESPONSE,
    )


def parse_readme_response(raw_response: str) -> str:
    """
    Cleans up the raw text returned by the AI provider into the
    final README.md content.

    Unlike file_explainer/folder_summariser, the README IS
    expected to contain Markdown — so this function does NOT
    strip "#" headers or formatting. It only strips an outer
    wrapping code fence if the model ignored the instruction
    not to wrap the whole document in one.

    >>> parse_readme_response("# Title\\n\\nBody text.")
    '# Title\\n\\nBody text.'
    """
    if not raw_response or not raw_response.strip():
        return "# Documentation\n\nNo README content could be generated."

    cleaned = raw_response.strip()

    # Strip an OUTER wrapping code fence only — i.e. the entire
    # response is one big ```markdown ... ``` block. We detect
    # this conservatively: first line is a bare fence (optionally
    # with a language tag) AND last line is a bare fence.
    lines = cleaned.split("\n")
    if (
        len(lines) > 2
        and lines[0].strip().startswith("```")
        and lines[-1].strip() == "```"
    ):
        cleaned = "\n".join(lines[1:-1]).strip()

    return cleaned or "# Documentation\n\nNo README content could be generated."


def build_readme_preview(readme_content: str, max_chars: int = 500) -> str:
    """
    Extracts the preview snippet shown in the frontend's
    ReadmePreview.jsx component, which displays only the first
    ~500 characters with a fade-out overlay.

    Truncates on a whitespace boundary when possible to avoid
    cutting a word in half, and never truncates mid-Markdown-
    heading line.

    Args:
      readme_content — the full generated README text
      max_chars      — matches the frontend's display constraint

    Returns:
      A string no longer than max_chars (plus a small allowance
      for the ellipsis), safe to embed directly in the
      GenerateResponse.readme_preview field.

    >>> build_readme_preview("Short readme.", 500)
    'Short readme.'
    """
    if not readme_content:
        return ""

    if len(readme_content) <= max_chars:
        return readme_content

    truncated = readme_content[:max_chars]

    # Back off to the last whitespace boundary so we don't cut a word
    last_space = truncated.rfind(" ")
    last_newline = truncated.rfind("\n")
    boundary = max(last_space, last_newline)

    if boundary > max_chars * 0.7:  # only back off if it doesn't lose too much
        truncated = truncated[:boundary]

    return truncated.rstrip() + "…"


# ─────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────

def _build_folder_summaries_section(
    folder_summaries: dict[str, str],
) -> str:
    """
    Formats the folder_summaries dict into a bulleted text block
    for embedding in the README prompt, capped at
    TokenBudget.MAX_SUMMARIES_FOR_README entries and hard-truncated
    to fit the overall request budget as a final safety net.
    """
    if not folder_summaries:
        return "(no folder summaries available)"

    capped_items = list(folder_summaries.items())[
        :TokenBudget.MAX_SUMMARIES_FOR_README
    ]

    budget = TokenBudget.MAX_REQUEST_TOKENS - 800  # reserve room for the rest of the prompt
    lines: list[str] = []
    running_tokens = 0

    for folder_path, summary in capped_items:
        label = folder_path if folder_path else "(repository root)"
        block = f"- {label}: {summary}"
        block_tokens = count_tokens(block)

        if running_tokens + block_tokens > budget:
            lines.append(
                f"- [{len(capped_items) - len(lines)} more folder "
                f"summaries omitted for length]"
            )
            break

        lines.append(block)
        running_tokens += block_tokens

    return "\n".join(lines)