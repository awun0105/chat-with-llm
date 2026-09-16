from __future__ import annotations

import time
from collections.abc import Iterator

from app.catalog import ModelCatalog, ModelConfig
from app.config import DEFAULT_SYSTEM_PROMPT
from app.domain import ChatSession, StreamEvent
from app.providers import ProviderRegistry
from app.repositories import SessionRepository
from app.tokens import TiktokenCounter, TokenCounter, count_messages


class UnknownModelError(ValueError):
    pass


class EmptyMessageError(ValueError):
    pass


class ChatService:
    """Application facade: use cases independent of FastAPI, SQLite, and SSE."""

    def __init__(
        self,
        catalog: ModelCatalog,
        repository: SessionRepository,
        providers: ProviderRegistry,
        default_system_prompt: str = DEFAULT_SYSTEM_PROMPT,
        tokens: TokenCounter | None = None,
    ):
        self.catalog = catalog
        self.repository = repository
        self.providers = providers
        self.default_system_prompt = default_system_prompt
        self.tokens = tokens or TiktokenCounter()

    def initialize(self) -> None:
        self.repository.initialize(tuple(self.catalog), self.catalog.default_model_id)

    def list_models(self) -> list[dict]:
        return [
            model.public_dict(self.model_latency(model.id))
            for model in self.catalog.values()
        ]

    def list_sessions(self, user_id: str = "default") -> list[ChatSession]:
        return self.repository.list_sessions(user_id)

    def search_sessions(self, query: str, user_id: str = "default", 
        limit: int = 20, offset: int = 0
    ) -> tuple[list[ChatSession], int]:
        return self.repository.search_sessions(query.strip(), user_id, limit, offset)

    def get_settings(self) -> dict:
        values = self.repository.get_settings()
        return {
            "default_system_prompt": values.get(
                "default_system_prompt", self.default_system_prompt
            ),
            "show_starter_prompts": values.get("show_starter_prompts", "true") == "true",
        }

    def update_settings(
        self,
        *,
        default_system_prompt: str | None = None,
        show_starter_prompts: bool | None = None,
    ) -> dict:
        values = {}
        if default_system_prompt is not None:
            values["default_system_prompt"] = (
                default_system_prompt.strip() or self.default_system_prompt
            )
        if show_starter_prompts is not None:
            values["show_starter_prompts"] = (
                "true" if show_starter_prompts else "false"
            )
        if values:
            self.repository.update_settings(values)
        return self.get_settings()

    def create_session(self, title: str, system_prompt: str, user_id: str = "default") -> ChatSession:
        clean_title = title.strip() or "New conversation"
        clean_prompt = (
            system_prompt.strip() or self.get_settings()["default_system_prompt"]
        )
        return self.repository.create_session(
            clean_title, clean_prompt, self.catalog.default_model_id, user_id
        )

    def get_session(self, session_id: str) -> ChatSession:
        return self.repository.get_session(session_id, include_messages=True)

    def update_session(
        self,
        session_id: str,
        *,
        title: str | None = None,
        system_prompt: str | None = None,
        pinned: bool | None = None,
    ) -> ChatSession:
        clean_title = None if title is None else (title.strip() or "New conversation")
        clean_prompt = (
            None
            if system_prompt is None
            else (system_prompt.strip() or self.default_system_prompt)
        )
        return self.repository.update_session(
            session_id, title=clean_title, system_prompt=clean_prompt, pinned=pinned
        )

    def delete_session(self, session_id: str) -> None:
        self.repository.delete_session(session_id)

    def clear_sessions(self, user_id: str = "default") -> int:
        return self.repository.clear_sessions(user_id)

    def model_latency(self, model_id: str) -> tuple[float, float]:
        model = self.catalog[model_id]
        values = self.repository.recent_latencies(model_id)
        if len(values) < 2:
            return model.estimate_low, model.estimate_high
        average = sum(values) / len(values)
        return max(0.8, average * 0.7), max(1.5, average * 1.35)

    def change_model(self, session_id: str, model_id: str) -> dict:
        session = self.repository.get_session(session_id)
        if model_id not in self.catalog:
            raise UnknownModelError(model_id)
        if model_id == session.active_model:
            return {"changed": False, "event": None, "session": session}

        previous = self.catalog.get(session.active_model)
        selected = self.catalog[model_id]
        estimate_low, estimate_high = self.model_latency(selected.id)
        input_tokens, output_tokens = self.repository.last_assistant_tokens(session_id)
        metadata = {
            "from": previous.label if previous else session.active_model,
            "to": selected.label,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "estimate_low": round(estimate_low, 1),
            "estimate_high": round(estimate_high, 1),
        }
        event = self.repository.change_model(
            session_id,
            selected.id,
            f"Model changed to {selected.label}",
            metadata,
        )
        return {
            "changed": True,
            "event": event,
            "session": self.repository.get_session(session_id),
        }

    def stream_chat(self, session_id: str, message: str) -> Iterator[StreamEvent]:
        session, model = self._session_and_model(session_id)
        user_text = message.strip()
        if not user_text:
            raise EmptyMessageError("Message cannot be blank")
        user_id, conversation = self.repository.add_user_message(
            session_id, user_text, model.id
        )
        return self._stream_reply(session, model, user_id, conversation)

    def stream_retry(
        self, session_id: str, assistant_id: int | None = None
    ) -> Iterator[StreamEvent]:
        session, model = self._session_and_model(session_id)
        user_id, conversation = self.repository.prepare_retry(session_id, assistant_id)
        return self._stream_reply(session, model, user_id, conversation)

    def _session_and_model(self, session_id: str) -> tuple[ChatSession, ModelConfig]:
        session = self.repository.get_session(session_id)
        model = self.catalog.get(session.active_model)
        if model is None:
            raise UnknownModelError(session.active_model)
        return session, model

    def _stream_reply(self, session, model, user_id: int, conversation: list[dict]) -> Iterator[StreamEvent]:
        api_messages = [
            {"role": model.system_role, "content": session.system_prompt},
            *conversation,
        ]
        input_tokens = count_messages(self.tokens, api_messages, model.model)
        estimate_low, estimate_high = self.model_latency(model.id)

        def generate() -> Iterator[StreamEvent]:
            yield StreamEvent(
                "start",
                {
                    "user_id": user_id,
                    "model": model.public_dict((estimate_low, estimate_high)),
                    "input_tokens": input_tokens,
                },
            )
            started = time.perf_counter()
            first_token_at: float | None = None
            chunks: list[str] = []
            try:
                for text in self.providers.stream(model, api_messages):
                    if first_token_at is None:
                        first_token_at = time.perf_counter()
                    chunks.append(text)
                    yield StreamEvent("token", {"text": text})
            except GeneratorExit:
                reply = "".join(chunks)
                if reply:
                    elapsed = time.perf_counter() - started
                    ttft = (first_token_at - started) if first_token_at else elapsed
                    self.repository.add_assistant_message(
                        session_id=session.id,
                        content=reply,
                        model_id=model.id,
                        input_tokens=input_tokens,
                        output_tokens=self.tokens.count(reply, model.model),
                        latency_seconds=elapsed,
                        estimated_seconds=(estimate_low + estimate_high) / 2,
                        metadata={
                            "ttft_seconds": round(ttft, 3),
                            "stopped": True,
                        },
                    )
                raise
            except Exception as error:
                yield StreamEvent("error", {"message": str(error)})
                return

            reply = "".join(chunks)
            elapsed = time.perf_counter() - started
            ttft = (first_token_at - started) if first_token_at else elapsed
            output_tokens = self.tokens.count(reply, model.model)
            assistant_id = self.repository.add_assistant_message(
                session_id=session.id,
                content=reply,
                model_id=model.id,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                latency_seconds=elapsed,
                estimated_seconds=(estimate_low + estimate_high) / 2,
                metadata={"ttft_seconds": round(ttft, 3)},
            )
            yield StreamEvent(
                "done",
                {
                    "assistant_id": assistant_id,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "latency_seconds": round(elapsed, 2),
                    "ttft_seconds": round(ttft, 2),
                    "estimated_low": round(estimate_low, 1),
                    "estimated_high": round(estimate_high, 1),
                },
            )

        return generate()
