import time
from collections import defaultdict, deque

from fastapi import Request
from fastapi.responses import JSONResponse

IP_WINDOW = 10
IP_LIMIT = 60
IP_BLOCK = 300
USER_WINDOW = 10
USER_LIMIT = 6
USER_BLOCK = 180

_ip_hits = defaultdict(deque)
_ip_blocked = {}
_user_hits = defaultdict(deque)
_user_blocked = {}


def client_ip(request: Request) -> str:
    h = request.headers.get("cf-connecting-ip")
    if h:
        return h
    return request.client.host if request.client else "unknown"


def _purge(store: dict, now: float) -> None:
    if len(store) > 10000:
        for k in [k for k, v in store.items() if v <= now]:
            store.pop(k, None)


async def abuse_guard(request: Request, call_next):
    if not request.url.path.startswith("/api"):
        return await call_next(request)
    ip = client_ip(request)
    now = time.time()
    _purge(_ip_blocked, now)
    until = _ip_blocked.get(ip, 0)
    if until > now:
        return JSONResponse(
            {"detail": "Too many requests"},
            status_code=429,
            headers={"Retry-After": str(int(until - now))},
        )
    q = _ip_hits[ip]
    while q and q[0] < now - IP_WINDOW:
        q.popleft()
    q.append(now)
    if len(q) > IP_LIMIT:
        _ip_blocked[ip] = now + IP_BLOCK
        q.clear()
        return JSONResponse(
            {"detail": "Too many requests"},
            status_code=429,
            headers={"Retry-After": str(IP_BLOCK)},
        )
    return await call_next(request)


def user_blocked_seconds(uid: str) -> int:
    now = time.time()
    _purge(_user_blocked, now)
    until = _user_blocked.get(uid, 0)
    if until > now:
        return int(until - now)
    q = _user_hits[uid]
    while q and q[0] < now - USER_WINDOW:
        q.popleft()
    q.append(now)
    if len(q) > USER_LIMIT:
        _user_blocked[uid] = now + USER_BLOCK
        q.clear()
        return USER_BLOCK
    return 0
