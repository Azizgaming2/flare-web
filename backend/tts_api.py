from __future__ import annotations

import re
import time
from collections import defaultdict, deque

import edge_tts
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

VOICES = {"en": "en-US-AriaNeural", "az": "az-AZ-BanuNeural"}
MODEL_LANG = {"tentium": "en"}
MAX_CHARS = 1500
RATE_LIMIT = 12
RATE_WINDOW = 60.0

_hits: dict[str, deque] = defaultdict(deque)


class SpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=8000)
    model: str = Field(default="tentium", max_length=32)


def clean_text(text: str) -> str:
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"^\s{0,3}(#{1,6}|>|[-*+])\s+", "", text, flags=re.M)
    text = re.sub(r"[*_~|]+", "", text)
    return re.sub(r"\s+", " ", text).strip()


def trim_text(text: str) -> str:
    if len(text) <= MAX_CHARS:
        return text
    cut = text[:MAX_CHARS]
    end = max(cut.rfind(". "), cut.rfind("? "), cut.rfind("! "))
    return cut[: end + 1] if end > 200 else cut


def allowed(uid: str) -> bool:
    now = time.monotonic()
    hits = _hits[uid]
    while hits and now - hits[0] > RATE_WINDOW:
        hits.popleft()
    if len(hits) >= RATE_LIMIT:
        return False
    hits.append(now)
    return True


async def audio_chunks(text: str, voice: str):
    async for chunk in edge_tts.Communicate(text, voice).stream():
        if chunk["type"] == "audio":
            yield chunk["data"]


def build_router(require_uid) -> APIRouter:
    router = APIRouter()

    @router.post("/api/tts")
    async def synthesize(body: SpeechRequest, authorization: str | None = Header(default=None)):
        uid = await require_uid(authorization)
        if not allowed(uid):
            raise HTTPException(status_code=429, detail="Too many requests")
        text = trim_text(clean_text(body.text))
        if not text:
            raise HTTPException(status_code=400, detail="Nothing to read")
        voice = VOICES[MODEL_LANG.get(body.model, "en")]
        stream = audio_chunks(text, voice)
        try:
            first = await anext(stream)
        except Exception as exc:
            raise HTTPException(status_code=503, detail="Speech service unavailable") from exc

        async def body_iter():
            yield first
            async for chunk in stream:
                yield chunk

        return StreamingResponse(body_iter(), media_type="audio/mpeg")

    return router
