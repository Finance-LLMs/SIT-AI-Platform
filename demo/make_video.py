"""Demo video post-production.

  python make_video.py --prep   # generate the fake-microphone question wav
  python make_video.py          # narration + mux -> demo/out/SIT_AI_Platform_Demo.mp4

Narration is spoken by the platform's own TTS; the walkthrough was recorded by
record_demo.py into out/raw.webm + out/scenes.json.
"""
import json
import subprocess
import sys
from pathlib import Path

import httpx

BASE = "http://localhost:8080"
HERE = Path(__file__).parent
OUT = HERE / "out"

USER_QUESTION = (
    "Uncle, I believe artificial intelligence should assist doctors, but never make "
    "the final call. People deserve a human decision. What do you think?"
)

NARRATION = {
    "home": "This is the new S I T A I Platform: Singapore's unified home for the "
            "institute's conversational A I, redesigned end to end. Three experiences: "
            "a campus assistant, a debate arena, and an advisor studio.",
    "assistant": "Meet Ollie the Otter, the S I T assistant. Answers stream in live, "
                 "grounded in real S I T web content through hybrid retrieval, and every "
                 "answer cites its sources. Ollie speaks each reply aloud, lips moving in "
                 "sync with the voice.",
    "debate_setup": "The Debate Arena, featuring Singapore's voices of society: an elder "
                    "statesman, a heartland pop idol, a public intellectual, and the "
                    "kopitiam uncle himself. Choose your opponent and your motion.",
    "debate_start": "Your opponent opens the debate with a spoken argument, streamed word "
                    "by word, with the avatar lip syncing in real time.",
    "debate_user_turn": "Now you answer by voice. Speech is transcribed on the institute's "
                        "own G P Us, and the debate continues naturally.",
    "debate_summary": "One tap summarizes the entire exchange.",
    "advisor": "The Advisor Studio: one on one voice mentoring tuned for Singapore, from "
               "C P F and H D B decisions to exam strategy.",
    "closing": "The full stack runs on the institute's own G P U server, with ElevenLabs "
               "Singapore voice profiles when connected. The S I T A I Platform: built "
               "for Singapore, ready for the campus.",
}


def tts(text: str, voice_persona: str, path: Path):
    audio = httpx.post(f"{BASE}/api/tts", timeout=180,
                       json={"text": text, "persona_id": voice_persona}).content
    assert len(audio) > 2000, "tts failed"  # wav (piper) or mp3 (elevenlabs)
    path.write_bytes(audio)


def prep():
    raw = HERE / "_user_q_raw.wav"
    tts(USER_QUESTION, "jiahui", raw)  # female voice, distinct from Uncle
    # chrome fake-mic wants 48k; add a lead-in pause so the recording catches it all
    # trailing silence so the fake-mic loop restart stays silent during capture
    subprocess.run(["ffmpeg", "-y", "-i", str(raw),
                    "-af", "adelay=800|800,apad=pad_dur=8",
                    "-ar", "48000", "-ac", "1", str(HERE / "user_question.wav")],
                   check=True, capture_output=True)
    raw.unlink()
    print("user_question.wav ready")


def duration_of(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


def build():
    """Mix three layers onto the recording, with no voice-on-voice overlap:
    1. product audio — the actual agent clips (captured by the backend during the
       take) and the user's spoken question, placed at their real timestamps;
    2. narration — segments scheduled at scene starts but pushed later so they
       never overlap each other;
    3. the product layer is sidechain-ducked under the narrator."""
    meta = json.loads((OUT / "scenes.json").read_text())
    t0, scenes = meta["t0"], {s["name"]: s["t"] for s in meta["scenes"]}
    video_dur = duration_of(OUT / "raw.webm")

    # --- product layer: captured agent clips + the user's voice turn
    product: list[tuple[float, Path]] = []
    cap = OUT / "tts_capture"
    for f in sorted(cap.iterdir()):
        ts = float(f.stem) - t0 + 0.35  # network + decode delay before playback
        if 0 <= ts < video_dur:
            product.append((ts, f))
    if "debate_user_turn" in scenes:
        product.append((scenes["debate_user_turn"] + 1.1, HERE / "user_question.wav"))

    # --- narration layer: TTS each segment, schedule without self-overlap.
    # Two US narrators: Jack John opens the video, Abhi takes the back half.
    ABHI_SCENES = {"advisor", "closing"}
    narr: list[tuple[float, Path]] = []
    prev_end = 0.0
    for name, text in NARRATION.items():
        if name not in scenes:
            continue
        seg = OUT / f"narr_{name}.wav"
        tts(text, "narrator2" if name in ABHI_SCENES else "narrator", seg)
        start = max(scenes[name], prev_end + 0.6)
        narr.append((start, seg))
        prev_end = start + duration_of(seg)

    # --- ffmpeg graph
    inputs: list[str] = []
    chains: list[str] = []

    def layer(items: list[tuple[float, Path]], label: str) -> str:
        tags = []
        for start, path in items:
            idx = len(inputs) // 2 + 1  # input 0 is the video
            inputs.extend(["-i", str(path)])
            ms = int(start * 1000)
            tag = f"{label}{idx}"
            chains.append(
                f"[{idx}]aformat=sample_rates=44100:channel_layouts=stereo,"
                f"adelay={ms}|{ms}[{tag}]")
            tags.append(f"[{tag}]")
        chains.append("".join(tags) + f"amix=inputs={len(tags)}:normalize=0[{label}]")
        return label

    p = layer(product, "prod")
    n = layer(narr, "narr")
    chains.append(f"[{n}]asplit[nduck][nmix]")
    chains.append(f"[{p}][nduck]sidechaincompress=threshold=0.02:ratio=12:attack=80:release=600[pducked]")
    chains.append("[pducked][nmix]amix=inputs=2:normalize=0,alimiter=limit=0.95[aout]")

    # hold the last frame long enough for the closing narration to finish
    total = max(video_dur, prev_end + 1.0)
    chains.append(f"[0:v]tpad=stop_mode=clone:stop_duration={max(0.0, total - video_dur):.2f}[vout]")

    subprocess.run(
        ["ffmpeg", "-y", "-i", str(OUT / "raw.webm"), *inputs,
         "-filter_complex", ";".join(chains), "-map", "[vout]", "-map", "[aout]",
         "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-t", str(total),
         str(OUT / "SIT_AI_Platform_Demo.mp4")],
        check=True, capture_output=True)
    print(f"product clips: {len(product)}, narration segments: {len(narr)}")
    print(f"final video: {OUT / 'SIT_AI_Platform_Demo.mp4'}")


if __name__ == "__main__":
    prep() if "--prep" in sys.argv else build()
