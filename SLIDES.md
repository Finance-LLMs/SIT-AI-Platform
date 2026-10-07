---
marp: true
theme: default
class: invert
paginate: true
title: SIT AI Platform
description: Unified conversational AI for the Singapore Institute of Technology
---

<!-- _class: lead invert -->

# 🦦 SIT AI Platform

### One conversational-AI home for the Singapore Institute of Technology

Campus assistant · Debate arena · Voice mentoring
**Lip-synced avatars · Singaporean voices · Real-time streaming**

Abhay Shakya · MIDAS Lab · Finance-LLMs

---

## The starting point

Four separate prototypes, built independently:

- **AI-debate-bot** — voice debates with celebrity personas
- **SIT-chatbot** — otter-mascot Q&A for SIT
- **Institute-Chatbot-RAG** — retrieval-grounded SIT chat
- **Personality-Voice-Interaction** — finance-advisor voice chat

**Problems:** ~16k lines of duplicated vanilla-JS, four backends doing the same job,
every app locked to per-app ElevenLabs dashboard agents, no tests, no shared design.

---

## The redesign

**One platform, three experiences, one codebase.**

| Module | Experience |
|---|---|
| 🦦 Assistant | Ask anything about SIT — answers grounded in the real SIT website, sources cited, spoken aloud |
| 🎭 Debate Arena | Argue live, by voice, against Singapore's voices of society |
| 🎧 Advisor Studio | One-on-one voice mentoring — CPF & HDB finance, study science |

Everything streams: tokens, speech, avatar motion.

---

## Architecture

```
Browser (React 19 + Tailwind 4)
  └─ useConversation hook ──SSE──▶ FastAPI (single process, single port)
       │                             ├─ Hybrid RAG: LanceDB vectors + BM25
       │                             ├─ LLM: Ollama (warm, fast-model routing)
       └─ CharacterAvatar            ├─ ElevenLabs scribe STT + turbo TTS
          (WebAudio lip sync)        └─ Local fallback: faster-whisper + Piper
```

- Zero cloud keys required — degrades gracefully to a fully local stack
- Deployed on the lab GPU server (conda env + models on NAS, CUDA Whisper)

---

## Retrieval that holds up

- Crawler renders SIT pages in **real Chrome** (the site blocks plain HTTP)
- 40 pages → 1000-char chunks → **LanceDB vectors + BM25**, merged & deduped
- SIT abbreviation expander: IWSP, SNAIC, AAI, OIP…
- Every answer cites its sources, on screen

> *"SIT offers… Accountancy, Aviation Management, Communications and Digital Media,
> Hospitality and Tourism Management, Food Business Management…"* — grounded, not guessed

---

## Avatars with real lip sync

- Semi-realistic **parametric SVG characters** — skull proportions, gradient skin,
  layered hair, clothing, age lines; blinking, gaze drift, breathing
- Mouth articulation driven by **live WebAudio analysis** of the speech:
  - energy envelope (fast attack, gated release) → **jaw drop**
  - high-frequency share → **lip spread**
  - teeth and tongue revealed with openness
- Runs in the browser at 60 fps — **zero server cost, zero added latency**

---

## Singapore-first voice profiling

- Per-persona **ElevenLabs Singaporean voices** (Singlish-friendly for Uncle),
  discovered and added programmatically (`setup_elevenlabs.py`)
- Audition kit: one sample clip per persona (`demo/voice_samples/`)
- US-accent narrators (Jack John, Abhi) reserved for the demo voiceover
- No key? **Piper + faster-whisper** take over automatically

---

## Latency engineering

| Technique | Effect |
|---|---|
| Sentence-streamed TTS | speech starts after the **first sentence**, not the full reply |
| Warm models (`keep_alive`, startup warm-up) | no cold-start on first question |
| Fast-model routing for short turns | full debate reply in **~1.5 s** |
| ElevenLabs turbo + SSE token streaming | **first audio ≈ 2 s** after send |

---

## Tested end-to-end

- **12-check browser E2E suite** — real Chrome, fake microphone:
  full voice loop (speak → transcribe → reply → summarize), RAG citations,
  first-audio latency budget, console hygiene — **12/12 passing**
- API smoke tests run against local **and** GPU-server deployments
- Demo video is **produced by the same automation**: scripted 1080p walkthrough,
  spoken clips captured on a real timeline, overlap-free narration with
  sidechain ducking

---

## Demo

🎬 `demo/SIT_AI_Platform_Demo.mp4` — 3 minutes, 1080p

1. Home — the three experiences
2. Assistant — grounded answer, cited sources, Ollie speaking in sync
3. Debate — Singapore Uncle opens, the user argues back **by voice**, one-tap summary
4. Advisor — CPF mentoring session
5. Fully self-hosted close

---

## What's next

- Photoreal talking heads (Wav2Lip / streaming avatar APIs) on the lab GPUs
- Multilingual: Mandarin, Malay, Tamil voice loops
- Larger SIT corpus + nightly re-crawl
- Campus kiosk mode & analytics dashboard

---

<!-- _class: lead invert -->

# Thank you

**github.com/Finance-LLMs/SIT-AI-Platform**

Abhay Shakya · @abhayshakya1
