from __future__ import annotations

import asyncio
import secrets
import shutil
import time
import uuid
from pathlib import Path

import httpx

from backend.config import (
    CLASS_DIR,
    CLASS_FILE_MAX_BYTES,
    CLASS_IDLE_SECONDS,
    CLASS_MAX_PEOPLE,
    CLASS_MAX_ROOMS,
    CLASS_TURN_PASS,
    CLASS_TURN_URL,
    CLASS_TURN_USER,
    OLLAMA_BASE_URL,
    TENTIUM_MODEL,
)

MB = 1024 * 1024
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}

# Rooms with one person get the lowest limits; limits rise as people join.
TIERS = {
    "low": {"chat_gap": 1.5, "history": 50, "student_image": 3 * MB},
    "mid": {"chat_gap": 0.6, "history": 150, "student_image": 8 * MB},
    "high": {"chat_gap": 0.3, "history": 300, "student_image": 10 * MB},
}

IDEA_KINDS = {
    "test": "a short quiz with an answer key",
    "homework": "a homework assignment",
    "project": "a group project task",
    "discussion": "discussion questions",
    "creative": "a creative task",
}


class ClassError(Exception):
    def __init__(self, status: int, code: str):
        super().__init__(code)
        self.status = status
        self.code = code


class Peer:
    def __init__(self, pid: str, uid: str, name: str, role: str, ws):
        self.pid = pid
        self.uid = uid
        self.name = name
        self.role = role
        self.ws = ws
        self.mic = False
        self.cam = False
        self.muted = False
        self.last_chat = 0.0

    def public(self) -> dict:
        return {
            "pid": self.pid,
            "name": self.name,
            "role": self.role,
            "mic": self.mic,
            "cam": self.cam,
            "muted": self.muted,
        }


class Room:
    def __init__(self, code: str, host_uid: str, title: str):
        self.code = code
        self.host_uid = host_uid
        self.title = title
        self.peers: dict[str, Peer] = {}
        self.banned: set[str] = set()
        self.history: list[dict] = []
        self.files: dict[str, dict] = {}
        self.solo_since: float | None = time.time()
        self.closed = False

    @property
    def tier(self) -> str:
        n = len(self.peers)
        return "low" if n <= 1 else "mid" if n < 10 else "high"

    def touch(self) -> None:
        if len(self.peers) >= 2:
            self.solo_since = None
        elif self.solo_since is None:
            self.solo_since = time.time()


ROOMS: dict[str, Room] = {}
_janitor_task: asyncio.Task | None = None
_idea_lock: asyncio.Lock | None = None


def ice_servers() -> list[dict]:
    servers: list[dict] = [{"urls": "stun:stun.l.google.com:19302"}]
    if CLASS_TURN_URL:
        servers.append(
            {"urls": CLASS_TURN_URL.split(","), "username": CLASS_TURN_USER, "credential": CLASS_TURN_PASS}
        )
    return servers


def get_room(code: str) -> Room:
    room = ROOMS.get(code.upper())
    if not room:
        raise ClassError(404, "not_found")
    return room


def member(room: Room, uid: str) -> Peer:
    peer = next((p for p in room.peers.values() if p.uid == uid), None)
    if not peer:
        raise ClassError(403, "not_member")
    return peer


def create_room(uid: str, title: str) -> Room:
    if len(ROOMS) >= CLASS_MAX_ROOMS:
        raise ClassError(503, "server_busy")
    if sum(r.host_uid == uid for r in ROOMS.values()) >= 2:
        raise ClassError(429, "too_many_rooms")
    code = "".join(secrets.choice(ALPHABET) for _ in range(6))
    while code in ROOMS:
        code = "".join(secrets.choice(ALPHABET) for _ in range(6))
    room = Room(code, uid, (title.strip() or "Class")[:60])
    ROOMS[code] = room
    _ensure_janitor()
    return room


