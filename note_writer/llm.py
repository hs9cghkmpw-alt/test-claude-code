from __future__ import annotations

import os
from typing import Callable, Protocol


class LLMClient(Protocol):
    """Minimal interface every LLM backend used by this pipeline must satisfy."""

    def complete(self, system: str, prompt: str) -> str:
        """Return the model's full text response for a single-turn request."""
        ...


class AnthropicLLMClient:
    """Thin wrapper around the Anthropic Messages API.

    Requires the ``anthropic`` package and an ``ANTHROPIC_API_KEY``
    environment variable. Import of the SDK is deferred to construction time
    so the rest of the pipeline has no hard dependency on it (tests use
    ``FakeLLMClient`` instead).
    """

    def __init__(
        self,
        model: str = "claude-sonnet-5",
        max_tokens: int = 4096,
        api_key: str | None = None,
    ) -> None:
        import anthropic  # local import: optional dependency

        self._client = anthropic.Anthropic(
            api_key=api_key or os.environ.get("ANTHROPIC_API_KEY")
        )
        self._model = model
        self._max_tokens = max_tokens

    def complete(self, system: str, prompt: str) -> str:
        response = self._client.messages.create(
            model=self._model,
            max_tokens=self._max_tokens,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        return "".join(
            block.text for block in response.content if block.type == "text"
        )


class FakeLLMClient:
    """Deterministic stand-in for tests and offline development.

    ``responses`` is consumed in order; when exhausted, ``default_fn`` (if
    given) is called with (system, prompt) to synthesize a response, which
    keeps fixtures short for pipelines that call the LLM many times.
    """

    def __init__(
        self,
        responses: list[str] | None = None,
        default_fn: Callable[[str, str], str] | None = None,
    ) -> None:
        self._responses = list(responses or [])
        self._default_fn = default_fn
        self.calls: list[tuple[str, str]] = []

    def complete(self, system: str, prompt: str) -> str:
        self.calls.append((system, prompt))
        if self._responses:
            return self._responses.pop(0)
        if self._default_fn is not None:
            return self._default_fn(system, prompt)
        raise AssertionError("FakeLLMClient ran out of scripted responses")
