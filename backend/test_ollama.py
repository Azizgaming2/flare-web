from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.config import OLLAMA_BASE_URL, OLLAMA_MODEL


async def main() -> None:
    timeout = httpx.Timeout(
        60.0,
        connect=10.0,
    )

    async with httpx.AsyncClient(timeout=timeout) as client:
        tags_response = await client.get(
            f"{OLLAMA_BASE_URL}/api/tags"
        )
        tags_response.raise_for_status()

        models = tags_response.json().get("models", [])
        names = {
            model.get("name", "")
            for model in models
        }

        if (
            OLLAMA_MODEL not in names
            and f"{OLLAMA_MODEL}:latest" not in names
        ):
            print("Ollama is running, but the model was not found.")
            print(f"Configured model: {OLLAMA_MODEL}")
            print(
                "Available models:",
                ", ".join(sorted(names)) or "none",
            )
            raise SystemExit(2)

        response = await client.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": [
                    {
                        "role": "user",
                        "content": (
                            "In English, introduce yourself "
                            "in two short sentences."
                        ),
                    }
                ],
                "stream": False,
                "think": False,
                "options": {
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "top_k": 40,
                    "num_predict": 160,
                },
            },
        )

        response.raise_for_status()
        result = response.json()

        print("Ollama API: OK")
        print("Model:", OLLAMA_MODEL)
        print("English response:")
        print(
            result.get("message", {})
            .get("content", "")
            .strip()
        )


if __name__ == "__main__":
    asyncio.run(main())