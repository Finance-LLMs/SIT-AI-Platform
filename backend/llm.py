"""LLM access: Ollama by default, OpenAI when OPENAI_API_KEY is set."""
import json
import os
from collections.abc import AsyncIterator

import httpx

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
CHAT_MODEL = os.getenv("CHAT_MODEL", "qwen2.5:7b-instruct")
# small model for short conversational turns (debate/advisor) — latency matters there
FAST_MODEL = os.getenv("CHAT_MODEL_FAST", "")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
OPENAI_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-4.1-mini")


async def chat_stream(messages: list[dict], fast: bool = False) -> AsyncIterator[str]:
    """Yield response tokens for an OpenAI-style messages list."""
    async with httpx.AsyncClient(timeout=120) as client:
        if OPENAI_KEY:
            async with client.stream(
                "POST", "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {OPENAI_KEY}"},
                json={"model": OPENAI_CHAT_MODEL, "messages": messages, "stream": True},
            ) as r:
                async for line in r.aiter_lines():
                    if line.startswith("data: ") and line != "data: [DONE]":
                        delta = json.loads(line[6:])["choices"][0]["delta"]
                        if tok := delta.get("content"):
                            yield tok
        else:
            model = FAST_MODEL if fast and FAST_MODEL else CHAT_MODEL
            async with client.stream(
                "POST", f"{OLLAMA_URL}/api/chat",
                json={"model": model, "messages": messages, "stream": True,
                      "keep_alive": "60m"},
            ) as r:
                async for line in r.aiter_lines():
                    if line:
                        chunk = json.loads(line)
                        if tok := chunk.get("message", {}).get("content"):
                            yield tok


def embed(texts: list[str]) -> list[list[float]]:
    """Synchronous embeddings via Ollama (used by ingest and retrieval)."""
    r = httpx.post(f"{OLLAMA_URL}/api/embed",
                   json={"model": EMBED_MODEL, "input": texts}, timeout=120)
    r.raise_for_status()
    return r.json()["embeddings"]


def warm() -> None:
    """Load the chat models into Ollama so first requests aren't cold."""
    if OPENAI_KEY:
        return
    for model in {CHAT_MODEL, FAST_MODEL} - {""}:
        try:
            httpx.post(f"{OLLAMA_URL}/api/generate",
                       json={"model": model, "prompt": "hi", "stream": False,
                             "keep_alive": "60m", "options": {"num_predict": 1}},
                       timeout=300)
        except httpx.HTTPError:
            pass


def llm_ok() -> bool:
    try:
        return httpx.get(f"{OLLAMA_URL}/api/tags", timeout=3).status_code == 200 or bool(OPENAI_KEY)
    except httpx.HTTPError:
        return bool(OPENAI_KEY)
