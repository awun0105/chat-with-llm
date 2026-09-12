"""Embeddable multi-model chat workspace.

Typical hosts:

    from app import create_app
    app = create_app()

    from app import attach_chat
    attach_chat(existing_fastapi_app, prefix="/assistant")

    from app import ChatService, build_backend
    backend = build_backend(repository=InMemorySessionRepository())
    for event in backend.service.stream_chat(session_id, "Hello"):
        ...
"""

from app.catalog import ModelCatalog, ModelConfig
from app.config import DEFAULT_SYSTEM_PROMPT, Settings
from app.domain import ChatMessage, ChatSession, StreamEvent
from app.factory import ChatBackend, attach_chat, build_backend, create_app
from app.providers import (
    ChatProvider,
    OpenAICompatibleProvider,
    ProviderRegistry,
    create_default_provider_registry,
)
from app.repositories import (
    InMemorySessionRepository,
    SessionNotFoundError,
    SessionRepository,
    SQLiteSessionRepository,
)
from app.services import ChatService, EmptyMessageError, UnknownModelError
from app.tokens import HeuristicCounter, TiktokenCounter, TokenCounter

__all__ = [
    "ChatBackend",
    "ChatMessage",
    "ChatProvider",
    "ChatService",
    "ChatSession",
    "DEFAULT_SYSTEM_PROMPT",
    "EmptyMessageError",
    "HeuristicCounter",
    "InMemorySessionRepository",
    "ModelCatalog",
    "ModelConfig",
    "OpenAICompatibleProvider",
    "ProviderRegistry",
    "SQLiteSessionRepository",
    "SessionNotFoundError",
    "SessionRepository",
    "Settings",
    "StreamEvent",
    "TiktokenCounter",
    "TokenCounter",
    "UnknownModelError",
    "attach_chat",
    "build_backend",
    "create_app",
    "create_default_provider_registry",
]
