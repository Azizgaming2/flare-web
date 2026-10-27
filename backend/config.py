import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

BASE_DIR = Path(__file__).resolve().parent

if load_dotenv is not None:
    load_dotenv(BASE_DIR / ".env")

OLLAMA_BASE_URL = os.environ.get(
    "FLARE_OLLAMA_URL",
    "http://127.0.0.1:11434",
).rstrip("/")

TENTIUM_MODEL = os.environ.get(
    "FLARE_TENTIUM_MODEL",
    "flare-tentium",
)

OLLAMA_MODEL = TENTIUM_MODEL

MODELS = {
    "tentium": {"name": "Flare Tentium 2.5", "ollama": TENTIUM_MODEL, "thinking": False},
}

CORS_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.environ.get(
        "FLARE_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

MAX_CONTEXT_MESSAGES = int(
    os.environ.get("FLARE_MAX_CONTEXT_MESSAGES", "40")
)

MAX_MEMORY_ITEMS = int(
    os.environ.get("FLARE_MAX_MEMORY_ITEMS", "30")
)

DEFAULT_MAX_NEW_TOKENS = int(
    os.environ.get("FLARE_MAX_NEW_TOKENS", "2048")
)

FAST_MAX_NEW_TOKENS = int(
    os.environ.get("FLARE_FAST_MAX_NEW_TOKENS", "1024")
)

DEEPTHINK_MAX_NEW_TOKENS = int(
    os.environ.get("FLARE_DEEPTHINK_MAX_NEW_TOKENS", "6144")
)

DEFAULT_TEMPERATURE = float(
    os.environ.get("FLARE_TEMPERATURE", "0.7")
)

DEFAULT_TOP_P = float(
    os.environ.get("FLARE_TOP_P", "0.8")
)

DEFAULT_TOP_K = int(
    os.environ.get("FLARE_TOP_K", "20")
)

DEFAULT_REPEAT_PENALTY = float(
    os.environ.get("FLARE_REPEAT_PENALTY", "1.1")
)

DEFAULT_REPEAT_LAST_N = int(
    os.environ.get("FLARE_REPEAT_LAST_N", "256")
)

DEFAULT_PRESENCE_PENALTY = float(
    os.environ.get("FLARE_PRESENCE_PENALTY", "0.5")
)

DEEPTHINK_TEMPERATURE = float(
    os.environ.get("FLARE_DEEPTHINK_TEMPERATURE", "0.6")
)

DEEPTHINK_TOP_P = float(
    os.environ.get("FLARE_DEEPTHINK_TOP_P", "0.95")
)

DEEPTHINK_TOP_K = int(
    os.environ.get("FLARE_DEEPTHINK_TOP_K", "20")
)

DEEPTHINK_REPEAT_PENALTY = float(
    os.environ.get("FLARE_DEEPTHINK_REPEAT_PENALTY", "1.05")
)

_default_credential = BASE_DIR / "firebase-credentials.json"

if (
    not _default_credential.exists()
    and (BASE_DIR / "firebase-credentials.json.json").exists()
):
    _default_credential = BASE_DIR / "firebase-credentials.json.json"

FIREBASE_CREDENTIALS = os.environ.get(
    "FLARE_FIREBASE_CREDENTIALS",
    str(_default_credential),
)

MODEL_TIMEOUT_SECONDS = float(
    os.environ.get("FLARE_MODEL_TIMEOUT", "180")
)

MAX_MESSAGE_CHARS = int(
    os.environ.get("FLARE_MAX_MESSAGE_CHARS", "8000")
)

MAX_CONTEXT_CHARS = int(
    os.environ.get("FLARE_MAX_CONTEXT_CHARS", "30000")
)

def _default_storage_root() -> Path:
    if os.name == "nt" and Path("D:/").exists():
        return Path("D:/FlareData")
    return BASE_DIR / "data"


STORAGE_ROOT = Path(
    os.environ.get("FLARE_STORAGE_ROOT", str(_default_storage_root()))
)

USER_QUOTA_BYTES = int(
    os.environ.get("FLARE_USER_QUOTA_BYTES", str(int(1.5 * 1024**3)))
)

MAX_STORED_MEMORIES = int(
    os.environ.get("FLARE_MAX_STORED_MEMORIES", "200")
)

ADMIN_EMAILS = [
    email.strip().lower()
    for email in os.environ.get("FLARE_ADMIN_EMAILS", "truststackagent@gmail.com").split(",")
    if email.strip()
]

MAX_UPDATE_MEDIA_BYTES = int(
    os.environ.get("FLARE_MAX_UPDATE_MEDIA_BYTES", str(50 * 1024**2))
)

UPDATES_DIR = STORAGE_ROOT / "updates"

ANON_MESSAGE_LIMIT = int(os.environ.get("FLARE_ANON_MESSAGE_LIMIT", "5"))
ANON_IP_DAILY_LIMIT = int(os.environ.get("FLARE_ANON_IP_DAILY_LIMIT", "500"))
USER_MESSAGE_LIMIT = int(os.environ.get("FLARE_USER_MESSAGE_LIMIT", "30"))
USER_WINDOW_SECONDS = int(os.environ.get("FLARE_USER_WINDOW_HOURS", "4")) * 3600