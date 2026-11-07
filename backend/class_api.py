from __future__ import annotations

import asyncio
from typing import Annotated
from urllib.parse import unquote

from fastapi import APIRouter, Header, HTTPException, Path, Request, WebSocket
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from backend import class_service as svc

CodePath = Annotated[str, Path(pattern=r"^[A-Za-z0-9]{6}$")]
FilePath = Annotated[str, Path(pattern=r"^[a-f0-9]{32}$")]


class CreateBody(BaseModel):
    title: str = Field(default="", max_length=60)


class IdeaBody(BaseModel):
    kind: str = Field(max_length=20)
    subject: str = Field(max_length=100)
    topic: str = Field(max_length=200)
    grade: str = Field(default="", max_length=10)
    level: str = Field(default="medium", max_length=20)
    count: int = Field(default=5, ge=1, le=15)
    extra: str = Field(default="", max_length=300)


def _fail(exc: svc.ClassError) -> HTTPException:
    return HTTPException(status_code=exc.status, detail=exc.code)


def build_router(resolve_user, can_create) -> APIRouter:
    router = APIRouter()

    async def need_user(authorization: str | None) -> dict:
        user = await resolve_user(authorization)
        if user is None:
            raise HTTPException(status_code=401, detail="login_required")
        return user

    @router.post("/api/class/create")
    async def create_class(body: CreateBody, authorization: str | None = Header(default=None)):
        user = await need_user(authorization)
        if not can_create(user):
            raise HTTPException(status_code=403, detail="teachers_only")
        try:
            room = svc.create_room(user["uid"], body.title)
        except svc.ClassError as exc:
            raise _fail(exc) from exc
        return {"code": room.code}

    @router.get("/api/class/{code}")
    async def class_info(code: CodePath, authorization: str | None = Header(default=None)):
        await need_user(authorization)
        try:
            room = svc.get_room(code)
        except svc.ClassError as exc:
            raise _fail(exc) from exc
        return {"code": room.code, "title": room.title, "count": len(room.peers)}

    @router.post("/api/class/{code}/upload")
    async def upload(code: CodePath, request: Request, authorization: str | None = Header(default=None)):
        user = await need_user(authorization)
        try:
            room = svc.get_room(code)
            peer = svc.member(room, user["uid"])
            name = unquote(request.headers.get("x-file-name", "file"))
            mime = (request.headers.get("content-type") or "application/octet-stream").split(";")[0].strip()
            declared = int(request.headers.get("content-length") or 0)
            await svc.save_upload(room, peer, request.stream(), name, mime, declared)
        except svc.ClassError as exc:
            raise _fail(exc) from exc
        return {"ok": True}

    @router.get("/api/class/{code}/file/{fid}")
    async def get_file(code: CodePath, fid: FilePath, authorization: str | None = Header(default=None)):
        user = await need_user(authorization)
        try:
            room = svc.get_room(code)
            svc.member(room, user["uid"])
        except svc.ClassError as exc:
            raise _fail(exc) from exc
        item = room.files.get(fid)
        if not item or not item["path"].exists():
            raise HTTPException(status_code=404, detail="not_found")
        return FileResponse(item["path"], media_type=item["mime"], filename=item["name"])

    @router.post("/api/class/{code}/task-idea")
    async def task_idea(code: CodePath, body: IdeaBody, authorization: str | None = Header(default=None)):
        user = await need_user(authorization)
        try:
            room = svc.get_room(code)
            peer = svc.member(room, user["uid"])
            if peer.role != "host":
                raise svc.ClassError(403, "teachers_only")
            return {"text": await svc.make_idea(body.model_dump())}
        except svc.ClassError as exc:
            raise _fail(exc) from exc

    @router.websocket("/ws/class/{code}")
    async def class_ws(ws: WebSocket, code: str):
        await ws.accept()
        room = svc.ROOMS.get(code.upper())
        if room is None:
            await ws.send_json({"type": "error", "reason": "not_found"})
            await ws.close(4004)
            return
        try:
            first = await asyncio.wait_for(ws.receive_json(), 10)
            user = await resolve_user("Bearer " + str(first.get("token", "")))
            if user is None:
                raise ValueError("no user")
        except Exception:
            await ws.close(4001)
            return
        name = (
            str(first.get("name") or user.get("name") or str(user.get("email", "")).split("@")[0] or "User")
        )[:40]
        try:
            peer = await svc.join(room, ws, user["uid"], name)
        except svc.ClassError as exc:
            await ws.send_json({"type": "kicked" if exc.code == "kicked" else "error", "reason": exc.code})
            await ws.close(4003)
            return
        try:
            while True:
                message = await ws.receive_json()
                if not await svc.handle_message(room, peer, message):
                    break
        except Exception:
            pass
        finally:
            await svc.leave(room, peer)

    return router
