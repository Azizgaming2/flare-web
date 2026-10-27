from __future__ import annotations

import hashlib
import re
import sqlite3
import threading
import time

from backend.config import STORAGE_ROOT

DB_PATH = STORAGE_ROOT / "flare.db"
_ANON_ID = re.compile(r"^[A-Za-z0-9-]{8,64}$")
_lock = threading.Lock()
_conn: sqlite3.Connection | None = None


def _db() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
        _conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        _conn.execute("PRAGMA journal_mode=WAL")
        _conn.execute("CREATE TABLE IF NOT EXISTS user_usage (uid TEXT NOT NULL, ts INTEGER NOT NULL)")
        _conn.execute("CREATE INDEX IF NOT EXISTS idx_user_usage ON user_usage (uid, ts)")
        _conn.execute(
            "CREATE TABLE IF NOT EXISTS anon_devices "
            "(device TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, first_ts INTEGER NOT NULL)"
        )
        _conn.execute(
            "CREATE TABLE IF NOT EXISTS anon_ips "
            "(ip TEXT NOT NULL, day INTEGER NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (ip, day))"
        )
        _conn.execute(
            "CREATE TABLE IF NOT EXISTS accounts ("
            "uid TEXT PRIMARY KEY, email TEXT NOT NULL DEFAULT '', "
            "age_confirmed INTEGER NOT NULL DEFAULT 0, age_confirmed_at INTEGER, "
            "suspended INTEGER NOT NULL DEFAULT 0, suspend_reason TEXT, suspended_at INTEGER)"
        )
        _conn.commit()
    return _conn


def with_db(fn):
    with _lock:
        db = _db()
        result = fn(db)
        db.commit()
        return result


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()[:24]


def consume_user(uid: str, limit: int, window_seconds: int) -> tuple[bool, int]:
    now = int(time.time())
    with _lock:
        db = _db()
        db.execute("DELETE FROM user_usage WHERE uid = ? AND ts <= ?", (uid, now - window_seconds))
        rows = db.execute("SELECT ts FROM user_usage WHERE uid = ? ORDER BY ts", (uid,)).fetchall()
        if len(rows) >= limit:
            retry_after = rows[-limit][0] + window_seconds - now
            db.commit()
            return False, max(retry_after, 1)
        db.execute("INSERT INTO user_usage (uid, ts) VALUES (?, ?)", (uid, now))
        db.commit()
        return True, 0


def consume_anon(anon_id: str | None, ip: str, device_limit: int, ip_daily_limit: int) -> bool:
    now = int(time.time())
    day = now // 86400
    device = _hash(anon_id) if anon_id and _ANON_ID.match(anon_id) else "ip-" + _hash(ip)
    ip_key = _hash(ip)
    with _lock:
        db = _db()
        db.execute("DELETE FROM anon_ips WHERE day < ?", (day,))
        ip_row = db.execute("SELECT count FROM anon_ips WHERE ip = ? AND day = ?", (ip_key, day)).fetchone()
        if ip_row and ip_row[0] >= ip_daily_limit:
            db.commit()
            return False
        dev_row = db.execute("SELECT count FROM anon_devices WHERE device = ?", (device,)).fetchone()
        if dev_row and dev_row[0] >= device_limit:
            db.commit()
            return False
        db.execute(
            "INSERT INTO anon_devices (device, count, first_ts) VALUES (?, 1, ?) "
            "ON CONFLICT(device) DO UPDATE SET count = count + 1",
            (device, now),
        )
        db.execute(
            "INSERT INTO anon_ips (ip, day, count) VALUES (?, ?, 1) "
            "ON CONFLICT(ip, day) DO UPDATE SET count = count + 1",
            (ip_key, day),
        )
        db.commit()
        return True


def get_account(uid: str) -> dict:
    with _lock:
        row = _db().execute("SELECT age_confirmed, suspended FROM accounts WHERE uid = ?", (uid,)).fetchone()
    if row is None:
        return {"age_confirmed": False, "suspended": False}
    return {"age_confirmed": bool(row[0]), "suspended": bool(row[1])}


def confirm_age(uid: str, email: str) -> None:
    now = int(time.time())
    with _lock:
        db = _db()
        db.execute(
            "INSERT INTO accounts (uid, email, age_confirmed, age_confirmed_at) VALUES (?, ?, 1, ?) "
            "ON CONFLICT(uid) DO UPDATE SET age_confirmed = 1, age_confirmed_at = ?, email = ?",
            (uid, email, now, now, email),
        )
        db.commit()


def suspend(uid: str, email: str, reason: str) -> None:
    now = int(time.time())
    with _lock:
        db = _db()
        db.execute(
            "INSERT INTO accounts (uid, email, age_confirmed, suspended, suspend_reason, suspended_at) "
            "VALUES (?, ?, 1, 1, ?, ?) "
            "ON CONFLICT(uid) DO UPDATE SET suspended = 1, suspend_reason = ?, suspended_at = ?, email = ?",
            (uid, email, reason, now, reason, now, email),
        )
        db.commit()


def unsuspend(uid: str) -> None:
    with _lock:
        db = _db()
        db.execute(
            "UPDATE accounts SET suspended = 0, suspend_reason = NULL, age_confirmed = 1 WHERE uid = ?",
            (uid,),
        )
        db.commit()


def list_suspended() -> list[dict]:
    with _lock:
        rows = _db().execute(
            "SELECT uid, email, suspend_reason, suspended_at FROM accounts WHERE suspended = 1 "
            "ORDER BY suspended_at DESC"
        ).fetchall()
    return [{"uid": r[0], "email": r[1], "reason": r[2], "suspended_at": r[3]} for r in rows]
