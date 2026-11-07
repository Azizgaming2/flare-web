"""Flare AI Class Mode: rooms, WebRTC signaling, chat, files, task ideas."""
import asyncio
import json
import os
import secrets
import shutil
import time
import urllib.request
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Header, HTTPException, UploadFile, WebSocket
from fastapi.responses import FileResponse
from pydantic import BaseModel

router = APIRouter()

STORAGE = Path(os.getenv("FLARE_STORAGE_ROOT", "D:/FlareData")) / "Classes"
TEACHERS = {e.strip().lower() for e in os.getenv("FLARE_TEACHER_EMAILS", "").split(",") if e.strip()}
MAX_ROOMS = int(os.getenv("FLARE_CLASS_MAX_ROOMS", "30"))
MAX_PEOPLE = int(os.getenv("FLARE_CLASS_MAX_PEOPLE", "30"))
IDLE_SECONDS = 300
MAX_FILE = 50 * 1024 * 1024
OLLAMA = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
MODEL = os.getenv("FLARE_TENTIUM_MODEL", "flare-tentium")
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
IMAGES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
MB = 1024 * 1024

# Resource tiers: a room with 1 person is low priority, limits grow with people
TIERS = {
    "low": {"gap": 1.5, "hist": 50, "img": 3 * MB},
    "mid": {"gap": 0.6, "hist": 150, "img": 8 * MB},
    "high": {"gap": 0.3, "hist": 300, "img": 10 * MB},
}

KINDS = {
    "test": "a short quiz with an answer key",
    "homework": "a homework assignment",
    "project": "a group project task",
    "discussion": "discussion questions",
    "creative": "a creative task",
}


class Peer:
    def __init__(self, pid, uid, name, role, ws):
        self.pid, self.uid, self.name, self.role, self.ws = pid, uid, name, role, ws
        self.mic = False
        self.cam = False
        self.muted = False
        self.last_chat = 0.0

    def public(self):
        return {"pid": self.pid, "name": self.name, "role": self.role,
                "mic": self.mic, "cam": self.cam, "muted": self.muted}


class Room:
    def __init__(self, code, host_uid, title):
        self.code, self.host_uid, self.title = code, host_uid, title
        self.peers = {}
        self.banned = set()
        self.history = []
        self.files = {}
        self.solo_since = time.time()
        self.closed = False

    def tier(self):
        n = len(self.peers)
        return "low" if n <= 1 else "mid" if n < 10 else "high"

    def touch(self):
        if len(self.peers) >= 2:
            self.solo_since = None
        elif self.solo_since is None:
            self.solo_since = time.time()


ROOMS = {}
_janitor_task = None
_idea_lock = asyncio.Lock()


def _ice():
    servers = [{"urls": "stun:stun.l.google.com:19302"}]
    turn = os.getenv("FLARE_TURN_URL")
    if turn:
        servers.append({"urls": turn.split(","), "username": os.getenv("FLARE_TURN_USER", ""),
                        "credential": os.getenv("FLARE_TURN_PASS", "")})
    return servers


async def _verify(token):
    from firebase_admin import auth as fb_auth
    try:
        return await asyncio.to_thread(fb_auth.verify_id_token, token)
    except Exception:
        raise HTTPException(401, "Giriş tələb olunur")


async def _auth(authorization):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Giriş tələb olunur")
    return await _verify(authorization[7:])


async def _member(code, authorization):
    claims = await _auth(authorization)
    room = ROOMS.get(code.upper())
    if not room:
        raise HTTPException(404, "Sinif tapılmadı")
    peer = next((p for p in room.peers.values() if p.uid == claims["uid"]), None)
    if not peer:
        raise HTTPException(403, "Sinifdə deyilsiniz")
    return room, peer


async def _send(peer, msg):
    try:
        await peer.ws.send_json(msg)
    except Exception:
        pass


async def _broadcast(room, msg, skip=None):
    await asyncio.gather(*[_send(p, msg) for p in list(room.peers.values()) if p.pid != skip])


def _state(peer):
    return {"type": "state", "pid": peer.pid, "mic": peer.mic, "cam": peer.cam, "muted": peer.muted}


async def _post(room, peer, text, md, file=None):
    msg = {"id": uuid.uuid4().hex[:10], "pid": peer.pid, "name": peer.name, "role": peer.role,
           "text": text, "md": md, "ts": int(time.time()), "file": file}
    room.history.append(msg)
    room.history = room.history[-TIERS[room.tier()]["hist"]:]
    await _broadcast(room, {"type": "chat", "msg": msg})


