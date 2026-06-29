"""
utils/rate_limiter.py — TPM tracking utility for Groq requests.

This module provides a small async rate limiter that pauses requests when
an outbound token budget would otherwise be exceeded.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field

from config import settings


logger = logging.getLogger(__name__)


@dataclass
class TPMRateLimiter:
    """Tracks token usage over a rolling TPM window."""

    tpm_limit: int = field(default_factory=lambda: getattr(settings, 'groq_tpm_limit', 12000))
    window_seconds: int = 60
    _window_start: float = field(init=False, repr=False)
    _tokens_sent: int = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self._reset_window(time.monotonic())

    @property
    def tokens_sent(self) -> int:
        """Total tokens sent in the current TPM window."""
        return self._tokens_sent

    @property
    def window_start(self) -> float:
        """Timestamp when the current TPM window started."""
        return self._window_start

    async def wait_if_needed(self, next_request_tokens: int) -> None:
        """Waits only if the next request would exceed the TPM budget."""
        if next_request_tokens < 0:
            raise ValueError("next_request_tokens must be non-negative")

        now = time.monotonic()
        elapsed = now - self._window_start

        if elapsed >= self.window_seconds:
            self._reset_window(now)

        if self._tokens_sent + next_request_tokens <= self.tpm_limit:
            self._tokens_sent += next_request_tokens
            return

        remaining = self.window_seconds - elapsed
        if remaining > 0:
            logger.debug(
                "TPM limit reached (%s tokens). Waiting %.2f seconds before resuming.",
                self.tpm_limit,
                remaining,
            )
            await asyncio.sleep(remaining)
            logger.debug("TPM window reset after waiting; resuming request processing.")

        self._reset_window(time.monotonic())
        self._tokens_sent += next_request_tokens

    def reset(self) -> None:
        """Resets the TPM window immediately."""
        self._reset_window(time.monotonic())

    def _reset_window(self, timestamp: float) -> None:
        self._window_start = timestamp
        self._tokens_sent = 0
    