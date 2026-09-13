from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import dataclass

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import create_chat_router, register_exception_handlers
from app.catalog import ModelCatalog
from app.config import Settings
from app.providers import ProviderRegistry, create_default_provider_registry
from app.repositories import SessionRepository, SQLiteSessionRepository
from app.services import ChatService
from app.tokens import TokenCounter


@dataclass
class ChatBackend:
    """Wired application core, usable with or without HTTP."""

    settings: Settings
    catalog: ModelCatalog
    repository: SessionRepository
    providers: ProviderRegistry
    service: ChatService


def build_backend(
    *,
    settings: Settings | None = None,
    catalog: ModelCatalog | None = None,
    repository: SessionRepository | None = None,
    providers: ProviderRegistry | None = None,
    tokens: TokenCounter | None = None,
) -> ChatBackend:
    """Composition root: swap any adapter without changing use cases."""

    active_settings = settings or Settings.from_env()
    active_catalog = catalog or ModelCatalog.load(active_settings.models_config_path)
    active_repository = repository or SQLiteSessionRepository(active_settings.db_path)
    active_providers = providers or create_default_provider_registry(
        active_settings.max_completion_tokens
    )
    service = ChatService(
        catalog=active_catalog,
        repository=active_repository,
        providers=active_providers,
        default_system_prompt=active_settings.default_system_prompt,
        tokens=tokens,
    )
    return ChatBackend(
        settings=active_settings,
        catalog=active_catalog,
        repository=active_repository,
        providers=active_providers,
        service=service,
    )


def _store_backend(application: FastAPI, backend: ChatBackend) -> None:
    application.state.backend = backend
    application.state.chat_service = backend.service
    application.state.settings = backend.settings


def create_app(
    *,
    settings: Settings | None = None,
    catalog: ModelCatalog | None = None,
    repository: SessionRepository | None = None,
    providers: ProviderRegistry | None = None,
    tokens: TokenCounter | None = None,
    include_ui: bool = True,
    api_prefix: str = "/api",
) -> FastAPI:
    """Build a standalone app, or an API-only app another system can mount."""

    backend = build_backend(
        settings=settings,
        catalog=catalog,
        repository=repository,
        providers=providers,
        tokens=tokens,
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        backend.service.initialize()
        yield

    application = FastAPI(
        title="Chat with LLM",
        version="0.3.0",
        lifespan=lifespan,
    )
    _store_backend(application, backend)
    backend.service.initialize()
    register_exception_handlers(application)
    application.include_router(create_chat_router(api_prefix))

    if include_ui:
        application.mount(
            "/",
            StaticFiles(directory=backend.settings.static_dir, html=True),
            name="ui",
        )

    return application


def attach_chat(
    host: FastAPI,
    *,
    prefix: str = "/chat",
    include_ui: bool = False,
    **backend_kwargs,
) -> ChatBackend:
    """Mount chat onto an existing FastAPI application.

    Example::

        from fastapi import FastAPI
        from app import attach_chat

        api = FastAPI()
        attach_chat(api, prefix="/assistant")
    """

    backend = build_backend(**backend_kwargs)
    backend.service.initialize()
    _store_backend(host, backend)
    register_exception_handlers(host)
    host.include_router(create_chat_router(f"{prefix}/api" if prefix else "/api"))
    if include_ui:
        host.mount(
            prefix if prefix else "/",
            StaticFiles(directory=backend.settings.static_dir, html=True),
            name="chat-ui",
        )
    return backend
