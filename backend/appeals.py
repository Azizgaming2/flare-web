from __future__ import annotations

import time

from pydantic import BaseModel, Field

from backend import usage_service as usage


class AppealRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=60)
    last_name: str = Field(min_length=1, max_length=60)
    class_name: str = Field(min_length=1, max_length=20)


def _ensure(db) -> None:
    db.execute(
        "CREATE TABLE IF NOT EXISTS age_appeals ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', "
        "first_name TEXT NOT NULL, last_name TEXT NOT NULL, class_name TEXT NOT NULL, "
        "status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL, resolved_at INTEGER)"
    )
    db.execute("CREATE TABLE IF NOT EXISTS age_whitelist (email TEXT PRIMARY KEY, added_at INTEGER NOT NULL)")


def submit(uid: str, email: str, data: AppealRequest) -> bool:
    first, last, cls = data.first_name.strip(), data.last_name.strip(), data.class_name.strip()
    if not (first and last and cls):
        return False
    now = int(time.time())

    def op(db):
        _ensure(db)
        row = db.execute("SELECT id FROM age_appeals WHERE uid = ? AND status = 'pending'", (uid,)).fetchone()
        if row:
            db.execute(
                "UPDATE age_appeals SET first_name = ?, last_name = ?, class_name = ?, created_at = ? WHERE id = ?",
                (first, last, cls, now, row[0]),
            )
        else:
            db.execute(
                "INSERT INTO age_appeals (uid, email, first_name, last_name, class_name, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (uid, email, first, last, cls, now),
            )
        return True

    return usage.with_db(op)


def list_pending() -> list[dict]:
    def op(db):
        _ensure(db)
        return db.execute(
            "SELECT id, email, first_name, last_name, class_name, created_at FROM age_appeals "
            "WHERE status = 'pending' ORDER BY created_at DESC"
        ).fetchall()

    return [
        {"id": r[0], "email": r[1], "first_name": r[2], "last_name": r[3], "class_name": r[4], "created_at": r[5]}
        for r in usage.with_db(op)
    ]


def resolve(appeal_id: int, approve: bool) -> bool:
    now = int(time.time())

    def op(db):
        _ensure(db)
        row = db.execute("SELECT uid, email FROM age_appeals WHERE id = ? AND status = 'pending'", (appeal_id,)).fetchone()
        if row is None:
            return None
        db.execute(
            "UPDATE age_appeals SET status = ?, resolved_at = ? WHERE id = ?",
            ("approved" if approve else "rejected", now, appeal_id),
        )
        if approve and row[1]:
            db.execute("INSERT OR REPLACE INTO age_whitelist (email, added_at) VALUES (?, ?)", (row[1].lower(), now))
        return row

    row = usage.with_db(op)
    if row is None:
        return False
    if approve:
        usage.unsuspend(row[0])
    return True


def is_whitelisted(email: str) -> bool:
    if not email:
        return False

    def op(db):
        _ensure(db)
        return db.execute("SELECT 1 FROM age_whitelist WHERE email = ?", (email.lower(),)).fetchone() is not None

    return usage.with_db(op)
