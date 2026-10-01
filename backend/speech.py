"""STT (faster-whisper) and TTS (Piper). Models lazy-load on first use."""
import io
import os
import wave
from functools import lru_cache
from pathlib import Path

VOICES_DIR = Path(os.getenv("PIPER_VOICES_DIR", Path(__file__).parent / "voices"))
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "auto")  # cuda on Deathstar
DEFAULT_VOICE = "en_US-amy-medium"


@lru_cache(maxsize=1)
def _whisper():
    from faster_whisper import WhisperModel
    compute = "float16" if WHISPER_DEVICE == "cuda" else "int8"
    return WhisperModel(WHISPER_MODEL, device=WHISPER_DEVICE, compute_type=compute)


def transcribe(audio_bytes: bytes, suffix: str = "webm") -> str:
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=f".{suffix}") as f:
        f.write(audio_bytes)
        f.flush()
        segments, _ = _whisper().transcribe(f.name, vad_filter=True)
        return " ".join(s.text.strip() for s in segments).strip()


@lru_cache(maxsize=8)
def _voice(name: str):
    from piper import PiperVoice
    path = VOICES_DIR / f"{name}.onnx"
    if not path.exists():
        path = VOICES_DIR / f"{DEFAULT_VOICE}.onnx"
    return PiperVoice.load(str(path))


def synthesize(text: str, voice: str = DEFAULT_VOICE) -> bytes:
    """Return a WAV file for the given text."""
    v = _voice(voice)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        v.synthesize_wav(text, w)
    return buf.getvalue()


def stt_ok() -> bool:
    try:
        import faster_whisper  # noqa: F401
        return True
    except ImportError:
        return False


def tts_ok() -> bool:
    try:
        import piper  # noqa: F401
        return VOICES_DIR.exists() and any(VOICES_DIR.glob("*.onnx"))
    except ImportError:
        return False