async def _close(room, reason="closed"):
    if room.closed:
        return
    room.closed = True
    ROOMS.pop(room.code, None)
    await _broadcast(room, {"type": reason})
    for p in list(room.peers.values()):
        try:
            await p.ws.close(4000)
        except Exception:
            pass
    shutil.rmtree(STORAGE / room.code, ignore_errors=True)


async def _janitor():
    while True:
        await asyncio.sleep(30)
        now = time.time()
        for room in list(ROOMS.values()):
            room.touch()
            if room.solo_since and now - room.solo_since >= IDLE_SECONDS:
                await _close(room)


def _ensure_janitor():
    global _janitor_task
    if _janitor_task is None or _janitor_task.done():
        if not ROOMS:
            shutil.rmtree(STORAGE, ignore_errors=True)
        _janitor_task = asyncio.create_task(_janitor())


class CreateIn(BaseModel):
    title: str = ""


@router.post("/api/class/create")
async def create_class(body: CreateIn, authorization: str = Header(None)):
    claims = await _auth(authorization)
    if TEACHERS and claims.get("email", "").lower() not in TEACHERS:
        raise HTTPException(403, "Sinif yalnız müəllimlər tərəfindən qurula bilər")
    if len(ROOMS) >= MAX_ROOMS:
        raise HTTPException(503, "Server məşğuldur, bir az sonra cəhd edin")
    if sum(r.host_uid == claims["uid"] for r in ROOMS.values()) >= 2:
        raise HTTPException(429, "Artıq açıq sinifləriniz var")
    code = "".join(secrets.choice(ALPHABET) for _ in range(6))
    while code in ROOMS:
        code = "".join(secrets.choice(ALPHABET) for _ in range(6))
    ROOMS[code] = Room(code, claims["uid"], (body.title.strip() or "Dərs")[:60])
    _ensure_janitor()
    return {"code": code}


@router.get("/api/class/{code}")
async def class_info(code: str, authorization: str = Header(None)):
    await _auth(authorization)
    room = ROOMS.get(code.upper())
    if not room:
        raise HTTPException(404, "Sinif tapılmadı")
    return {"code": room.code, "title": room.title, "count": len(room.peers)}