async def send(peer: Peer, msg: dict) -> None:
    try:
        await peer.ws.send_json(msg)
    except Exception:
        pass


async def broadcast(room: Room, msg: dict, skip: str | None = None) -> None:
    await asyncio.gather(*[send(p, msg) for p in list(room.peers.values()) if p.pid != skip])


def _state(peer: Peer) -> dict:
    return {"type": "state", "pid": peer.pid, "mic": peer.mic, "cam": peer.cam, "muted": peer.muted}


async def post(room: Room, peer: Peer, text: str, md: bool, file: dict | None = None) -> None:
    msg = {
        "id": uuid.uuid4().hex[:10],
        "pid": peer.pid,
        "name": peer.name,
        "role": peer.role,
        "text": text,
        "md": md,
        "ts": int(time.time()),
        "file": file,
    }
    room.history.append(msg)
    room.history = room.history[-TIERS[room.tier]["history"]:]
    await broadcast(room, {"type": "chat", "msg": msg})


async def close_room(room: Room, reason: str = "closed") -> None:
    if room.closed:
        return
    room.closed = True
    ROOMS.pop(room.code, None)
    await broadcast(room, {"type": reason})
    for p in list(room.peers.values()):
        try:
            await p.ws.close(4000)
        except Exception:
            pass
    shutil.rmtree(CLASS_DIR / room.code, ignore_errors=True)


async def _janitor() -> None:
    while True:
        await asyncio.sleep(30)
        now = time.time()
        for room in list(ROOMS.values()):
            room.touch()
            if room.solo_since is not None and now - room.solo_since >= CLASS_IDLE_SECONDS:
                await close_room(room)


def _ensure_janitor() -> None:
    global _janitor_task
    if _janitor_task is None or _janitor_task.done():
        if len(ROOMS) <= 1:
            shutil.rmtree(CLASS_DIR, ignore_errors=True)
        _janitor_task = asyncio.create_task(_janitor())


async def join(room: Room, ws, uid: str, name: str) -> Peer:
    if uid in room.banned:
        raise ClassError(403, "kicked")
    is_host = uid == room.host_uid
    if len(room.peers) >= CLASS_MAX_PEOPLE and not is_host:
        raise ClassError(403, "full")
    for old in [p for p in room.peers.values() if p.uid == uid]:
        room.peers.pop(old.pid, None)
        try:
            await old.ws.close(4002)
        except Exception:
            pass
        await broadcast(room, {"type": "peer_leave", "pid": old.pid})
    peer = Peer(uuid.uuid4().hex[:8], uid, name, "host" if is_host else "student", ws)
    room.peers[peer.pid] = peer
    room.touch()
    await send(
        peer,
        {
            "type": "joined",
            "you": peer.pid,
            "role": peer.role,
            "title": room.title,
            "ice": ice_servers(),
            "history": room.history,
            "peers": [p.public() for p in room.peers.values()],
        },
    )
    await broadcast(room, {"type": "peer_join", "peer": peer.public()}, skip=peer.pid)
    return peer


async def leave(room: Room, peer: Peer) -> None:
    if room.closed or room.peers.get(peer.pid) is not peer:
        return
    room.peers.pop(peer.pid, None)
    room.touch()
    await broadcast(room, {"type": "peer_leave", "pid": peer.pid})


