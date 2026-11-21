from __future__ import annotations

import os
import platform
import shutil
import subprocess
import threading
import time

import httpx
from firebase_admin import auth as firebase_auth

from backend import feedback_service as feedback
from backend import storage_service as store
from backend import usage_service as usage
from backend.config import ADMIN_EMAILS, OLLAMA_BASE_URL

try:
    import psutil
except ImportError:
    psutil = None

BAN_REASON = "banned by admin"
STARTED = time.time()
_lock = threading.Lock()
_sample: dict = {"at": 0.0, "data": {}}
_temp_cache: dict = {"at": 0.0, "value": None}
_model_seen: dict[str, float] = {}


def _num(value: str) -> float | None:
    try:
        return float(value)
    except ValueError:
        return None


def _gpu() -> dict | None:
    if not shutil.which("nvidia-smi"):
        return None
    try:
        line = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True,
            text=True,
            timeout=3,
        ).stdout.strip().splitlines()[0]
        name, util, used, total, temp = [part.strip() for part in line.split(",")]
        return {
            "name": name,
            "util": _num(util),
            "mem_used": _num(used),
            "mem_total": _num(total),
            "temp": _num(temp),
        }
    except Exception:
        return None


def _windows_temp() -> float | None:
    try:
        out = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "(Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature "
                "| Select-Object -First 1).CurrentTemperature",
            ],
            capture_output=True,
            text=True,
            timeout=4,
        ).stdout.strip()
        return round(float(out) / 10 - 273.15, 1)
    except Exception:
        return None


def _cpu_temp() -> float | None:
    now = time.time()
    if now - _temp_cache["at"] < 15:
        return _temp_cache["value"]
    value = None
    if psutil is not None and hasattr(psutil, "sensors_temperatures"):
        try:
            for entries in psutil.sensors_temperatures().values():
                for entry in entries:
                    if entry.current:
                        value = float(entry.current)
                        break
                if value is not None:
                    break
        except Exception:
            value = None
    if value is None and os.name == "nt":
        value = _windows_temp()
    _temp_cache.update(at=now, value=value)
    return value


def metrics() -> dict:
    now = time.time()
    with _lock:
        if _sample["data"] and now - _sample["at"] < 1.5:
            return _sample["data"]
        cpu = {"util": None, "cores": os.cpu_count(), "temp": _cpu_temp()}
        ram = None
        host_uptime = None
        if psutil is not None:
            cpu["util"] = psutil.cpu_percent(interval=None)
            memory = psutil.virtual_memory()
            ram = {"used": memory.used, "total": memory.total, "percent": memory.percent}
            host_uptime = int(now - psutil.boot_time())
        data = {
            "time": int(now),
            "host": platform.node(),
            "system": f"{platform.system()} {platform.release()}",
            "cpu_name": platform.processor(),
            "api_uptime": int(now - STARTED),
            "host_uptime": host_uptime,
            "psutil": psutil is not None,
            "cpu": cpu,
            "ram": ram,
            "gpu": _gpu(),
        }
        _sample.update(at=now, data=data)
        return data


async def running_models() -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/ps")
            items = response.json().get("models", [])
    except Exception:
        items = []
    now = time.time()
    names = {item.get("name", "") for item in items}
    for name in list(_model_seen):
        if name not in names:
            del _model_seen[name]
    result = []
    for item in items:
        name = item.get("name", "")
        first = _model_seen.setdefault(name, now)
        result.append(
            {
                "name": name,
                "size": item.get("size", 0),
                "vram": item.get("size_vram", 0),
                "uptime": int(now - first),
                "expires_at": item.get("expires_at"),
            }
        )
    return result


HELP = {
    "/help": "List all commands",
    "/status": "CPU, RAM and GPU summary",
    "/models": "Models running in Ollama",
    "/users": "Account counts",
}


async def run_command(text: str) -> str:
    command = text.strip().split()[0].lower() if text.strip() else ""
    if command == "/help":
        return "\n".join(f"{name}  -  {description}" for name, description in HELP.items())
    if command == "/status":
        data = metrics()
        gpu = data["gpu"]
        lines = [
            f"Host: {data['host']} ({data['system']})",
            f"CPU: {data['cpu']['util']}%  temp: {data['cpu']['temp']}",
            f"RAM: {data['ram']['percent']}%" if data["ram"] else "RAM: psutil not installed",
            f"GPU: {gpu['name']} {gpu['util']}% {gpu['temp']}C" if gpu else "GPU: not detected",
            f"API uptime: {data['api_uptime']}s",
        ]
        return "\n".join(lines)
    if command == "/models":
        models = await running_models()
        if not models:
            return "No model is loaded."
        return "\n".join(f"{item['name']}  uptime {item['uptime']}s" for item in models)
    if command == "/users":
        accounts = list_accounts(100000)
        frozen = sum(1 for item in accounts if item["status"] != "active")
        return f"Accounts: {len(accounts)}  restricted: {frozen}"
    return "Unknown command. Type /help"


