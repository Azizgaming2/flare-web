from __future__ import annotations

import json
import os
import re
import shutil
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from backend.config import MAX_STORED_MEMORIES, STORAGE_ROOT, USER_QUOTA_BYTES

_UID = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
_CHAT_ID = re.compile(r"^[A-Za-z0-9_-]{1,120}$")
_locks: dict[str, threading.RLock] = {}
_locks_guard = threading.Lock()

TOPIC_PREFIX = {"name": "user's name is", "location": "user lives in"}

DEFAULT_SETTINGS = {
    "nickname": "",
    "character": "default",
    "emoji": "default",
    "markdown": "default",
    "instructions": "",
    "memory_enabled": True,
}


class StorageError(Exception):
    pass


class StorageFull(StorageError):
    pass


class ChatNotFound(StorageError):
    pass


def _lock(uid: str) -> threading.RLock:
    with _locks_guard:
        return _locks.setdefault(uid, threading.RLock())


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def user_dir(uid: str) -> Path:
    if not _UID.fullmatch(uid):
        raise StorageError("Invalid user id")
    base = Path(STORAGE_ROOT) / "users" / uid
    for sub in ("Files", "Memory", "Chats"):
        (base / sub).mkdir(parents=True, exist_ok=True)
    return base


def usage_bytes(uid: str) -> int:
    return sum(f.stat().st_size for f in user_dir(uid).rglob("*") if f.is_file())


def _write(uid: str, path: Path, text: str) -> None:
    data = text.encode("utf-8")
    old = path.stat().st_size if path.exists() else 0
    if len(data) > old and usage_bytes(uid) - old + len(data) > USER_QUOTA_BYTES:
        raise StorageFull("Storage quota exceeded")
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


def _write_json(uid: str, path: Path, obj) -> None:
    _write(uid, path, json.dumps(obj, ensure_ascii=False, indent=1))


