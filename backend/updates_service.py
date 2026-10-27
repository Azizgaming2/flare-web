from __future__ import annotations

import json
import os
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from backend.config import MAX_UPDATE_MEDIA_BYTES, UPDATES_DIR

MEDIA_DIR = UPDATES_DIR / "media"
INDEX_FILE = UPDATES_DIR / "updates.json"
MEDIA_NAME = re.compile(r"^[a-f0-9]{32}\.(jpg|png|gif|webp|mp4|webm)$")
MEDIA_TYPES = {
    "jpg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
    "mp4": "video/mp4",
    "webm": "video/webm",
}
MAX_LISTED = 50
MAX_STORED = 200

_lock = threading.RLock()


class MediaError(Exception):
    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.status = status


def _load() -> list[dict]:
    try:
        data = json.loads(INDEX_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


def _save(items: list[dict]) -> None:
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = INDEX_FILE.with_name(INDEX_FILE.name + ".tmp")
    tmp.write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, INDEX_FILE)


def sniff(head: bytes) -> str | None:
    if head.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head[:4] == b"GIF8":
        return "gif"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    if head[4:8] == b"ftyp":
        return "mp4"
    if head[:4] == b"\x1a\x45\xdf\xa3":
        return "webm"
    return None


async def save_media(stream) -> str:
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = MEDIA_DIR / f"{uuid.uuid4().hex}.part"
    size = 0
    head = b""
    try:
        with tmp.open("wb") as handle:
            async for chunk in stream:
                size += len(chunk)
                if size > MAX_UPDATE_MEDIA_BYTES:
                    raise MediaError("File too large", 413)
                if len(head) < 16:
                    head += chunk[: 16 - len(head)]
                handle.write(chunk)
        ext = sniff(head)
        if ext is None:
            raise MediaError("Unsupported file type", 415)
        name = f"{uuid.uuid4().hex}.{ext}"
        os.replace(tmp, MEDIA_DIR / name)
        return name
    finally:
        tmp.unlink(missing_ok=True)


def media_path(name: str) -> Path | None:
    if not MEDIA_NAME.fullmatch(name):
        return None
    path = MEDIA_DIR / name
    return path if path.is_file() else None


def media_type(name: str) -> str:
    return MEDIA_TYPES.get(name.rsplit(".", 1)[-1], "application/octet-stream")


def list_updates() -> list[dict]:
    with _lock:
        return list(reversed(_load()))[:MAX_LISTED]


def create_update(title: str, body: str, media: list[str]) -> dict:
    with _lock:
        for name in media:
            if media_path(name) is None:
                raise MediaError("Media file not found", 400)
        item = {
            "id": uuid.uuid4().hex,
            "title": title.strip(),
            "body": body.strip(),
            "media": media,
            "created": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
        items = _load()
        items.append(item)
        _save(items[-MAX_STORED:])
        return item


def delete_update(update_id: str) -> bool:
    with _lock:
        items = _load()
        target = next((i for i in items if i.get("id") == update_id), None)
        if target is None:
            return False
        rest = [i for i in items if i.get("id") != update_id]
        used = {name for i in rest for name in i.get("media", [])}
        for name in target.get("media", []):
            if name not in used and MEDIA_NAME.fullmatch(name):
                (MEDIA_DIR / name).unlink(missing_ok=True)
        _save(rest)
        return True
