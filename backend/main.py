from __future__ import annotations

import asyncio
import pathlib
import json
import logging
from urllib.parse import unquote
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, Header, HTTPException, Path, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, StreamingResponse

from backend.config import (
    ADMIN_EMAILS,
    ANON_IP_DAILY_LIMIT,
    ANON_MESSAGE_LIMIT,
    CORS_ORIGINS,
    MAX_MEMORY_ITEMS,
    MAX_UPDATE_MEDIA_BYTES,
    USER_MESSAGE_LIMIT,
    USER_QUOTA_BYTES,
    USER_WINDOW_SECONDS,
)
from backend.firebase_service import init_firebase, verify_token
from backend.model_service import ModelService
from backend.schemas import ID_PATTERN, ChatPatch, ChatRequest, FeedbackRequest, SettingsUpdate, TitleRequest, UpdateCreate
from backend import storage_service as store
from backend import updates_service as updates
from backend import age_guard
from backend import age_review
from backend import appeals
from backend.appeals import AppealRequest
from backend import feedback_service as feedback
from backend import file_service as fileio
from backend import search_service as search
from backend import usage_service as usage

logger = logging.getLogger("flare.api")

model_service: ModelService | None = None

IdPath = Annotated[str, Path(pattern=ID_PATTERN)]
MemoryIdPath = Annotated[str, Path(pattern=r"^[a-f0-9]{1,32}$")]


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model_service
    init_firebase()
    model_service = ModelService()
    yield


app = FastAPI(title="Flare AI API", version="0.6.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def resolve_identity(authorization: str | None) -> str | None:
    if authorization and authorization.startswith("Bearer "):
        try:
            decoded = await asyncio.to_thread(verify_token, authorization.split(" ", 1)[1])
            return decoded["uid"]
        except Exception as exc:
            raise HTTPException(status_code=401, detail="Invalid auth token") from exc
    return None


async def require_uid(authorization: str | None) -> str:
    uid = await resolve_identity(authorization)
    if uid is None:
        raise HTTPException(status_code=401, detail="Login required")
    return uid


async def resolve_user(authorization: str | None) -> dict | None:
    if authorization and authorization.startswith("Bearer "):
        try:
            return await asyncio.to_thread(verify_token, authorization.split(" ", 1)[1])
        except Exception as exc:
            raise HTTPException(status_code=401, detail="Invalid auth token") from exc
    return None


def client_ip(http: Request) -> str:
    return http.headers.get("cf-connecting-ip") or (http.client.host if http.client else "unknown")


def is_admin(decoded: dict | None) -> bool:
    if not decoded or not decoded.get("email_verified"):
        return False
    return str(decoded.get("email", "")).lower() in ADMIN_EMAILS


def verified_email(decoded: dict | None) -> str:
    if not decoded or not decoded.get("email_verified"):
        return ""
    return str(decoded.get("email", "")).lower()


async def enforce_access(decoded: dict | None, http: Request, anon_id: str | None, user_text: str) -> None:
    if decoded and not is_admin(decoded):
        uid = decoded["uid"]
        account = await asyncio.to_thread(usage.get_account, uid)
        if account["suspended"]:
            raise HTTPException(status_code=403, detail={"code": "suspended"})
        if not account["age_confirmed"]:
            raise HTTPException(status_code=403, detail={"code": "age_required"})
        if age_guard.is_underage(user_text) and not await asyncio.to_thread(appeals.is_whitelisted, verified_email(decoded)):
            await asyncio.to_thread(usage.suspend, uid, str(decoded.get("email", "")), "under-age statement")
            raise HTTPException(status_code=403, detail={"code": "suspended"})
    await enforce_limit(decoded, http, anon_id)


async def enforce_limit(decoded: dict | None, http: Request, anon_id: str | None) -> None:
    if decoded:
        if is_admin(decoded):
            return
        allowed, retry_after = await asyncio.to_thread(
            usage.consume_user, decoded["uid"], USER_MESSAGE_LIMIT, USER_WINDOW_SECONDS
        )
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail={"code": "limit_reached", "retry_after": retry_after},
                headers={"Retry-After": str(retry_after)},
            )
        return
    allowed = await asyncio.to_thread(
        usage.consume_anon, anon_id, client_ip(http), ANON_MESSAGE_LIMIT, ANON_IP_DAILY_LIMIT
    )
    if not allowed:
        raise HTTPException(status_code=429, detail={"code": "login_required"})