def _read_json(path: Path, default):
    try:
        return json.loads(path.read_text("utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


# ---- settings ----

def get_settings(uid: str) -> dict:
    data = _read_json(user_dir(uid) / "settings.json", {})
    return {**DEFAULT_SETTINGS, **{k: v for k, v in data.items() if k in DEFAULT_SETTINGS}}


def update_settings(uid: str, patch: dict) -> dict:
    with _lock(uid):
        settings = get_settings(uid)
        settings.update({k: v for k, v in patch.items() if k in DEFAULT_SETTINGS})
        _write_json(uid, user_dir(uid) / "settings.json", settings)
        return settings


# ---- memory ----

def _memory_paths(uid: str) -> tuple[Path, Path]:
    folder = user_dir(uid) / "Memory"
    return folder / "memories.json", folder / "memory.txt"


def list_memories(uid: str) -> list[dict]:
    return _read_json(_memory_paths(uid)[0], [])


def _save_memories(uid: str, items: list[dict]) -> None:
    js, txt = _memory_paths(uid)
    _write_json(uid, js, items)
    _write(uid, txt, "".join(f"- {m['content']}\n" for m in items))


def add_memories(uid: str, entries: list[dict]) -> int:
    with _lock(uid):
        items = list_memories(uid)
        known = {m["content"].strip().lower() for m in items}
        added = 0
        for entry in entries:
            content = entry["content"].strip()
            topic = entry.get("topic")
            if topic:
                prefix = TOPIC_PREFIX.get(topic, "\0")
                if any(m["content"].strip().lower() == content.lower() for m in items):
                    continue
                items = [
                    m for m in items
                    if m.get("topic") != topic and not m["content"].strip().lower().startswith(prefix)
                ]
                known = {m["content"].strip().lower() for m in items}
            if content.lower() in known:
                continue
            items.append(
                {
                    "id": uuid.uuid4().hex[:12],
                    "content": content,
                    "type": entry.get("type", "fact"),
                    "topic": topic,
                    "createdAt": _now(),
                }
            )
            known.add(content.lower())
            added += 1
        if added:
            _save_memories(uid, items[-MAX_STORED_MEMORIES:])
        return added


def delete_memory(uid: str, memory_id: str) -> None:
    with _lock(uid):
        _save_memories(uid, [m for m in list_memories(uid) if m["id"] != memory_id])


def clear_memories(uid: str) -> None:
    with _lock(uid):
        _save_memories(uid, [])


def memories_text(uid: str) -> str:
    try:
        return _memory_paths(uid)[1].read_text("utf-8")
    except FileNotFoundError:
        return ""


# ---- chats ----

def _chats_dir(uid: str) -> Path:
    return user_dir(uid) / "Chats"


def _index(uid: str) -> dict:
    return _read_json(_chats_dir(uid) / ".index.json", {})


def _save_index(uid: str, index: dict) -> None:
    _write_json(uid, _chats_dir(uid) / ".index.json", index)


def _chat_path(uid: str, chat_id: str) -> Path:
    if not _CHAT_ID.fullmatch(chat_id):
        raise StorageError("Invalid chat id")
    return _chats_dir(uid) / f"{chat_id}.json"


def save_exchange(uid: str, chat_id: str, user_text: str, assistant: dict, attachments: list[dict] | None = None) -> None:
    with _lock(uid):
        path = _chat_path(uid, chat_id)
        now = _now()
        chat = _read_json(path, None) or {
            "id": chat_id,
            "title": user_text.strip()[:30] or "New Chat",
            "archived": False,
            "createdAt": now,
            "messages": [],
        }
        user_message = {"role": "user", "content": user_text, "at": now}
        if attachments:
            user_message["attachments"] = [{"name": a["name"], "text": a["text"]} for a in attachments]
        chat["messages"].append(user_message)
        chat["messages"].append({**assistant, "role": "assistant", "at": now})
        chat["updatedAt"] = now
        _write_json(uid, path, chat)

        index = _index(uid)
        index[chat_id] = {
            "title": chat["title"],
            "archived": chat["archived"],
            "updatedAt": now,
        }
        _save_index(uid, index)


def list_chats(uid: str, archived: bool = False) -> list[dict]:
    index = _index(uid)
    rows = [
        (meta.get("updatedAt", ""), chat_id, meta)
        for chat_id, meta in index.items()
        if bool(meta.get("archived")) == archived
    ]
    rows.sort(reverse=True)
    return [{"id": chat_id, "title": meta.get("title") or "New Chat"} for _, chat_id, meta in rows]


def get_chat_messages(uid: str, chat_id: str) -> list[dict]:
    chat = _read_json(_chat_path(uid, chat_id), None)
    if chat is None:
        return []
    keys = ("role", "content", "thinkingMs", "memoryUpdated", "attachments")
    return [{k: m[k] for k in keys if k in m} for m in chat["messages"]]


def update_chat(uid: str, chat_id: str, title: str | None = None, archived: bool | None = None) -> None:
    with _lock(uid):
        path = _chat_path(uid, chat_id)
        chat = _read_json(path, None)
        if chat is None:
            raise ChatNotFound(chat_id)
        if title is not None:
            chat["title"] = title
        if archived is not None:
            chat["archived"] = archived
        _write_json(uid, path, chat)

        index = _index(uid)
        index[chat_id] = {
            "title": chat["title"],
            "archived": chat["archived"],
            "updatedAt": chat.get("updatedAt", ""),
        }
        _save_index(uid, index)


def delete_chat(uid: str, chat_id: str) -> None:
    with _lock(uid):
        _chat_path(uid, chat_id).unlink(missing_ok=True)
        index = _index(uid)
        if index.pop(chat_id, None) is not None:
            _save_index(uid, index)


def delete_all_chats(uid: str) -> None:
    with _lock(uid):
        folder = _chats_dir(uid)
        shutil.rmtree(folder, ignore_errors=True)
        folder.mkdir(parents=True, exist_ok=True)
