from __future__ import annotations

from pydantic import BaseModel, Field

from app.config import DEFAULT_SYSTEM_PROMPT


class SessionCreate(BaseModel):
    title: str = Field(default="New conversation", max_length=80)
    system_prompt: str = Field(default=DEFAULT_SYSTEM_PROMPT, max_length=8000)


class SessionUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=80)
    system_prompt: str | None = Field(default=None, max_length=8000)
    pinned: bool | None = None


class ModelUpdate(BaseModel):
    model_id: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=32_000)


class RetryRequest(BaseModel):
    message_id: int | None = None


class AppSettingsUpdate(BaseModel):
    default_system_prompt: str | None = Field(default=None, max_length=8000)
    show_starter_prompts: bool | None = None
