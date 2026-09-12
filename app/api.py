from __future__ import annotations

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.domain import StreamEvent
from app.repositories import SessionNotFoundError
from app.schemas import ChatRequest, ModelUpdate, RetryRequest, SessionCreate, SessionUpdate
from app.services import ChatService, EmptyMessageError, UnknownModelError


def get_chat_service(request: Request) -> ChatService:
    return request.app.state.chat_service


def register_exception_handlers(application: FastAPI) -> None:
    """Shared error mapping so a host app can attach the same contract."""

    @application.exception_handler(SessionNotFoundError)
    async def session_not_found(_: Request, __: SessionNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": "Chat session not found"})

    @application.exception_handler(UnknownModelError)
    async def unknown_model(_: Request, __: UnknownModelError) -> JSONResponse:
        return JSONResponse(status_code=400, content={"detail": "Unknown model"})


def create_chat_router(prefix: str = "/api") -> APIRouter:
    """HTTP adapter around ChatService. Mount this on any FastAPI app."""

    router = APIRouter(prefix=prefix, tags=["chat"])

    @router.get("/health")
    def health(chat_service: ChatService = Depends(get_chat_service)) -> dict:
        return {"status": "ok", "database": chat_service.repository.location}

    @router.get("/models")
    def list_models(chat_service: ChatService = Depends(get_chat_service)) -> list[dict]:
        return chat_service.list_models()

    @router.get("/sessions")
    def list_sessions(chat_service: ChatService = Depends(get_chat_service)) -> list[dict]:
        return [session.to_dict() for session in chat_service.list_sessions()]

    @router.post("/sessions", status_code=201)
    def create_session(
        payload: SessionCreate,
        chat_service: ChatService = Depends(get_chat_service),
    ) -> dict:
        return chat_service.create_session(payload.title, payload.system_prompt).to_dict()

    @router.get("/sessions/{session_id}")
    def get_session(
        session_id: str,
        chat_service: ChatService = Depends(get_chat_service),
    ) -> dict:
        return chat_service.get_session(session_id).to_dict()

    @router.patch("/sessions/{session_id}")
    def update_session(
        session_id: str,
        payload: SessionUpdate,
        chat_service: ChatService = Depends(get_chat_service),
    ) -> dict:
        return chat_service.update_session(
            session_id,
            title=payload.title,
            system_prompt=payload.system_prompt,
        ).to_dict()

    @router.delete("/sessions/{session_id}", status_code=204)
    def delete_session(
        session_id: str,
        chat_service: ChatService = Depends(get_chat_service),
    ) -> None:
        chat_service.delete_session(session_id)

    @router.post("/sessions/{session_id}/model")
    def change_model(
        session_id: str,
        payload: ModelUpdate,
        chat_service: ChatService = Depends(get_chat_service),
    ) -> dict:
        result = chat_service.change_model(session_id, payload.model_id)
        return {
            "changed": result["changed"],
            "event": result["event"].to_dict() if result.get("event") else None,
            "session": result["session"].to_dict(),
        }

    @router.post("/sessions/{session_id}/chat")
    def chat(
        session_id: str,
        payload: ChatRequest,
        chat_service: ChatService = Depends(get_chat_service),
    ) -> StreamingResponse:
        try:
            events = chat_service.stream_chat(session_id, payload.message)
        except EmptyMessageError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error

        def as_sse():
            for event in events:
                yield event.to_sse() if isinstance(event, StreamEvent) else str(event)

        return StreamingResponse(
            as_sse(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    @router.post("/sessions/{session_id}/retry")
    def retry(
        session_id: str,
        payload: RetryRequest,
        chat_service: ChatService = Depends(get_chat_service),
    ) -> StreamingResponse:
        try:
            events = chat_service.stream_retry(session_id, payload.message_id)
        except EmptyMessageError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error

        def as_sse():
            for event in events:
                yield event.to_sse() if isinstance(event, StreamEvent) else str(event)

        return StreamingResponse(
            as_sse(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    return router
