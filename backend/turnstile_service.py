import asyncio
import json
import os
import urllib.parse
import urllib.request

from fastapi import APIRouter, HTTPException, Request

from backend.abuse_guard import client_ip

SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

router = APIRouter()


def _siteverify(token: str, ip: str) -> bool:
    data = urllib.parse.urlencode(
        {
            "secret": os.environ.get("TURNSTILE_SECRET_KEY", ""),
            "response": token,
            "remoteip": ip,
        }
    ).encode()
    req = urllib.request.Request(
        SITEVERIFY_URL,
        data=data,
        method="POST",
        headers={"User-Agent": "FlareAI/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            return bool(json.loads(resp.read().decode()).get("success"))
    except Exception:
        return False


@router.post("/api/turnstile/verify")
async def verify(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    token = str(body.get("token", ""))
    if not token or not os.environ.get("TURNSTILE_SECRET_KEY"):
        raise HTTPException(status_code=400, detail="invalid_request")
    ok = await asyncio.to_thread(_siteverify, token, client_ip(request))
    if not ok:
        raise HTTPException(status_code=403, detail="turnstile_failed")
    return {"ok": True}
