"""One-time setup: find Singaporean voices in the ElevenLabs library, add them to
the account, and write el_voices.json mapping persona -> voice_id.

Usage: ELEVENLABS_API_KEY=... python setup_elevenlabs.py
"""
import json
import os
from pathlib import Path

import httpx

API = "https://api.elevenlabs.io/v1"
KEY = os.environ["ELEVENLABS_API_KEY"]
H = {"xi-api-key": KEY}

# persona -> (library search, gender, age hints)
WANTED = {
    "ollie":   {"search": "singaporean english female warm", "gender": "female"},
    "uncle":   {"search": "singaporean english male", "gender": "male"},
    "tan":     {"search": "singaporean english male mature", "gender": "male"},
    "jiahui":  {"search": "singaporean english female young", "gender": "female"},
    "devi":    {"search": "singaporean english female", "gender": "female"},
    "arjun":   {"search": "indian english male calm", "gender": "male"},
    "mei":     {"search": "singaporean english female warm", "gender": "female"},
    "narrator": {"search": "singaporean english male narration", "gender": "male"},
}


def my_voices() -> dict[str, str]:
    r = httpx.get(f"{API}/voices", headers=H, timeout=30)
    r.raise_for_status()
    return {v["name"]: v["voice_id"] for v in r.json()["voices"]}


def search_shared(query: str, gender: str) -> list[dict]:
    r = httpx.get(f"{API}/shared-voices", headers=H, timeout=30,
                  params={"search": query, "gender": gender, "language": "en",
                          "page_size": 10})
    r.raise_for_status()
    return r.json().get("voices", [])


def add_voice(v: dict, name: str) -> str:
    r = httpx.post(f"{API}/voices/add/{v['public_owner_id']}/{v['voice_id']}",
                   headers=H, json={"new_name": name}, timeout=30)
    r.raise_for_status()
    return r.json()["voice_id"]


def main():
    existing = my_voices()
    mapping, used = {}, set()
    for persona, want in WANTED.items():
        name = f"SG {persona}"
        if name in existing:
            mapping[persona] = existing[name]
            print(f"{persona}: already added -> {existing[name]}")
            continue
        candidates = search_shared(want["search"], want["gender"]) or \
            search_shared("singaporean english", want["gender"])
        pick = next((c for c in candidates if c["voice_id"] not in used), None)
        if not pick:
            print(f"{persona}: NO MATCH — leave Piper fallback")
            continue
        used.add(pick["voice_id"])
        try:
            vid = add_voice(pick, name)
        except httpx.HTTPStatusError as e:
            print(f"{persona}: add failed ({e.response.status_code}), skipping")
            continue
        mapping[persona] = vid
        print(f"{persona}: {pick['name']} ({pick.get('accent')}) -> {vid}")
    out = Path(__file__).parent / "el_voices.json"
    out.write_text(json.dumps(mapping, indent=2))
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