async def decode_admin(authorization: str | None) -> dict | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        decoded = await asyncio.to_thread(verify_token, authorization.split(" ", 1)[1])
    except Exception:
        return None
    email = str(decoded.get("email", "")).lower()
    if decoded.get("email_verified") and email in ADMIN_EMAILS:
        return decoded
    return None


async def require_admin(authorization: str | None) -> None:
    if await decode_admin(authorization) is None:
        raise HTTPException(status_code=403, detail="Admin only")


def require_model() -> ModelService:
    if model_service is None:
        raise HTTPException(status_code=503, detail="Model service is not ready")
    return model_service


def sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def persist(uid: str, chat_id: str, user_text: str, record: dict, attachments: list[dict]) -> None:
    try:
        store.save_exchange(uid, chat_id, user_text, record, attachments)
    except Exception:
        logger.exception("Failed to save chat")


_age_tasks: set[asyncio.Task] = set()
_age_gate = asyncio.Semaphore(1)
AGE_QUEUE_LIMIT = 8


async def review_age(uid: str, email: str, texts: list[str]) -> None:
    try:
        async with _age_gate:
            verdict = await require_model().assess_age(texts[-1])
        if verdict["underage"]:
            await asyncio.to_thread(age_review.flag, uid, email, verdict["evidence"], texts[-5:])
    except Exception:
        logger.exception("Age review failed")


def schedule_age_review(uid: str, email: str, texts: list[str]) -> None:
    if len(_age_tasks) >= AGE_QUEUE_LIMIT or len(texts[-1].strip()) < 3:
        return
    task = asyncio.create_task(review_age(uid, email, texts))
    _age_tasks.add(task)
    task.add_done_callback(_age_tasks.discard)


@app.post("/api/chat/stream")
async def chat_stream(
    request: ChatRequest,
    http: Request,
    authorization: str | None = Header(default=None),
    x_anon_id: str | None = Header(default=None),
):
    service = require_model()
    ready = {m["id"]: m["available"] for m in await service.available_models()}
    if not ready.get(request.model):
        raise HTTPException(status_code=409, detail="Model is not installed")
    decoded = await resolve_user(authorization)
    uid = decoded["uid"] if decoded else None
    messages = [m.model_dump() for m in request.messages]
    user_text = messages[-1]["content"]
    user_texts = [m["content"] for m in messages if m["role"] == "user"]
    await enforce_access(decoded, http, x_anon_id, user_text)
    attachments = messages[-1].get("attachments") or []

    web_results = None
    web_failed = False
    sources_text = ""
    if request.search:
        found = await search.web_search(user_text)
        if found:
            web_results = found
            sources_text = "\n\n**Sources**\n" + "\n".join(f"- [{r['title'][:80]}]({r['href']})" for r in found)
        else:
            web_failed = True

    settings = None
    memories = None
    if uid:
        settings = await asyncio.to_thread(store.get_settings, uid)
        if settings["memory_enabled"]:
            saved = await asyncio.to_thread(store.list_memories, uid)
            memories = [m["content"] for m in saved[-MAX_MEMORY_ITEMS:]]

    async def event_stream():
        parts: list[str] = []
        meta = {"thinkingMs": None, "memoryUpdated": False}
        persisted = False

        def record() -> dict:
            return {"content": "".join(parts), **meta}

        try:
            async for event in service.stream_chat(
                messages=messages,
                mode=request.mode,
                max_new_tokens=request.max_new_tokens,
                temperature=request.temperature,
                top_p=request.top_p,
                top_k=request.top_k,
                settings=settings,
                memories=memories,
                model_key=request.model,
                web_results=web_results,
                web_failed=web_failed,
            ):
                if event["type"] == "token":
                    parts.append(event["content"])
                    yield sse(event)
                elif event["type"] == "trim":
                    joined = "".join(parts)
                    parts[:] = [joined[: len(joined) - event["remove"]]]
                    yield sse(event)
                else:
                    if sources_text:
                        parts.append(sources_text)
                        yield sse({"type": "token", "content": sources_text})
                    meta["thinkingMs"] = event["thinking_ms"]
                    yield sse(
                        {
                            "type": "done",
                            "thinking_ms": event["thinking_ms"],
                            "tokens_generated": event["eval_count"],
                            "tokens_read": event["prompt_eval_count"],
                        }
                    )

            if uid and settings["memory_enabled"]:
                found = await service.extract_memories(user_text)
                if found:
                    try:
                        added = await asyncio.to_thread(store.add_memories, uid, found)
                        if added:
                            meta["memoryUpdated"] = True
                            yield sse({"type": "memory_updated", "count": added})
                    except store.StorageError:
                        yield sse({"type": "storage_full"})

            if uid and "".join(parts).strip():
                persisted = True
                try:
                    await asyncio.to_thread(store.save_exchange, uid, request.chat_id, user_text, record(), attachments)
                except store.StorageFull:
                    yield sse({"type": "storage_full"})

            if decoded and not is_admin(decoded) and not await asyncio.to_thread(appeals.is_whitelisted, verified_email(decoded)):
                schedule_age_review(uid, str(decoded.get("email", "")), user_texts)

            yield "data: [DONE]\n\n"
        except Exception:
            logger.exception("Streaming failed")
            yield sse({"type": "error", "message": "Model request failed"})
        finally:
            if uid and not persisted and "".join(parts).strip():
                asyncio.get_running_loop().run_in_executor(
                    None, persist, uid, request.chat_id, user_text, record(), attachments
                )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@app.post("/api/title")
