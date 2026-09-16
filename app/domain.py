from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field


@dataclass
class ChatMessage:
    """One persisted timeline item: user, assistant, or model-switch event."""

    role: str
    content: str
    id: int | None = None
    session_id: str | None = None
    model_id: str | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    latency_seconds: float | None = None
    estimated_seconds: float | None = None
    metadata: dict = field(default_factory=dict)
    created_at: float | None = None

    @classmethod
    def from_mapping(cls, data: dict) -> "ChatMessage":
        payload = dict(data)
        raw_metadata = payload.pop("metadata", None)
        if isinstance(raw_metadata, str):
            payload["metadata"] = json.loads(raw_metadata) if raw_metadata else {}
        elif raw_metadata is None:
            payload["metadata"] = {}
        else:
            payload["metadata"] = dict(raw_metadata)
        known = {key: payload.get(key) for key in cls.__dataclass_fields__}
        return cls(**known)

    def to_dict(self) -> dict:
        return asdict(self)

    def as_provider_turn(self) -> dict:
        return {"role": self.role, "content": self.content}


@dataclass
class ChatSession:
    """Conversation header plus optional messages."""

    id: str
    title: str
    system_prompt: str
    active_model: str
    created_at: float
    updated_at: float
    preview: str | None = None
    messages: list[ChatMessage] | None = None
    pinned: bool = False
    user_id: str = "default"

    @classmethod
    def from_mapping(cls, data: dict, messages: list[ChatMessage] | None = None) -> "ChatSession":
        payload = dict(data)
        return cls(
            id=payload["id"],
            title=payload["title"],
            system_prompt=payload["system_prompt"],
            active_model=payload["active_model"],
            created_at=payload["created_at"],
            updated_at=payload["updated_at"],
            preview=payload.get("preview"),
            messages=messages,
            pinned=bool(payload.get("pinned", False)),
            user_id=payload.get("user_id", "default"),
        )

    def to_dict(self) -> dict:
        data = {
            "id": self.id,
            "title": self.title,
            "system_prompt": self.system_prompt,
            "active_model": self.active_model,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "pinned": self.pinned,
            "user_id": self.user_id,
        }
        if self.preview is not None:
            data["preview"] = self.preview
        if self.messages is not None:
            data["messages"] = [message.to_dict() for message in self.messages]
        return data


@dataclass(frozen=True)
class StreamEvent:
    """Transport-agnostic chat stream event.

    FastAPI encodes this as SSE. Another host can map the same events to
    WebSockets, queues, or an in-process iterator.
    """

    name: str
    payload: dict

    def to_sse(self) -> str:
        return (
            f"event: {self.name}\n"
            f"data: {json.dumps(self.payload, ensure_ascii=False)}\n\n"
        )


def sse(event: str, payload: dict) -> str:
    return StreamEvent(event, payload).to_sse()
