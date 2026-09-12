from __future__ import annotations

import os
import time
from collections.abc import Iterator
from typing import Protocol

from app.catalog import ModelConfig


class ChatProvider(Protocol):
    """Strategy contract implemented by every provider protocol adapter."""

    def stream(self, model: ModelConfig, messages: list[dict]) -> Iterator[str]: ...


class OpenAICompatibleProvider:
    """Adapter for OpenAI-compatible Chat Completions endpoints."""

    def __init__(self, max_completion_tokens: int = 2048, retries: int = 3):
        self.max_completion_tokens = max_completion_tokens
        self.retries = retries

    def stream(self, model: ModelConfig, messages: list[dict]) -> Iterator[str]:
        from openai import OpenAI

        api_key = os.getenv(model.key_env)
        if not api_key:
            raise RuntimeError(
                f"{model.provider} is not configured. Add {model.key_env} to .env."
            )

        client_kwargs: dict = {
            "api_key": api_key,
            "timeout": model.timeout_seconds,
        }
        if model.base_url:
            client_kwargs["base_url"] = model.base_url
        client = OpenAI(**client_kwargs)

        last_error: Exception | None = None
        for attempt in range(self.retries):
            emitted = False
            try:
                request = {
                    **model.request_options,
                    "model": model.model,
                    "messages": messages,
                    "stream": True,
                    model.token_parameter: self.max_completion_tokens,
                }
                stream = client.chat.completions.create(**request)
                for chunk in stream:
                    text = chunk.choices[0].delta.content if chunk.choices else None
                    if text:
                        emitted = True
                        yield text
                return
            except Exception as error:
                last_error = error
                # Never retry after output becomes visible: that duplicates text.
                if emitted or attempt == self.retries - 1:
                    break
                time.sleep(0.35 * (2**attempt))
        raise RuntimeError(f"{model.provider} request failed: {last_error}") from last_error


class ProviderRegistry:
    """Maps catalog adapter names to swappable provider strategies."""

    def __init__(self, providers: dict[str, ChatProvider] | None = None):
        self._providers = dict(providers or {})

    def register(self, adapter: str, provider: ChatProvider) -> None:
        self._providers[adapter] = provider

    def stream(self, model: ModelConfig, messages: list[dict]) -> Iterator[str]:
        provider = self._providers.get(model.adapter)
        if provider is None:
            raise RuntimeError(
                f"No provider adapter registered for {model.adapter!r}. "
                "Register it in ProviderRegistry before using this model."
            )
        return provider.stream(model, messages)


def create_default_provider_registry(max_completion_tokens: int) -> ProviderRegistry:
    return ProviderRegistry(
        {
            "openai_compatible": OpenAICompatibleProvider(max_completion_tokens),
        }
    )
