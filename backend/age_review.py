from __future__ import annotations

import json
import time

from backend import usage_service as usage

DISMISS_COOLDOWN_SECONDS = 7 * 24 * 3600


def _ensure(db) -> None:
    db.execute(
        "CREATE TABLE IF NOT EXISTS age_reviews ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', "
        "status TEXT NOT NULL DEFAULT 'pending', reason TEXT NOT NULL DEFAULT '', "
        "messages TEXT NOT NULL DEFAULT '[]', created_at INTEGER NOT NULL, resolved_at INTEGER)"
    )


def flag(uid: str, email: str, reason: str, messages: list[str]) -> bool:
    if usage.get_account(uid)["suspended"]:
        return False
    now = int(time.time())
    payload = json.dumps([m[:500] for m in messages[-5:]], ensure_ascii=False)

    def op(db):
        _ensure(db)
        if db.execute("SELECT 1 FROM age_reviews WHERE uid = ? AND status = 'pending'", (uid,)).fetchone():
            return False
        if db.execute(
            "SELECT 1 FROM age_reviews WHERE uid = ? AND status = 'dismissed' AND resolved_at > ?",
            (uid, now - DISMISS_COOLDOWN_SECONDS),
        ).fetchone():
            return False
        db.execute(
            "INSERT INTO age_reviews (uid, email, reason, messages, created_at) VALUES (?, ?, ?, ?, ?)",
            (uid, email, reason[:300], payload, now),
        )
        return True

    return usage.with_db(op)


def list_pending() -> list[dict]:
    def op(db):
        _ensure(db)
        return db.execute(
            "SELECT id, uid, email, reason, messages, created_at FROM age_reviews "
            "WHERE status = 'pending' ORDER BY created_at DESC"
        ).fetchall()

    rows = usage.with_db(op)
    return [
        {"id": r[0], "uid": r[1], "email": r[2], "reason": r[3], "messages": json.loads(r[4]), "created_at": r[5]}
        for r in rows
    ]


def resolve(case_id: int, freeze: bool) -> bool:
    def op(db):
        _ensure(db)
        row = db.execute("SELECT uid, email FROM age_reviews WHERE id = ? AND status = 'pending'", (case_id,)).fetchone()
        if row is None:
            return None
        db.execute(
            "UPDATE age_reviews SET status = ?, resolved_at = ? WHERE id = ?",
            ("frozen" if freeze else "dismissed", int(time.time()), case_id),
        )
        return row

    row = usage.with_db(op)
    if row is None:
        return False
    if freeze:
        usage.suspend(row[0], row[1], "admin-confirmed under-age")
    return True
