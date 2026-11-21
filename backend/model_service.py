from __future__ import annotations

import json
import logging
import re
import time
from collections.abc import AsyncIterator

import httpx

from backend.config import (
    DEFAULT_PRESENCE_PENALTY,
    DEFAULT_REPEAT_LAST_N,
    DEFAULT_REPEAT_PENALTY,
    DEEPTHINK_MAX_NEW_TOKENS,
    DEEPTHINK_REPEAT_PENALTY,
    DEEPTHINK_TEMPERATURE,
    DEEPTHINK_TOP_K,
    DEEPTHINK_TOP_P,
    FAST_MAX_NEW_TOKENS,
    MAX_CONTEXT_CHARS,
    MAX_CONTEXT_MESSAGES,
    MODEL_TIMEOUT_SECONDS,
    MODELS,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
)
from backend.file_service import MAX_FILE_CHARS
from backend.prompts import (
    AGE_ASSESS_PROMPT,
    MEMORY_EXTRACT_PROMPT,
    MODE_PROMPTS,
    TITLE_SYSTEM_PROMPT,
    build_system_prompt,
)

logger = logging.getLogger("flare.model")

MEMORY_TRIGGER = re.compile(
    r"\b(remember|my name|call me|i am|i'm|i live|i work|i study|i like|i love|"
    r"i prefer|i hate|i speak|my favou?rite|my job|my goal)\b|yadda saxla|adım",
    re.I,
)

NAME_PATTERN = re.compile(
    r"(?:my name is|call me|mənim adım|adım)\s+([A-Za-zƏəİıÖöÜüŞşÇçĞğ]{2,30})",
    re.I,
)

PLACE_PATTERN = re.compile(
    r"(?:i live in|i moved to|i'm living in|i am living in|now i live in)\s+"
    r"([A-Za-zƏəİıÖöÜüŞşÇçĞğ' -]{2,40}?)(?=[.,!?]|$)",
    re.I,
)

AGE_SCHEMA = {
    "type": "object",
    "properties": {"underage": {"type": "boolean"}, "evidence": {"type": "string"}},
    "required": ["underage", "evidence"],
}


MEMORY_SCHEMA = {
    "type": "object",
    "properties": {
        "memories": {
            "type": "array",
            "maxItems": 3,
            "items": {
                "type": "object",
                "properties": {
                    "content": {"type": "string"},
                    "type": {"type": "string", "enum": ["fact", "preference"]},
                },
                "required": ["content", "type"],
            },
        }
    },
    "required": ["memories"],
}


def clean_title(raw: str) -> str:
    text = re.sub(r"<think>.*?</think>", "", raw, flags=re.S).strip()
    line = text.splitlines()[0] if text else ""
    line = line.strip().strip("\"'`*#").strip()
    line = re.sub(r"^(chat\s+)?title\s*:\s*", "", line, flags=re.I)
    line = line.strip().strip("\"'`*#").strip().rstrip(".!?:;,")
    return line[:50]


FALLBACK_TEXT = "I could not finish this answer. Please try again."


def expand_attachments(message: dict) -> str:
    content = str(message.get("content", ""))
    blocks = []
    for item in message.get("attachments") or []:
        name = re.sub(r'[<>"\n]', "", str(item.get("name", "file")))
        text = str(item.get("text", ""))[:MAX_FILE_CHARS].replace("</file>", "")
        if name.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp")):
            text = "[OCR text read from an image. You cannot see the image itself.]\n" + text
        blocks.append(f"<file name={name}>\n{text}\n</file>")
    return "\n\n".join([*blocks, content]) if blocks else content


def find_loop(text: str) -> int:
    """Return how many trailing characters are redundant copies of a repeating unit."""
    for size in range(15, 501):
        if 3 * size > len(text):
            break
        unit = text[-size:]
        if len(set(unit)) < 5 or text[-2 * size : -size] != unit or text[-3 * size : -2 * size] != unit:
            continue
        copies = 3
        while (copies + 1) * size <= len(text) and text[-(copies + 1) * size : -copies * size] == unit:
            copies += 1
        base = (copies - 1) * size
        kept_tail = text[len(text) - base - size : len(text) - base]
        cut = max(kept_tail.rfind(mark) for mark in ".!?\n")
        return base + (size - cut - 1 if cut >= 0 else 0)
    return 0


class LoopGuard:
    def __init__(self) -> None:
        self.window = ""
        self.pending = 0

    def feed(self, chunk: str) -> int:
        self.window = (self.window + chunk)[-1500:]
        self.pending += len(chunk)
        if self.pending < 40:
            return 0
        self.pending = 0
        return find_loop(self.window)