async def generate_title(request: TitleRequest, authorization: str | None = Header(default=None)):
    service = require_model()
    uid = await resolve_identity(authorization)

    try:
        title = await service.generate_title(request.message)
    except Exception:
        logger.exception("Title generation failed")
        return {"title": None}

    if title and uid and request.chat_id:
        try:
            await asyncio.to_thread(store.update_chat, uid, request.chat_id, title=title)
        except store.StorageError:
            pass

    return {"title": title or None}


@app.get("/api/chats")
async def get_chats(archived: bool = False, authorization: str | None = Header(default=None)):
    uid = await require_uid(authorization)
    return {"chats": await asyncio.to_thread(store.list_chats, uid, archived)}


@app.get("/api/chats/{chat_id}")
async def get_chat(chat_id: IdPath, authorization: str | None = Header(default=None)):
    uid = await require_uid(authorization)
    return {"messages": await asyncio.to_thread(store.get_chat_messages, uid, chat_id)}


@app.patch("/api/chats/{chat_id}")
async def patch_chat(chat_id: IdPath, body: ChatPatch, authorization: str | None = Header(default=None)):
    uid = await require_uid(authorization)
    try:
        await asyncio.to_thread(store.update_chat, uid, chat_id, body.title, body.archived)
    except store.ChatNotFound:
        raise HTTPException(status_code=404, detail="Chat not found")
    return {"ok": True}


@app.delete("/api/chats/{chat_id}")
async def remove_chat(chat_id: IdPath, authorization: str | None = Header(default=None)):
    uid = await require_uid(authorization)
    await asyncio.to_thread(store.delete_chat, uid, chat_id)
    return {"ok": True}


@app.delete("/api/chats")
async def remove_all_chats(authorization: str | None = Header(default=None)):
    uid = await require_uid(authorization)
    await asyncio.to_thread(store.delete_all_chats, uid)
    return {"ok": True}


@app.get("/api/settings")
async def get_settings(authorization: str | None = Header(default=None)):
    uid = await require_uid(authorization)
    return await asyncio.to_thread(store.get_settings, uid)


@app.put("/api/settings")
async def put_settings(body: SettingsUpdate, authorization: str | None = Header(default=None)):
    uid = await require_uid(authorization)
    patch = body.model_dump(exclude_none=True)
    for key in ("nickname", "instructions"):
        if key in patch:
            patch[key] = patch[key].strip()
    try:
        return await asyncio.to_thread(store.update_settings, uid, patch)
    except store.StorageFull:
        raise HTTPException(status_code=507, detail="Storage quota exceeded")


