from __future__ import annotations

from typing import Protocol


class TokenCounter(Protocol):
    """Strategy for approximating prompt and completion size."""

    def count(self, text: str, model_name: str = "") -> int: ...


class TiktokenCounter:
    """Prefer tiktoken; fall back to a character heuristic when unavailable."""

    def count(self, text: str, model_name: str = "gpt-5.4-mini") -> int:
        if not text:
            return 0
        try:
            import tiktoken

            try:
                encoding = tiktoken.encoding_for_model(model_name)
            except KeyError:
                encoding = tiktoken.get_encoding("o200k_base")
            return len(encoding.encode(text))
        except Exception:
            return max(1, (len(text) + 3) // 4)


class HeuristicCounter:
    def count(self, text: str, model_name: str = "") -> int:
        del model_name
        if not text:
            return 0
        return max(1, (len(text) + 3) // 4)


def count_messages(counter: TokenCounter, messages: list[dict], model_name: str) -> int:
    return sum(counter.count(message.get("content", ""), model_name) + 4 for message in messages)