def _authors_ensure(db) -> None:
    db.execute(
        "CREATE TABLE IF NOT EXISTS authors ("
        "email TEXT PRIMARY KEY, added_by TEXT NOT NULL DEFAULT '', added_at INTEGER NOT NULL)"
    )


def is_author(email: str) -> bool:
    email = email.strip().lower()
    if not email:
        return False

    def op(db):
        _authors_ensure(db)
        return db.execute("SELECT 1 FROM authors WHERE email = ?", (email,)).fetchone() is not None

    return usage.with_db(op)


def list_authors() -> list[dict]:
    def op(db):
        _authors_ensure(db)
        return db.execute("SELECT email, added_by, added_at FROM authors ORDER BY added_at DESC").fetchall()

    rows = usage.with_db(op)
    owners = [{"email": email, "role": "owner", "added_by": "", "added_at": None} for email in ADMIN_EMAILS]
    return owners + [{"email": r[0], "role": "author", "added_by": r[1], "added_at": r[2]} for r in rows]


def add_author(email: str, added_by: str) -> bool:
    email = email.strip().lower()
    if "@" not in email or len(email) > 254 or email in ADMIN_EMAILS:
        return False

    def op(db):
        _authors_ensure(db)
        db.execute(
            "INSERT OR IGNORE INTO authors (email, added_by, added_at) VALUES (?, ?, ?)",
            (email, added_by, int(time.time())),
        )

    usage.with_db(op)
    return True


def remove_author(email: str) -> None:
    def op(db):
        _authors_ensure(db)
        db.execute("DELETE FROM authors WHERE email = ?", (email.strip().lower(),))

    usage.with_db(op)


def list_accounts(limit: int = 500) -> list[dict]:
    def op(db):
        return db.execute(
            "SELECT uid, email, age_confirmed, age_confirmed_at, suspended, suspend_reason, suspended_at "
            "FROM accounts ORDER BY COALESCE(age_confirmed_at, suspended_at, 0) DESC LIMIT ?",
            (limit,),
        ).fetchall()

    result = []
    for r in usage.with_db(op):
        status = "active"
        if r[4]:
            status = "banned" if r[5] == BAN_REASON else "frozen"
        result.append(
            {
                "uid": r[0],
                "email": r[1],
                "age_confirmed": bool(r[2]),
                "joined_at": r[3],
                "status": status,
                "reason": r[5],
                "suspended_at": r[6],
            }
        )
    return result


def _email_of(uid: str) -> str:
    def op(db):
        row = db.execute("SELECT email FROM accounts WHERE uid = ?", (uid,)).fetchone()
        return row[0] if row else ""

    return usage.with_db(op)


def _firebase_disabled(uid: str, disabled: bool) -> None:
    try:
        firebase_auth.update_user(uid, disabled=disabled)
        if disabled:
            firebase_auth.revoke_refresh_tokens(uid)
    except Exception:
        pass


def account_action(uid: str, action: str) -> bool:
    if action == "freeze":
        usage.suspend(uid, _email_of(uid), "frozen by admin")
    elif action == "ban":
        usage.suspend(uid, _email_of(uid), BAN_REASON)
        _firebase_disabled(uid, True)
    elif action in ("unfreeze", "unban"):
        usage.unsuspend(uid)
        _firebase_disabled(uid, False)
    elif action == "delete-data":
        store.delete_all_chats(uid)
        store.clear_memories(uid)
    else:
        return False
    return True


def feedback_overview(limit: int = 200) -> dict:
    def op(db):
        feedback._ensure(db)
        rows = db.execute(
            "SELECT rating, reason, prompt, response, mode, created FROM feedback ORDER BY created DESC LIMIT ?",
            (limit,),
        ).fetchall()
        reasons = db.execute(
            "SELECT COALESCE(NULLIF(reason, ''), '-'), COUNT(*) FROM feedback WHERE rating = 'down' "
            "GROUP BY 1 ORDER BY 2 DESC LIMIT 12"
        ).fetchall()
        return rows, reasons

    rows, reasons = usage.with_db(op)
    return {
        "stats": feedback.stats(),
        "reasons": [{"reason": r[0], "count": r[1]} for r in reasons],
        "items": [
            {
                "rating": r[0],
                "reason": r[1] or "",
                "prompt": r[2][:400],
                "response": r[3][:400],
                "mode": r[4],
                "created": r[5],
            }
            for r in rows
        ],
    }
