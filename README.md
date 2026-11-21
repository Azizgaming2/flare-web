# Flare AI

Flare AI is an AI chat platform built for schools. It serves language models through Ollama, authenticates users with Firebase, and is available as a web application and an Android app.

Flare AI is a hosted service operated exclusively by the Flare team. As with ChatGPT or Claude, hosting, model serving and data storage all take place on Flare Corporation's own private servers. The software is not offered for self-hosting by third parties.

Developed by Flare Corporation.

## Overview

- **Data stays on Flare servers.** Conversations, files and memories are stored on disk on Flare Corporation's own servers under the Flare team's control. Firebase is used for authentication only.
- **Safe for students.** Age confirmation, automated age-suspicion review, an appeals workflow and administrator controls are part of the core product.
- **Operable by a small team.** A built-in admin dashboard provides server monitoring, account moderation, feedback analytics and announcements without external tooling.

## Features

**Chat**
- Streaming responses with three modes: Fast Answers, DeepThink (extended reasoning) and Feynman
- Feynman mode: the user explains a topic, the AI acts as a curious student who asks questions and finally grades the explanation
- Run Python: Python code blocks in answers can be executed directly in the browser with Pyodide, inside a Web Worker with a timeout, so the server is not loaded
- Persistent chats, regeneration, like/dislike feedback with a reason
- Per-user long-term memories
- File attachments with text extraction; image attachments are processed with OCR (Azerbaijani, Russian, English)
- Web search integration
- Voice input, camera capture on mobile and text-to-speech playback of answers
- Interface languages: Azerbaijani, English, Turkish

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
- Automatic daily backups of the data folder

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
        +----> DuckDuckGo search (ddgs)
        +----> edge-tts (speech synthesis)

Browser only: Pyodide (Python execution in a Web Worker)
```

## Technology

| Layer | Stack |
| --- | --- |
| Backend | Python, FastAPI, Uvicorn, SQLite |
| Model serving | Ollama, custom Modelfile on a Qwen 2.5 3B base (Flare Tentium 2.5) |
| Frontend | React 18, Vite, react-markdown, highlight.js |
| Code execution | Pyodide (client side) |
| Mobile | Capacitor, Android, built with GitHub Actions |
| Authentication | Firebase Auth |
| OCR | Tesseract (aze, rus, eng) via pytesseract |
| Exposure | Cloudflare Tunnel |

## Repository layout

```
backend/            FastAPI application, services, Modelfile
  main.py           Routes and access control
  model_service.py  Ollama client and prompt assembly
  prompts.py        System prompt, mode prompts, style prompts
  config.py         Environment-based configuration
  admin_api.py      Admin endpoints
  admin_service.py  Metrics, authors, accounts, feedback analytics
  file_service.py   Attachment extraction and OCR
  usage_service.py  Accounts, limits, suspension state
web/                React application and Capacitor project
  src/components/   UI components, including AdminDashboard
  src/pyRunner.js   Pyodide worker for the Run button
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

## Server deployment (internal)

This section is internal documentation for the Flare team's own servers. Flare AI is not distributed for third-party hosting.

### 1. Model

```
.\backend\run_model.ps1
```

This creates the `flare-tentium` model in Ollama from `backend/ModelFile`.

### 2. Backend

Place the Firebase service account key at `backend/firebase-credentials.json`, then:

```
pip install -r backend/requirements.txt
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

### 5. Android

The APK is built by the GitHub Actions workflow in `.github/workflows/android.yml`. No local Android Studio installation is required.

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
| `FLARE_ANON_MESSAGE_LIMIT` | Messages allowed for anonymous visitors |
| `FLARE_USER_QUOTA_BYTES` | Per-user storage quota |
| `FLARE_TESSERACT_CMD` | Path to the Tesseract executable if not auto-detected |
| `FLARE_FIREBASE_CREDENTIALS` | Path to the Firebase service account key |

Model sampling parameters (`FLARE_TEMPERATURE`, `FLARE_TOP_P`, `FLARE_TOP_K`, `FLARE_MAX_NEW_TOKENS` and related) are also configurable.

## Data storage

User data is stored on disk on the Flare server at `<FLARE_STORAGE_ROOT>/users/<uid>/{Files,Memory,Chats}`. On Windows the default root is `D:/FlareData` when a D drive exists, otherwise `backend/data`.

## Security notes

- Never commit `backend/firebase-credentials.json`, `.env` files or user data; they are excluded by `.gitignore`.
- Attached file text and web search results are passed to the model as data, never as instructions.
- Exposure to the internet should go through the Cloudflare Tunnel only; do not open the backend port directly.

## Roadmap

- Flare Crypton model family on stronger GPU hardware, with Azerbaijani speech output
- Crypton Studio: a separate coding workspace with virtual sandboxes where the model runs and debugs code
- Rewarded-ad message limit extension
- Stable public domain and Ministry of Education presentation

## License

Proprietary. Copyright (c) 2026 Flare Corporation. All rights reserved. See [LICENSE](LICENSE).