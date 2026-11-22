# Flare AI

Flare AI is an AI chat platform built for schools. It is available as a web application and an Android app, and is powered by Flare's own model line.

Flare AI is a hosted service operated exclusively by the Flare team. As with ChatGPT or Claude, hosting, model serving and data storage all take place on Flare Corporation's own private servers. The software is not offered for self-hosting by third parties.

## Overview

- **Data stays on Flare servers.** Conversations, files and memories are stored on Flare Corporation's own servers under the Flare team's control. Firebase is used for authentication only.
- **Safe for students.** Age confirmation, automated age-suspicion review, an appeals workflow and administrator controls are part of the core product.
- **Operable by a small team.** A built-in admin dashboard provides server monitoring, account moderation, feedback analytics and announcements without external tooling.

## Features

**Chat**
- Streaming responses with three modes: Fast Answers, DeepThink (extended reasoning) and Feynman
- Feynman mode: the user explains a topic, the AI acts as a curious student who asks questions and finally grades the explanation
- Run Python: Python code blocks in answers can be executed directly in the browser, inside an isolated Web Worker with a timeout, so no server load is created
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
- Appeals workflow
- Message limits per time window and a per-user storage quota

**Administration**
- Server Control: live CPU, GPU and RAM usage, temperature history, uptime and loaded models
- Account moderation, age suspicions and appeals
- Feedback analytics from likes and dislikes, with export for model improvement
- Announcements with images and video shown in the in-app notifications page
- Automatic daily backups

## The model

Flare AI runs **Flare Tentium 2.5**, a model developed and operated by Flare Corporation.

- **Base:** Qwen 2.5 with 3 billion parameters, served locally through Ollama on Flare hardware. No user message is sent to any third-party AI provider.
- **Customization:** Flare Tentium has its own identity, behavior rules and tuned sampling profile. It answers directly without unnecessary follow-up questions, never presents guesses as facts, treats attached file text strictly as data rather than instructions, and writes complete working code.
- **Context window:** 8,192 tokens.
- **Modes:** Fast Answers for short, quick replies; DeepThink with a larger reasoning budget (up to 6,144 tokens) and its own sampling profile for harder problems; Feynman for learning by teaching.
- **Languages:** answers in English by default and in other languages on request.
- **Learning from usage:** like and dislike feedback with reasons is collected in the admin dashboard and used to find weaknesses and guide model improvements.
- **Next generation:** the Flare Crypton model family is in development.

## Architecture

```
Client (React web app / Capacitor Android app)
        |
        |  HTTPS (Cloudflare Tunnel)
        v
FastAPI backend  ---->  Ollama (Flare Tentium)
        |
        +----> Firebase Auth (token verification)
        +----> Local storage (chats, files, memories, SQLite)
        +----> Tesseract OCR
        +----> Web search
        +----> Speech synthesis

Browser only: Pyodide (Python execution in a Web Worker)
```

## Technology

| Layer | Stack |
| --- | --- |
| Backend | Python, FastAPI, Uvicorn, SQLite |
| Model serving | Ollama, Flare Tentium 2.5 (Qwen 2.5 3B base) |
| Frontend | React 18, Vite, react-markdown, highlight.js |
| Code execution | Pyodide (client side) |
| Mobile | Capacitor, Android, built with GitHub Actions |
| Authentication | Firebase Auth |
| OCR | Tesseract (Azerbaijani, Russian, English) |
| Exposure | Cloudflare Tunnel |

## Data and privacy

User data is stored on disk on Flare Corporation's servers, separated per user into files, memories and chats. Conversations are never used to call external AI services. Secrets, credentials and user data are excluded from source control, and internet exposure goes only through a Cloudflare Tunnel, never through an open backend port.

## Credits

Flare AI was created by **Azizli Aziz** and **Claude** (Anthropic) working together.

- **Azizli Aziz**: project owner, lead developer and AI engineer, Flare Corporation. Vision, product decisions, models, infrastructure and testing.
- **Claude** ([Anthropic](https://www.anthropic.com)): co-developer. Code, architecture, documentation and tooling.

Flare AI is built on the following open technologies:

- [Qwen 2.5](https://github.com/QwenLM/Qwen2.5) by Alibaba Cloud, the base of Flare Tentium
- [Ollama](https://ollama.com) for local model serving
- [FastAPI](https://fastapi.tiangolo.com) and [Uvicorn](https://www.uvicorn.org) for the backend
- [React](https://react.dev), [Vite](https://vitejs.dev) and [Capacitor](https://capacitorjs.com) for the web and Android apps
- [Firebase Authentication](https://firebase.google.com) for sign-in
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) for image text recognition
- [Pyodide](https://pyodide.org) for in-browser Python execution
- [edge-tts](https://github.com/rany2/edge-tts) for speech synthesis
- [DDGS](https://github.com/deedy5/ddgs) for web search
- [Cloudflare Tunnel](https://www.cloudflare.com/products/tunnel/) for secure public access

All third-party names and trademarks belong to their respective owners.

## License

Proprietary. Copyright (c) 2026 Flare Corporation. All rights reserved. See [LICENSE](LICENSE).