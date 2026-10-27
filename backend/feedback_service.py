from __future__ import annotations

import json
import time

from backend.usage_service import with_db


def _ensure(db) -> None:
    db.execute(
        "CREATE TABLE IF NOT EXISTS feedback ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT NOT NULL, chat_id TEXT NOT NULL, "
        "msg_index INTEGER NOT NULL, rating TEXT NOT NULL, reason TEXT, prompt TEXT NOT NULL, "
        "response TEXT NOT NULL, mode TEXT NOT NULL, created INTEGER NOT NULL, "
        "UNIQUE (uid, chat_id, msg_index))"
    )


def set_feedback(
    uid: str,
    chat_id: str,
    msg_index: int,
    rating: str,
    reason: str | None,
    prompt: str,
    response: str,
    mode: str,
) -> None:
    now = int(time.time())

    def run(db):
        _ensure(db)
        if rating == "none":
            db.execute(
                "DELETE FROM feedback WHERE uid = ? AND chat_id = ? AND msg_index = ?",
                (uid, chat_id, msg_index),
            )
            return
        db.execute(
            "INSERT INTO feedback (uid, chat_id, msg_index, rating, reason, prompt, response, mode, created) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(uid, chat_id, msg_index) DO UPDATE SET rating = excluded.rating, "
            "reason = excluded.reason, prompt = excluded.prompt, response = excluded.response, "
            "mode = excluded.mode, created = excluded.created",
            (uid, chat_id, msg_index, rating, reason, prompt, response, mode, now),
        )

    with_db(run)


def stats() -> dict:
    def run(db):
        _ensure(db)
        rows = db.execute("SELECT rating, COUNT(*) FROM feedback GROUP BY rating").fetchall()
        return {rating: count for rating, count in rows}

    counts = with_db(run)
    return {"up": counts.get("up", 0), "down": counts.get("down", 0)}


def export_jsonl() -> str:
    def run(db):
        _ensure(db)
        return db.execute(
            "SELECT prompt, response, rating, reason, mode, created FROM feedback ORDER BY created"
        ).fetchall()

    lines = []
    for prompt, response, rating, reason, mode, created in with_db(run):
        lines.append(
            json.dumps(
                {
                    "prompt": prompt,
                    "response": response,
                    "rating": rating,
                    "reason": reason,
                    "mode": mode,
                    "created": created,
                },
                ensure_ascii=False,
            )
        )
    return "\n".join(lines) + ("\n" if lines else "")
