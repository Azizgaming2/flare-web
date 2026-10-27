from __future__ import annotations

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials

from backend.config import FIREBASE_CREDENTIALS

_initialized = False


def init_firebase() -> None:
    global _initialized
    if _initialized:
        return

    firebase_admin.initialize_app(credentials.Certificate(FIREBASE_CREDENTIALS))
    _initialized = True


def verify_token(id_token: str) -> dict:
    return firebase_auth.verify_id_token(id_token)
