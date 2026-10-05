"""ElevenLabs STT/TTS, used when ELEVENLABS_API_KEY is set. Piper/Whisper otherwise."""
import os

import httpx

API = "https://api.elevenlabs.io/v1"
KEY = os.getenv("ELEVENLABS_API_KEY", "")
TTS_MODEL = os.getenv("ELEVENLABS_TTS_MODEL", "eleven_turbo_v2_5")


def enabled() -> bool:
    return bool(KEY)


def tts(text: str, voice_id: str) -> bytes:
    """Returns MP3 audio."""
    r = httpx.post(
        f"{API}/text-to-speech/{voice_id}",
        headers={"xi-api-key": KEY},
        params={"output_format": "mp3_44100_128"},
        json={"text": text, "model_id": TTS_MODEL,
              "voice_settings": {"stability": 0.45, "similarity_boost": 0.8}},
        timeout=120,
    )
    r.raise_for_status()
    return r.content


def stt(audio: bytes, filename: str = "audio.webm") -> str:
    r = httpx.post(
        f"{API}/speech-to-text",
        headers={"xi-api-key": KEY},
        data={"model_id": "scribe_v1"},
        files={"file": (filename, audio)},
        timeout=300,
    )
    r.raise_for_status()
    return r.json().get("text", "").strip()