@router.post("/api/class/{code}/upload")
async def upload(code: str, file: UploadFile = File(...), authorization: str = Header(None)):
    room, peer = await _member(code, authorization)
    mime = file.content_type or "application/octet-stream"
    is_host = peer.role == "host"
    if not is_host and mime not in IMAGES:
        raise HTTPException(403, "Şagirdlər yalnız foto göndərə bilər")
    limit = MAX_FILE if is_host else TIERS[room.tier()]["img"]
    name = Path(file.filename or "file").name[:120]
    folder = STORAGE / room.code
    folder.mkdir(parents=True, exist_ok=True)
    fid = uuid.uuid4().hex
    path = folder / fid
    size = 0
    try:
        with open(path, "wb") as out:
            while chunk := await file.read(MB):
                size += len(chunk)
                if size > limit:
                    raise HTTPException(413, "Fayl çox böyükdür (maks. %d MB)" % (limit // MB))
                out.write(chunk)
    except HTTPException:
        path.unlink(missing_ok=True)
        raise
    room.files[fid] = {"path": path, "name": name, "mime": mime}
    await _post(room, peer, "", False, {"id": fid, "name": name, "size": size, "mime": mime})
    return {"ok": True}


@router.get("/api/class/{code}/file/{fid}")
async def get_file(code: str, fid: str, authorization: str = Header(None)):
    room, _ = await _member(code, authorization)
    f = room.files.get(fid)
    if not f or not f["path"].exists():
        raise HTTPException(404, "Fayl tapılmadı")
    return FileResponse(f["path"], media_type=f["mime"], filename=f["name"])


class IdeaIn(BaseModel):
    kind: str
    subject: str
    topic: str
    grade: str = ""
    level: str = "orta"
    count: int = 5
    extra: str = ""


def _ollama(prompt):
    body = json.dumps({"model": MODEL, "stream": False,
                       "messages": [{"role": "user", "content": prompt}],
                       "options": {"num_predict": 700, "temperature": 0.7}}).encode()
    req = urllib.request.Request(OLLAMA + "/api/chat", data=body,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read())["message"]["content"]


@router.post("/api/class/{code}/task-idea")
async def task_idea(code: str, body: IdeaIn, authorization: str = Header(None)):
    room, peer = await _member(code, authorization)
    if peer.role != "host":
        raise HTTPException(403, "Yalnız müəllim üçün")
    if body.kind not in KINDS:
        raise HTTPException(400, "Yanlış növ")
    if not body.subject.strip() or not body.topic.strip():
        raise HTTPException(400, "Fənn və mövzu tələb olunur")
    lines = ["You are an assistant for a school teacher in Azerbaijan. Create %s." % KINDS[body.kind],
             "Subject: " + body.subject[:100], "Topic: " + body.topic[:200]]
    if body.grade:
        lines.append("Grade: " + body.grade[:10])
    lines.append("Difficulty: " + body.level[:20])
    if body.kind in ("test", "discussion"):
        lines.append("Number of items: %d" % max(1, min(body.count, 15)))
    if body.extra:
        lines.append("Teacher request: " + body.extra[:300])
    lines.append("Write in Azerbaijani. Be concise, use short numbered items. Do not ask questions.")
    if _idea_lock.locked():
        raise HTTPException(429, "AI məşğuldur, bir az sonra yenidən cəhd edin")
    async with _idea_lock:
        try:
            text = await asyncio.to_thread(_ollama, "\n".join(lines))
        except Exception:
            raise HTTPException(502, "AI cavab vermir")
    return {"text": text.strip()}


@router.websocket("/ws/class/{code}")
async def class_ws(ws: WebSocket, code: str):
    await ws.accept()
    room = ROOMS.get(code.upper())
    if not room:
        await ws.send_json({"type": "error", "reason": "not_found"})
        await ws.close(4004)
        return
    try:
        first = await asyncio.wait_for(ws.receive_json(), 10)
        claims = await _verify(first.get("token", ""))
    except Exception:
        await ws.close(4001)
        return
    uid = claims["uid"]
    if uid in room.banned:
        await ws.send_json({"type": "kicked"})
        await ws.close(4003)
        return
    is_host = uid == room.host_uid
    if len(room.peers) >= MAX_PEOPLE and not is_host:
        await ws.send_json({"type": "error", "reason": "full"})
        await ws.close(4005)
        return
    for old in [p for p in room.peers.values() if p.uid == uid]:
        room.peers.pop(old.pid, None)
        try:
            await old.ws.close(4002)
        except Exception:
            pass
        await _broadcast(room, {"type": "peer_leave", "pid": old.pid})

    name = (first.get("name") or claims.get("name") or claims.get("email", "").split("@")[0] or "Şagird")[:40]
    pid = uuid.uuid4().hex[:8]
    peer = Peer(pid, uid, name, "host" if is_host else "student", ws)
    room.peers[pid] = peer
    room.touch()
    await ws.send_json({"type": "joined", "you": pid, "role": peer.role, "title": room.title,
                        "ice": _ice(), "history": room.history,
                        "peers": [p.public() for p in room.peers.values()]})
    await _broadcast(room, {"type": "peer_join", "peer": peer.public()}, skip=pid)

    try:
        while True:
            m = await ws.receive_json()
            t = m.get("type")
            if t == "chat":
                text = str(m.get("text", "")).strip()[:4000]
                now = time.time()
                if text and now - peer.last_chat >= TIERS[room.tier()]["gap"]:
                    peer.last_chat = now
                    await _post(room, peer, text, bool(m.get("md")))
            elif t == "signal":
                target = room.peers.get(m.get("to"))
                if target and (peer.role == "host" or target.role == "host"):
                    await _send(target, {"type": "signal", "from": pid, "data": m.get("data")})
            elif t == "state":
                peer.mic = bool(m.get("mic")) and not peer.muted
                peer.cam = bool(m.get("cam"))
                await _broadcast(room, _state(peer))
            elif t == "screen" and peer.role == "host":
                await _broadcast(room, {"type": "screen", "on": bool(m.get("on"))})
            elif t == "mute" and peer.role == "host":
                val = bool(m.get("value"))
                if m.get("target") == "all":
                    targets = [p for p in room.peers.values() if p.role != "host"]
                else:
                    targets = [room.peers.get(m.get("target"))]
                for p in targets:
                    if p and p.role != "host":
                        p.muted = val
                        if val:
                            p.mic = False
                        await _broadcast(room, _state(p))
            elif t == "kick" and peer.role == "host":
                p = room.peers.get(m.get("target"))
                if p and p.role != "host":
                    room.banned.add(p.uid)
                    await _send(p, {"type": "kicked"})
                    try:
                        await p.ws.close(4003)
                    except Exception:
                        pass
            elif t == "end" and peer.role == "host":
                await _close(room)
                return
    except Exception:
        pass
    finally:
        if not room.closed and room.peers.get(pid) is peer:
            room.peers.pop(pid, None)
            room.touch()
            await _broadcast(room, {"type": "peer_leave", "pid": pid})
