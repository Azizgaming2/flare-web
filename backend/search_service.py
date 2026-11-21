from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger("flare.search")

MAX_RESULTS = 3
SEARCH_TIMEOUT_SECONDS = 10.0
MAX_BODY_CHARS = 200


def _search_sync(query: str) -> list[dict]:
    from ddgs import DDGS

    raw = DDGS().text(query, region="wt-wt", safesearch="on", max_results=MAX_RESULTS)
    results = []
    for item in raw or []:
        title = str(item.get("title", "")).replace("[", "(").replace("]", ")").strip()
        href = str(item.get("href", "")).strip()
        body = str(item.get("body", "")).strip()[:MAX_BODY_CHARS]
        if title and href.startswith(("http://", "https://")):
            results.append({"title": title, "href": href, "body": body})
    return results


async def web_search(query: str) -> list[dict]:
    query = " ".join(query.split())[:200]
    if not query:
        return []
    try:
        return await asyncio.wait_for(asyncio.to_thread(_search_sync, query), SEARCH_TIMEOUT_SECONDS)
    except Exception:
        logger.exception("Web search failed")
        return []
