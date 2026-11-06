# Flare AI

Flare AI is a self-hosted AI chat platform built for schools. It runs a locally served language model, authenticates users with Firebase, stores all user data on the host machine, and ships as both a web application and an Android app.

Developed by Flare Corporation.

## Overview

The system is designed around three principles:

- **Data stays on the host.** Conversations, files and memories are stored on disk under the operator's control. Firebase is used for authentication only.
- **Safe for students.** Age confirmation, automated age-suspicion review, an appeals workflow and administrator controls are part of the core product.
- **Operable by a small team.** A built-in admin dashboard provides server monitoring, account moderation, feedback analytics and announcements without external tooling.

## Features

**Chat**
- Streaming responses with two modes: fast answers and extended reasoning
- Persistent chats, regeneration, like/dislike feedback with a reason
- Per-user long-term memories
- File attachments with text extraction; image attachments are processed with OCR (Azerbaijani, Russian, English)
- Voice input and camera capture on mobile
- Web search integration
- Interface languages: English, Azerbaijani, Russian

**Accounts and safety**
- Google sign-in on the web, email and password sign-in in the Android app
- Age confirmation and automated age-suspicion review
- Account freezing, permanent banning and per-user data deletion
- Appeals workflow with email whitelisting
- Message limits per time window for users and anonymous visitors, per-user storage quota

**Administration**
- Server Control: live CPU, GPU and RAM usage, temperature history, uptime, loaded model list, command terminal
- Manage Authors: grant or revoke administrator access by email
- Age Detection and Email: account list, age suspicions, appeals, moderation actions
- RLHF Data: like and dislike counts, dislike reasons, recent feedback, JSONL export
- Shares: announcements with images and video shown in the in-app notifications page

## Architecture

```
Client (React web app / Capacitor Android app)
        |
        |  HTTPS (Cloudflare Tunnel)
        v
FastAPI backend  ---->  Ollama (Flare Tentium model)
        |
        +----> Firebase Auth (token verification)
        +----> Local storage (chats, files, memories, SQLite)
        +----> Tesseract OCR
```

## Technology

| Layer | Stack |
| --- | --- |
| Backend | Python, FastAPI, Uvicorn, SQLite |
| Model serving | Ollama, custom Modelfile on a Qwen 2.5 3B base (Flare Tentium 2.5) |
| Frontend | React 18, Vite |
| Mobile | Capacitor 8, Android, built with GitHub Actions |
| Authentication | Firebase Auth |
| OCR | Tesseract (aze, rus, eng) via pytesseract |
| Exposure | Cloudflare Tunnel |

## Repository layout

```
backend/            FastAPI application, services, Modelfile
  main.py           Routes and access control
  model_service.py  Ollama client and prompt assembly
  admin_api.py      Admin endpoints
  admin_service.py  Metrics, authors, accounts, feedback analytics
  file_service.py   Attachment extraction and OCR
  usage_service.py  Accounts, limits, suspension state
web/                React application and Capacitor project
  src/components/   UI components, including AdminDashboard
.github/workflows/  Android APK build
firestore.rules     Firebase rules
```

## Requirements

- Python 3.11 or newer
- Node.js 20 or newer
- [Ollama](https://ollama.com)
- [Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki) with the `aze`, `rus` and `eng` language data
- A Firebase project with a service account key
- Optional: an NVIDIA GPU with `nvidia-smi` for GPU metrics

## Setup

### 1. Model

```
.\backend\run_model.ps1
```

This creates the `flare-tentium` model in Ollama from `backend/ModelFile`.

### 2. Backend

Place the Firebase service account key at `backend/firebase-credentials.json`, then:

```
pip install -r requirements.txt
pip install psutil
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

### 3. Frontend

```
cd web
npm install
npm run dev
```

For production, run `npm run build`; the backend serves the resulting `web/dist` directory.

### 4. Public access

```
cloudflared tunnel run --url http://localhost:8000 <tunnel-name>
```

Add the public domain to Firebase Authentication under Settings, Authorized domains.

## Configuration

Settings are read from environment variables or `backend/.env`.

| Variable | Purpose |
| --- | --- |
| `FLARE_OLLAMA_URL` | Ollama base URL (default `http://127.0.0.1:11434`) |
| `FLARE_TENTIUM_MODEL` | Model name served by Ollama |
| `FLARE_ADMIN_EMAILS` | Comma-separated owner emails with full admin access |
| `FLARE_CORS_ORIGINS` | Allowed origins; include `https://localhost` and `capacitor://localhost` for the Android app |
| `FLARE_STORAGE_ROOT` | Root directory for user data |
| `FLARE_USER_MESSAGE_LIMIT` | Messages allowed per window for signed-in users |
| `FLARE_USER_WINDOW_HOURS` | Length of the message limit window |
| `FLARE_USER_QUOTA_BYTES` | Per-user storage quota |
| `FLARE_TESSERACT_CMD` | Path to the Tesseract executable if not auto-detected |
| `FLARE_FIREBASE_CREDENTIALS` | Path to the Firebase service account key |

Model sampling parameters (`FLARE_TEMPERATURE`, `FLARE_TOP_P`, `FLARE_TOP_K`, `FLARE_MAX_NEW_TOKENS` and related) are also configurable.

## Data storage

User data is stored on disk at `<FLARE_STORAGE_ROOT>/users/<uid>/{Files,Memory,Chats}`. On Windows the default root is `D:/FlareData` when a D drive exists, otherwise `backend/data`.

## Android app

The APK is built by the GitHub Actions workflow in `.github/workflows/android.yml` on every push to `main`.

1. Add the repository secret `API_BASE_URL` with the public backend URL, without a trailing slash.
2. Push to `main`, or run the workflow manually from the Actions tab.
3. Download the `flare-ai-apk` artifact from the finished run and install the contained APK.

The backend URL is embedded at build time, so a changed URL requires a rebuild. Use a stable tunnel domain in production.

## Administration

Administrator access requires a verified email. Owners are defined by `FLARE_ADMIN_EMAILS`; owners can add authors from the dashboard. Authors have access to every section except Manage Authors and the command terminal. Open the dashboard from the profile menu in the sidebar.

## Security notes

- All admin endpoints verify Firebase tokens server-side and re-check administrator status on every request.
- Banned accounts are disabled in Firebase and have their refresh tokens revoked.
- The admin terminal executes only a fixed set of built-in commands, never shell input.
- Keep `firebase-credentials.json`, `.env` and tunnel tokens out of version control.

## Roadmap

- Rewarded-ad based message top-ups
- Stronger Azerbaijani language model on dedicated hardware
- Native Google sign-in for the Android app
- Improved voice input sensitivity

## License

MIT. See [LICENSE](LICENSE).