class ModelService:
    def __init__(self) -> None:
        self.base_url = OLLAMA_BASE_URL
        self.model = OLLAMA_MODEL
        self.timeout = httpx.Timeout(MODEL_TIMEOUT_SECONDS, connect=10.0)

    async def health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
            names = {m.get("name", "") for m in response.json().get("models", [])}
            return any(n == self.model or n.startswith(self.model + ":") for n in names)
        except Exception:
            return False

    async def available_models(self) -> list[dict]:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
            names = {m.get("name", "") for m in response.json().get("models", [])}
        except Exception:
            names = set()
        result = []
        for key, info in MODELS.items():
            tag = info["ollama"]
            ready = any(n == tag or n.startswith(tag + ":") for n in names)
            result.append({"id": key, "name": info["name"], "available": ready})
        return result

    def _build_messages(self, messages, mode, settings, memories, web_results=None, web_failed=False) -> list[dict]:
        cleaned = [
            {"role": m["role"], "content": expand_attachments(m)}
            for m in messages
            if m.get("role") in {"user", "assistant"} and str(m.get("content", "")).strip()
        ][-MAX_CONTEXT_MESSAGES:]

        history: list[dict] = []
        used = 0
        for item in reversed(cleaned):
            used += len(item["content"])
            if history and used > MAX_CONTEXT_CHARS:
                break
            history.append(item)
        history.reverse()

        system = build_system_prompt(mode, settings, memories, web_results, web_failed)
        return [{"role": "system", "content": system}, *history]

    async def stream_chat(
        self,
        messages: list[dict],
        mode: str,
        max_new_tokens: int,
        temperature: float,
        top_p: float,
        top_k: int,
        settings: dict | None = None,
        memories: list[str] | None = None,
        model_key: str = "tentium",
        web_results: list[dict] | None = None,
        web_failed: bool = False,
    ) -> AsyncIterator[dict]:
        mode = mode if mode in MODE_PROMPTS else "fast"
        deep = mode == "deepthink"

        payload = {
            "model": MODELS.get(model_key, MODELS["tentium"])["ollama"],
            "messages": self._build_messages(messages, mode, settings, memories, web_results, web_failed),
            "stream": True,
            "think": deep and MODELS.get(model_key, MODELS["tentium"]).get("thinking", False),
            "keep_alive": "15m",
            "options": {
                "temperature": DEEPTHINK_TEMPERATURE if deep else temperature,
                "top_p": DEEPTHINK_TOP_P if deep else top_p,
                "top_k": DEEPTHINK_TOP_K if deep else top_k,
                "repeat_penalty": DEEPTHINK_REPEAT_PENALTY if deep else DEFAULT_REPEAT_PENALTY,
                "repeat_last_n": DEFAULT_REPEAT_LAST_N,
                "presence_penalty": DEFAULT_PRESENCE_PENALTY,
                "num_predict": DEEPTHINK_MAX_NEW_TOKENS if deep else min(max_new_tokens, FAST_MAX_NEW_TOKENS),
            },
        }

        started = time.monotonic()
        first_token_at = None
        tokens_generated = 0
        tokens_read = 0
        content_guard = LoopGuard()
        thinking_guard = LoopGuard()
        produced = False

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream("POST", f"{self.base_url}/api/chat", json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    chunk = json.loads(line)
                    message = chunk.get("message", {})
                    thought = message.get("thinking", "")
                    if thought and thinking_guard.feed(thought):
                        break
                    token = message.get("content", "")
                    if token:
                        produced = True
                        if first_token_at is None:
                            first_token_at = time.monotonic()
                        yield {"type": "token", "content": token}
                        redundant = content_guard.feed(token)
                        if redundant:
                            yield {"type": "trim", "remove": redundant}
                            break
                    if chunk.get("done"):
                        tokens_generated = chunk.get("eval_count", 0)
                        tokens_read = chunk.get("prompt_eval_count", 0)

        if not produced:
            yield {"type": "token", "content": FALLBACK_TEXT}

        yield {
            "type": "done",
            "eval_count": tokens_generated,
            "prompt_eval_count": tokens_read,
            "thinking_ms": int(((first_token_at or time.monotonic()) - started) * 1000),
        }

    async def generate_title(self, message: str) -> str:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": TITLE_SYSTEM_PROMPT},
                {"role": "user", "content": message[:600]},
            ],
            "stream": False,
            "think": False,
            "options": {"temperature": 0.3, "top_p": 0.8, "top_k": 20, "num_predict": 24},
            "keep_alive": "15m",
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(f"{self.base_url}/api/chat", json=payload)
            response.raise_for_status()
        return clean_title(response.json().get("message", {}).get("content", ""))

    async def assess_age(self, text: str) -> dict:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": AGE_ASSESS_PROMPT},
                {"role": "user", "content": text[:600]},
            ],
            "stream": False,
            "think": False,
            "format": AGE_SCHEMA,
            "options": {"temperature": 0, "num_predict": 60},
            "keep_alive": "15m",
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(f"{self.base_url}/api/chat", json=payload)
            response.raise_for_status()
        data = json.loads(response.json().get("message", {}).get("content", "{}"))
        return {"underage": bool(data.get("underage")), "evidence": str(data.get("evidence", ""))[:200]}

    async def extract_memories(self, text: str) -> list[dict]:
        if not MEMORY_TRIGGER.search(text):
            return []

        found = []
        name = NAME_PATTERN.search(text)
        if name:
            found.append({"content": f"User's name is {name.group(1).strip().title()}.", "type": "fact", "topic": "name"})
        place = PLACE_PATTERN.search(text)
        if place:
            found.append({"content": f"User lives in {place.group(1).strip().title()}.", "type": "fact", "topic": "location"})
        if found:
            return found

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": MEMORY_EXTRACT_PROMPT},
                {"role": "user", "content": text[:1000]},
            ],
            "stream": False,
            "think": False,
            "format": MEMORY_SCHEMA,
            "options": {"temperature": 0, "num_predict": 150},
            "keep_alive": "15m",
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(f"{self.base_url}/api/chat", json=payload)
                response.raise_for_status()
            data = json.loads(response.json().get("message", {}).get("content", ""))
        except Exception:
            logger.exception("Memory extraction failed")
            return []

        for item in (data.get("memories") or [])[:3]:
            content = str(item.get("content", "")).strip()
            if 8 <= len(content) <= 200 and content.lower().startswith("user"):
                kind = "preference" if item.get("type") == "preference" else "fact"
                found.append({"content": content, "type": kind})
        return found