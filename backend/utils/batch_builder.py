"""
utils/batch_builder.py — token-aware batching for AI requests.

This module groups prioritised files into request batches without changing
how the rest of the pipeline behaves.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from services.scanner import ScannedFile
from config import settings


logger = logging.getLogger(__name__)

# Default maximum input tokens per batch request.
MAX_BATCH_INPUT_TOKENS = 9000


@dataclass
class TokenizedFile:
    """A file plus its precomputed token estimate."""

    file: ScannedFile
    estimated_tokens: int


@dataclass
class Batch:
    """Represents one future Groq request batch."""

    files: list[ScannedFile]
    estimated_tokens: int

    @property
    def file_count(self) -> int:
        return len(self.files)


class BatchBuilder:
    """
    Greedily packs prioritised files into batches based on token estimates.

    The builder preserves the current prioritisation order and does not
    sort files. It only estimates token usage and groups files into
    future request batches.
    """

    def __init__(self, max_input_tokens: int = MAX_BATCH_INPUT_TOKENS):
        self.max_input_tokens = max_input_tokens

    def build_batches(self, files: list[TokenizedFile]) -> list[Batch]:
        """
        Greedily pack tokenized files into batches without reordering them.

        Files are added to the current batch if the batch would remain
        within the configured token budget; otherwise the current batch
        is finalized and a new one begins.
        """
        if not files:
            return []

        batches: list[Batch] = []
        current_batch: list[ScannedFile] = []
        current_tokens = 0

        for tokenized_file in files:
            file_tokens = tokenized_file.estimated_tokens

            if current_batch and current_tokens + file_tokens > self.max_input_tokens:
                batches.append(self._finalize_batch(current_batch, current_tokens))
                current_batch = []
                current_tokens = 0

            current_batch.append(tokenized_file.file)
            current_tokens += file_tokens

        if current_batch:
            batches.append(self._finalize_batch(current_batch, current_tokens))

        if settings.is_development and logger.isEnabledFor(logging.DEBUG):
            for index, batch in enumerate(batches, start=1):
                logger.debug(
                    "Batch %s:\nFiles: %s\nEstimated tokens: %s",
                    index,
                    batch.file_count,
                    batch.estimated_tokens,
                )

        return batches

    def _finalize_batch(
        self,
        files: list[ScannedFile],
        estimated_tokens: int,
    ) -> Batch:
        return Batch(files=files, estimated_tokens=estimated_tokens)
