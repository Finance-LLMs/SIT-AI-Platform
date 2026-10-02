"""SIT AI Platform — unified backend (chat SSE, STT, TTS, personas, static SPA)."""
import json
from pathlib import Path

from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import elevenlabs_client as el
import rag
import speech
from llm import chat_stream, llm_ok
from personas import PERSONAS, public_registry, system_prompt

_el_voices_file = Path(__file__).parent / "el_voices.json"
EL_VOICES: dict = json.loads(_el_voices_file.read_text()) if _el_voices_file.exists() else {}

app = FastAPI(title="SIT AI Platform")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"],
                   allow_headers=["*"])

RAG_READY = rag.load()
DIST = Path(__file__).parent.parent / "frontend" / "dist"


@app.on_event("startup")
def warm_models():
    # load whisper + default voice in the background so first requests aren't slow
    import threading

    def _warm():
        from llm import warm
        warm()
        try:
            speech.synthesize("warm up", speech.DEFAULT_VOICE)
            speech.transcribe(speech.synthesize("warm up", speech.DEFAULT_VOICE), "wav")
        except Exception:
            pass

    threading.Thread(target=_warm, daemon=True).start()


class ChatRequest(BaseModel):
    persona_id: str
    messages: list[dict]  # [{role, content}]
    topic: str | None = None
    rag: bool = False


@app.get("/api/health")
def health():
    return {"llm": llm_ok(), "stt": speech.stt_ok() or el.enabled(),
            "tts": speech.tts_ok() or el.enabled(), "rag": RAG_READY,
            "voice_provider": "elevenlabs" if el.enabled() else "local"}


@app.get("/api/personas")
def personas():
    return public_registry()


@app.post("/api/chat")
async def chat(req: ChatRequest):
    if req.persona_id not in PERSONAS:
        return Response(status_code=404)
    sys_msg = system_prompt(req.persona_id, req.topic)
    sources: list[dict] = []
    if req.rag and RAG_READY and req.messages:
        chunks = rag.retrieve(req.messages[-1]["content"])
        if chunks:
            sources = [{"url": c["url"]} for c in chunks]
            sys_msg += ("\n\nContext documents:\n" + rag.context_block(chunks))
    messages = [{"role": "system", "content": sys_msg}, *req.messages[-12:]]
    # debate/advisor turns are short and latency-sensitive -> fast model if configured
    fast = PERSONAS[req.persona_id]["module"] != "assistant"

    async def gen():
        async for tok in chat_stream(messages, fast=fast):
            yield f"data: {json.dumps({'token': tok})}\n\n"
        if sources:
            yield f"event: sources\ndata: {json.dumps(sources)}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache"})


@app.post("/api/stt")
async def stt(file: UploadFile):
    audio = await file.read()
    suffix = (file.filename or "audio.webm").rsplit(".", 1)[-1][:5] or "webm"
    if el.enabled():
        try:
            return {"text": el.stt(audio, f"audio.{suffix}")}
        except Exception:
            pass  # fall back to local whisper
    return {"text": speech.transcribe(audio, suffix)}


class TTSRequest(BaseModel):
    text: str
    persona_id: str = "ollie"


import os
import time

TTS_CAPTURE_DIR = os.getenv("TTS_CAPTURE_DIR")  # demo recording: log spoken audio


def _capture(audio: bytes, ext: str):
    if TTS_CAPTURE_DIR:
        try:
            Path(TTS_CAPTURE_DIR).mkdir(parents=True, exist_ok=True)
            (Path(TTS_CAPTURE_DIR) / f"{time.time():.3f}.{ext}").write_bytes(audio)
        except OSError:
            pass


@app.post("/api/tts")
def tts(req: TTSRequest):
    text = req.text[:1500]
    if el.enabled() and req.persona_id in EL_VOICES:
        try:
            audio = el.tts(text, EL_VOICES[req.persona_id])
            _capture(audio, "mp3")
            return Response(audio, media_type="audio/mpeg")
        except Exception:
            pass  # fall back to piper
    voice = PERSONAS.get(req.persona_id, {}).get("voice", speech.DEFAULT_VOICE)
    audio = speech.synthesize(text, voice)
    _capture(audio, "wav")
    return Response(audio, media_type="audio/wav")


if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        file = DIST / path
        if path and file.is_file():
            return FileResponse(file)
        return FileResponse(DIST / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
