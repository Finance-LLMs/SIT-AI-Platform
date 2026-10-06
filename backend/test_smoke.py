"""End-to-end smoke test against a running backend (default localhost:8080).

Usage: python test_smoke.py [base_url]
"""
import json
import sys

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"


def main():
    # health
    h = httpx.get(f"{BASE}/api/health", timeout=10).json()
    print("health:", h)
    assert h["llm"] and h["stt"] and h["tts"], f"component down: {h}"

    # personas
    personas = httpx.get(f"{BASE}/api/personas", timeout=10).json()
    ids = {p["id"] for p in personas}
    assert {"ollie", "tan", "jiahui", "devi", "uncle", "arjun", "mei"} <= ids, ids
    print(f"personas: {len(personas)} ok")

    # chat SSE streams tokens
    tokens = 0
    with httpx.stream("POST", f"{BASE}/api/chat", timeout=180, json={
        "persona_id": "ollie", "rag": h["rag"],
        "messages": [{"role": "user", "content": "What is SIT known for?"}],
    }) as r:
        assert r.status_code == 200
        text = ""
        for line in r.iter_lines():
            if line.startswith("data: ") and '"token"' in line:
                text += json.loads(line[6:])["token"]
                tokens += 1
    assert tokens > 5 and len(text) > 40, f"thin reply: {tokens} tokens"
    print(f"chat: {tokens} tokens streamed ok — {text[:80]!r}")

    # tts -> stt round trip
    wav = httpx.post(f"{BASE}/api/tts", timeout=120, json={
        "text": "Hello from the smoke test.", "persona_id": "ollie"}).content
    is_wav = wav[:4] == b"RIFF"
    assert (is_wav or wav[:2] in (b"ID", b"\xff\xfb", b"\xff\xf3")) and len(wav) > 10000, "bad audio"
    ext = "wav" if is_wav else "mp3"
    stt = httpx.post(f"{BASE}/api/stt", timeout=300,
                     files={"file": (f"audio.{ext}", wav, f"audio/{ext}")}).json()
    assert "smoke" in stt["text"].lower(), stt
    print(f"tts+stt round trip ok — {stt['text']!r}")

    print("ALL SMOKE TESTS PASSED" + ("" if h["rag"] else " (rag not indexed yet)"))


if __name__ == "__main__":
    main()