@app.get("/api/memories")
async def get_memories(authorization: str | None = Header(default=None)):
    uid = await require_uid(authorization)
    return {"memories": await asyncio.to_thread(store.list_memories, uid)}


@app.get("/api/memories/export")
async def export_memories(authorization: str | None = Header(default=None)):
    uid = await require_uid(authorization)
    return PlainTextResponse(await asyncio.to_thread(store.memories_text, uid))


@app.delete("/api/memories/{memory_id}")
async def remove_memory(memory_id: MemoryIdPath, authorization: str | None = Header(default=None)):
    uid = await require_uid(authorization)
    await asyncio.to_thread(store.delete_memory, uid, memory_id)
    return {"ok": True}


@app.delete("/api/memories")
async def remove_all_memories(authorization: str | None = Header(default=None)):
    uid = await require_uid(authorization)
    await asyncio.to_thread(store.clear_memories, uid)
    return {"ok": True}


@app.get("/api/storage")
async def get_storage(authorization: str | None = Header(default=None)):
    uid = await require_uid(authorization)
    return {"used": await asyncio.to_thread(store.usage_bytes, uid), "quota": USER_QUOTA_BYTES}


@app.get("/api/me/admin")
async def me_admin(authorization: str | None = Header(default=None)):
    return {"admin": await decode_admin(authorization) is not None}


@app.put("/api/files/extract")
async def extract_file(
    request: Request,
    authorization: str | None = Header(default=None),
    x_filename: str | None = Header(default=None),
):
    decoded = await resolve_user(authorization)
    if decoded is None:
        raise HTTPException(status_code=401, detail="Login required")
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > fileio.MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail={"code": "too_large"})
    data = await request.body()
    if len(data) > fileio.MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail={"code": "too_large"})
    name = unquote(x_filename or "file")[:120]
    try:
        text, truncated = await asyncio.to_thread(fileio.extract_text, name, data)
    except fileio.FileError as exc:
        raise HTTPException(status_code=exc.status, detail={"code": exc.code}) from exc
    return {"name": name, "text": text, "truncated": truncated}


@app.post("/api/feedback")
async def post_feedback(payload: FeedbackRequest, authorization: str | None = Header(default=None)):
    uid = await require_uid(authorization)
    await asyncio.to_thread(
        feedback.set_feedback,
        uid,
        payload.chat_id,
        payload.message_index,
        payload.rating,
        payload.reason,
        payload.prompt,
        payload.response,
        payload.mode,
    )
    return {"ok": True}


@app.get("/api/admin/feedback/stats")
async def admin_feedback_stats(authorization: str | None = Header(default=None)):
    await require_admin(authorization)
    return await asyncio.to_thread(feedback.stats)


@app.get("/api/admin/feedback/export")
async def admin_feedback_export(authorization: str | None = Header(default=None)):
    await require_admin(authorization)
    body = await asyncio.to_thread(feedback.export_jsonl)
    return PlainTextResponse(
        body,
        media_type="application/x-ndjson",
        headers={"Content-Disposition": 'attachment; filename="flare-feedback.jsonl"'},
    )


@app.get("/api/me/status")
async def me_status(authorization: str | None = Header(default=None)):
    decoded = await resolve_user(authorization)
    if decoded is None:
        raise HTTPException(status_code=401, detail="Login required")
    if is_admin(decoded):
        return {"age_confirmed": True, "suspended": False}
    return await asyncio.to_thread(usage.get_account, decoded["uid"])


@app.post("/api/me/age-confirm")
async def me_age_confirm(authorization: str | None = Header(default=None)):
    decoded = await resolve_user(authorization)
    if decoded is None:
        raise HTTPException(status_code=401, detail="Login required")
    account = await asyncio.to_thread(usage.get_account, decoded["uid"])
    if account["suspended"]:
        raise HTTPException(status_code=403, detail={"code": "suspended"})
    await asyncio.to_thread(usage.confirm_age, decoded["uid"], str(decoded.get("email", "")))
    return {"age_confirmed": True, "suspended": False}


@app.get("/api/admin/suspended")
async def admin_suspended(authorization: str | None = Header(default=None)):
    await require_admin(authorization)
    return {"users": await asyncio.to_thread(usage.list_suspended)}


