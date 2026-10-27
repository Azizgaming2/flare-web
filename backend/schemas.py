from typing import Annotated, Literal

from pydantic import BaseModel, Field

from backend.config import (
    DEFAULT_MAX_NEW_TOKENS,
    DEFAULT_TEMPERATURE,
    DEFAULT_TOP_K,
    DEFAULT_TOP_P,
    MAX_MESSAGE_CHARS,
)

ID_PATTERN = r"^[A-Za-z0-9_-]{1,120}$"


class Attachment(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    text: str = Field(max_length=12000)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=MAX_MESSAGE_CHARS)
    attachments: list[Attachment] = Field(default_factory=list, max_length=3)


class ChatRequest(BaseModel):
    chat_id: str = Field(default="default", pattern=ID_PATTERN)
    messages: list[ChatMessage] = Field(min_length=1, max_length=200)
    mode: Literal["fast", "deepthink"] = "fast"
    model: Literal["tentium"] = "tentium"
    max_new_tokens: int = Field(default=DEFAULT_MAX_NEW_TOKENS, ge=1, le=4096)
    temperature: float = Field(default=DEFAULT_TEMPERATURE, ge=0.0, le=2.0)
    top_p: float = Field(default=DEFAULT_TOP_P, ge=0.0, le=1.0)
    top_k: int = Field(default=DEFAULT_TOP_K, ge=1, le=200)
    search: bool = False


class TitleRequest(BaseModel):
    message: str = Field(min_length=1, max_length=MAX_MESSAGE_CHARS)
    chat_id: str | None = Field(default=None, pattern=ID_PATTERN)


class ChatPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=80)
    archived: bool | None = None


class SettingsUpdate(BaseModel):
    nickname: str | None = Field(default=None, max_length=40)
    character: Literal["default", "professional", "friendly", "candid", "efficient", "nerdy"] | None = None
    emoji: Literal["none", "less", "default", "more"] | None = None
    markdown: Literal["minimal", "default", "rich"] | None = None
    instructions: str | None = Field(default=None, max_length=600)
    memory_enabled: bool | None = None


MEDIA_PATTERN = r"^[a-f0-9]{32}\.(jpg|png|gif|webp|mp4|webm)$"


class UpdateCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(default="", max_length=8000)
    media: list[Annotated[str, Field(pattern=MEDIA_PATTERN)]] = Field(default_factory=list, max_length=6)


class FeedbackRequest(BaseModel):
    chat_id: str = Field(pattern=ID_PATTERN)
    message_index: int = Field(ge=0, le=2000)
    rating: Literal["up", "down", "none"]
    reason: Literal["wrong", "unclear", "language", "other"] | None = None
    prompt: str = Field(default="", max_length=MAX_MESSAGE_CHARS)
    response: str = Field(default="", max_length=20000)
    mode: Literal["fast", "deepthink"] = "fast"