async def handle_message(room: Room, peer: Peer, m: dict) -> bool:
    """Returns False when the session must stop."""
    kind = m.get("type")
    host = peer.role == "host"
    if kind == "chat":
        text = str(m.get("text", "")).strip()[:4000]
        now = time.time()
        if text and now - peer.last_chat >= TIERS[room.tier]["chat_gap"]:
            peer.last_chat = now
            await post(room, peer, text, bool(m.get("md")))
    elif kind == "signal":
        target = room.peers.get(m.get("to"))
        if target and (host or target.role == "host"):
            await send(target, {"type": "signal", "from": peer.pid, "data": m.get("data")})
    elif kind == "state":
        peer.mic = bool(m.get("mic")) and not peer.muted
        peer.cam = bool(m.get("cam"))
        await broadcast(room, _state(peer))
    elif kind == "screen" and host:
        await broadcast(room, {"type": "screen", "on": bool(m.get("on"))})
    elif kind == "mute" and host:
        value = bool(m.get("value"))
        if m.get("target") == "all":
            targets = [p for p in room.peers.values() if p.role != "host"]
        else:
            targets = [room.peers.get(m.get("target"))]
        for p in targets:
            if p and p.role != "host":
                p.muted = value
                if value:
                    p.mic = False
                await broadcast(room, _state(p))
    elif kind == "kick" and host:
        p = room.peers.get(m.get("target"))
        if p and p.role != "host":
            room.banned.add(p.uid)
            await send(p, {"type": "kicked"})
            try:
                await p.ws.close(4003)
            except Exception:
                pass
    elif kind == "end" and host:
        await close_room(room)
        return False
    return True


async def save_upload(room: Room, peer: Peer, chunks, name: str, mime: str, declared: int) -> None:
    host = peer.role == "host"
    if not host and mime not in IMAGE_TYPES:
        raise ClassError(403, "students_images_only")
    limit = CLASS_FILE_MAX_BYTES if host else TIERS[room.tier]["student_image"]
    if declared > limit:
        raise ClassError(413, "too_big")
    folder = CLASS_DIR / room.code
    folder.mkdir(parents=True, exist_ok=True)
    fid = uuid.uuid4().hex
    path = folder / fid
    size = 0
    try:
        with open(path, "wb") as out:
            async for chunk in chunks:
                size += len(chunk)
                if size > limit:
                    raise ClassError(413, "too_big")
                out.write(chunk)
    except ClassError:
        path.unlink(missing_ok=True)
        raise
    if room.closed:
        path.unlink(missing_ok=True)
        raise ClassError(404, "not_found")
    safe_name = Path(name).name[:120] or "file"
    room.files[fid] = {"path": path, "name": safe_name, "mime": mime}
    await post(room, peer, "", False, {"id": fid, "name": safe_name, "size": size, "mime": mime})


async def make_idea(params: dict) -> str:
    global _idea_lock
    if params["kind"] not in IDEA_KINDS:
        raise ClassError(400, "bad_request")
    if not params["subject"].strip() or not params["topic"].strip():
        raise ClassError(400, "missing_fields")
    lines = [
        f"You are an assistant for a school teacher in Azerbaijan. Create {IDEA_KINDS[params['kind']]}.",
        f"Subject: {params['subject'][:100]}",
        f"Topic: {params['topic'][:200]}",
    ]
    if params["grade"]:
        lines.append(f"Grade: {params['grade'][:10]}")
    lines.append(f"Difficulty: {params['level'][:20]}")
    if params["kind"] in ("test", "discussion"):
        lines.append(f"Number of items: {max(1, min(int(params['count']), 15))}")
    if params["extra"]:
        lines.append(f"Teacher request: {params['extra'][:300]}")
    lines.append("Write in Azerbaijani. Be concise, use short numbered items. Do not ask questions.")

    if _idea_lock is None:
        _idea_lock = asyncio.Lock()
    if _idea_lock.locked():
        raise ClassError(429, "ai_busy")
    async with _idea_lock:
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=10.0)) as client:
                resp = await client.post(
                    f"{OLLAMA_BASE_URL}/api/chat",
                    json={
                        "model": TENTIUM_MODEL,
                        "stream": False,
                        "messages": [{"role": "user", "content": "\n".join(lines)}],
                        "options": {"num_predict": 700, "temperature": 0.7},
                    },
                )
                resp.raise_for_status()
                return resp.json()["message"]["content"].strip()
        except Exception as exc:
            raise ClassError(502, "ai_down") from exc