@app.post("/api/admin/unsuspend/{uid}")
async def admin_unsuspend(uid: IdPath, authorization: str | None = Header(default=None)):
    await require_admin(authorization)
    await asyncio.to_thread(usage.unsuspend, uid)
    return {"ok": True}


@app.get("/api/admin/age-reviews")
async def admin_age_reviews(authorization: str | None = Header(default=None)):
    await require_admin(authorization)
    return {"cases": await asyncio.to_thread(age_review.list_pending)}


@app.post("/api/admin/age-reviews/{case_id}/{action}")
async def admin_age_review_resolve(case_id: int, action: str, authorization: str | None = Header(default=None)):
    await require_admin(authorization)
    if action not in ("freeze", "dismiss"):
        raise HTTPException(status_code=404, detail="Not found")
    done = await asyncio.to_thread(age_review.resolve, case_id, action == "freeze")
    if not done:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"ok": True}


@app.post("/api/me/appeal")
async def me_appeal(body: AppealRequest, authorization: str | None = Header(default=None)):
    decoded = await resolve_user(authorization)
    if decoded is None:
        raise HTTPException(status_code=401, detail="Login required")
    account = await asyncio.to_thread(usage.get_account, decoded["uid"])
    if not account["suspended"]:
        raise HTTPException(status_code=409, detail="Account is not suspended")
    ok = await asyncio.to_thread(appeals.submit, decoded["uid"], str(decoded.get("email", "")), body)
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid form")
    return {"ok": True}


@app.get("/api/admin/appeals")
async def admin_appeals(authorization: str | None = Header(default=None)):
    await require_admin(authorization)
    return {"appeals": await asyncio.to_thread(appeals.list_pending)}


@app.post("/api/admin/appeals/{appeal_id}/{action}")
async def admin_appeal_resolve(appeal_id: int, action: str, authorization: str | None = Header(default=None)):
    await require_admin(authorization)
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=404, detail="Not found")
    done = await asyncio.to_thread(appeals.resolve, appeal_id, action == "approve")
    if not done:
        raise HTTPException(status_code=404, detail="Appeal not found")
    return {"ok": True}


@app.get("/api/updates")
async def get_updates():
    return {"updates": await asyncio.to_thread(updates.list_updates)}


@app.get("/api/updates/media/{name}")
async def get_update_media(name: str):
    path = updates.media_path(name)
    if path is None:
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(
        path,
        media_type=updates.media_type(name),
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=86400"},
    )


@app.post("/api/admin/updates")
async def create_update(payload: UpdateCreate, authorization: str | None = Header(default=None)):
    await require_admin(authorization)
    try:
        return await asyncio.to_thread(updates.create_update, payload.title, payload.body, payload.media)
    except updates.MediaError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc)) from exc


@app.delete("/api/admin/updates/{update_id}")
async def delete_update(
    update_id: Annotated[str, Path(pattern=r"^[a-f0-9]{32}$")],
    authorization: str | None = Header(default=None),
):
    await require_admin(authorization)
    if not await asyncio.to_thread(updates.delete_update, update_id):
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@app.put("/api/admin/media")
async def upload_media(request: Request, authorization: str | None = Header(default=None)):
    await require_admin(authorization)
    if int(request.headers.get("content-length") or 0) > MAX_UPDATE_MEDIA_BYTES:
        raise HTTPException(status_code=413, detail="File too large")
    try:
        name = await updates.save_media(request.stream())
    except updates.MediaError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc)) from exc
    return {"name": name}


@app.get("/api/models")
async def get_models():
    return {"models": await require_model().available_models()}


@app.get("/api/health")
async def health():
    if model_service is None:
        return JSONResponse(status_code=503, content={"status": "starting", "model_loaded": False})

    ok = await model_service.health()
    return {"status": "ok" if ok else "degraded", "model_loaded": ok, "model": model_service.model}


DIST_DIR = pathlib.Path(__file__).resolve().parent.parent / "web" / "dist"

if (DIST_DIR / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = (DIST_DIR / full_path).resolve()
        if full_path and candidate.is_file() and DIST_DIR.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(DIST_DIR / "index.html")