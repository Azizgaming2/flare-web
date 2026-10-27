# Flare Quadro

Chat application by Flare Corporation. FastAPI backend, Ollama (Qwen3 0.6B customized as `flare-quadro`), Firebase Auth, React frontend.

## Setup

1. Install Ollama, then from the project root run `.\backend\run_model.ps1` to create the `flare-quadro` model.
2. Put the Firebase service account key at `backend/firebase-credentials.json`.
3. Optional: copy `backend/.env.example` to `backend/.env` and adjust values.
4. Backend, from the project root:

```
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

5. Frontend:

```
cd web
npm install
npm run dev
```

## Data storage

User data is stored on disk, not in Firestore: `<FLARE_STORAGE_ROOT>/users/<uid>/{Files,Memory,Chats}`. The default root is `D:/FlareData` on Windows when a D drive exists, otherwise `backend/data`. Each user has a 1.5 GB quota. Memories are also written to `Memory/memory.txt`.

## Notes

- The core prompt lives in `backend/prompts.py` and `backend/ModelFile`, keep both in sync.
- Firebase is used only for authentication.
