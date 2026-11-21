from __future__ import annotations

import asyncio
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Path
from pydantic import BaseModel, Field

from backend import admin_service as svc

UidPath = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,128}$")]


class CommandBody(BaseModel):
    command: str = Field(max_length=200)


class AuthorBody(BaseModel):
    email: str = Field(max_length=254)


def build_router(require_admin, require_owner) -> APIRouter:
    router = APIRouter(prefix="/api/admin")

    @router.get("/metrics")
    async def metrics(authorization: str | None = Header(default=None)):
        await require_admin(authorization)
        return await asyncio.to_thread(svc.metrics)

    @router.get("/running-models")
    async def running_models(authorization: str | None = Header(default=None)):
        await require_admin(authorization)
        return {"models": await svc.running_models()}

    @router.post("/command")
    async def command(body: CommandBody, authorization: str | None = Header(default=None)):
        await require_owner(authorization)
        return {"output": await svc.run_command(body.command)}

    @router.get("/authors")
    async def authors(authorization: str | None = Header(default=None)):
        await require_owner(authorization)
        return {"authors": await asyncio.to_thread(svc.list_authors)}

    @router.post("/authors")
    async def add_author(body: AuthorBody, authorization: str | None = Header(default=None)):
        owner = await require_owner(authorization)
        if not await asyncio.to_thread(svc.add_author, body.email, owner):
            raise HTTPException(status_code=400, detail="Invalid email")
        return {"ok": True}

    @router.delete("/authors")
    async def remove_author(body: AuthorBody, authorization: str | None = Header(default=None)):
        await require_owner(authorization)
        await asyncio.to_thread(svc.remove_author, body.email)
        return {"ok": True}

    @router.get("/accounts")
    async def accounts(authorization: str | None = Header(default=None)):
        await require_admin(authorization)
        return {"accounts": await asyncio.to_thread(svc.list_accounts)}

    @router.post("/accounts/{uid}/{action}")
    async def account_action(uid: UidPath, action: str, authorization: str | None = Header(default=None)):
        await require_admin(authorization)
        if not await asyncio.to_thread(svc.account_action, uid, action):
            raise HTTPException(status_code=404, detail="Unknown action")
        return {"ok": True}

    @router.get("/feedback/overview")
    async def feedback_overview(authorization: str | None = Header(default=None)):
        await require_admin(authorization)
        return await asyncio.to_thread(svc.feedback_overview)

    return router
