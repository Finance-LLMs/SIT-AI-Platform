# SIT AI Platform — Unified Redesign Spec

Date: 2026-10-06 · Author: Abhay (prabal@orochiverse.com) + Claude
Status: Executed autonomously per user directive ("redesign end to end"); review and correct after the fact.

## Problem

Four separate Finance-LLMs repos (AI-debate-bot, SIT-chatbot, Institute-Chatbot-RAG,
Personality-Voice-Interaction) are ~16k lines of duplicated vanilla-JS wrappers around
ElevenLabs Conversational AI. Only Institute-Chatbot-RAG has real intelligence (hybrid
LanceDB+BM25 RAG over scraped SIT pages, GPT-4.1-mini). Every repo re-implements the same
signed-URL backend, avatar-sync hack, and "try 6 SDK method names" summary button. No live
API keys exist in the repos (committed .env files are placeholders), so the old apps cannot
even run without per-app ElevenLabs dashboard agents.

## Decision: one platform, three modules, fully self-hosted

**SIT AI Platform** — a single modern web app with shared voice/avatar/LLM infrastructure:

1. **Assistant** — SIT Q&A chat (otter mascot): text + push-to-talk voice, hybrid RAG
   answers streamed token-by-token, spoken aloud via TTS, avatar synced to speaking state.
2. **Debate Arena** — pick a persona (Nelson Mandela, Taylor Swift, Michelle, Singapore
   Uncle) and a topic, hold a live voice debate. Summarize-debate action preserved.
3. **Advisor Studio** — personality voice advisors (finance advisor persona from
   Personality-Voice-Interaction), topic chips, conversation summary.

All intelligence moves **on-prem to Deathstar (192.168.3.6)**: no ElevenLabs, no OpenAI
required (both remain optional env-var upgrades).

## Tech stack (fresh)

| Layer | Choice | Replaces |
|---|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS 4 + Framer Motion | 4× vanilla JS/webpack |
| Backend | FastAPI (Python 3.11), single app, SSE streaming | 2× Express + 2× FastAPI duplicates |
| LLM | Ollama (qwen2.5:7b-instruct) on Deathstar GPUs | ElevenLabs-hosted LLM / GPT-4.1-mini |
| Embeddings | Ollama nomic-embed-text | text-embedding-3-small |
| Retrieval | LanceDB vectors + rank-bm25 hybrid (kept — it was the good part) | — |
| STT | ElevenLabs scribe_v1 (key set) → faster-whisper GPU fallback | per-app ElevenLabs agents |
| TTS | ElevenLabs Singaporean voices (key set) → Piper fallback | ElevenLabs dashboard agents |
| Avatars | Parametric SVG characters, mouths lip-synced to live TTS audio | looping MP4s |
| Demo video | Playwright 1080p walkthrough + Singaporean-narrated MP4 | — |

Provider abstraction is a thin env-var switch (ELEVENLABS_API_KEY / OPENAI_API_KEY
present → cloud; absent → fully local). No plugin framework.

### Singapore-specific update (same day, user request)

All personas, prompts, avatars and voices are Singapore-specific: Ollie the Otter
(assistant), Mr. Tan (elder statesman), Jia Hui (heartland pop idol), Prof. Devi
(public intellectual), Singapore Uncle (kopitiam, Singlish), Arjun (CPF/HDB finance
mentor) and Dr. Mei (study coach). `backend/setup_elevenlabs.py` discovers and adds
Singaporean-accent voices from the ElevenLabs library and writes
`backend/el_voices.json` (persona → voice id, plus a demo narrator). Avatars are
drawn in `CharacterAvatar.tsx` (flat-illustration SVG; otter + parametric faces) and
lip-sync by driving the mouth from a WebAudio analyser on the playing TTS audio.

## Architecture

```
sit-platform/
  backend/
    app.py          FastAPI: routes, SSE chat streaming, static serving of frontend dist
    rag.py          hybrid retrieve (LanceDB + BM25), abbreviation expansion, query prep
    ingest.py       scrape SIT sitemap pages → clean → chunk(1000/150) → embed → LanceDB
    llm.py          Ollama client (chat stream + embeddings), OpenAI optional
    speech.py       faster-whisper STT, Piper TTS, persona→voice map
    personas.py     persona registry: id, name, system prompt, voice, avatar, topics
  frontend/         Vite+React+TS+Tailwind SPA (Home, Assistant, Debate, Advisor)
  demo/             record_demo.py (Playwright) → demo.mp4
  deploy/           deploy.sh (rsync to NAS, micromamba env, run), README
```

### API

- `GET  /api/health` — component status (llm, stt, tts, rag)
- `GET  /api/personas` — registry for all modules
- `POST /api/chat` — `{module, persona_id, messages[], rag}` → SSE token stream; RAG
  sources appended as a final SSE event
- `POST /api/stt` — multipart audio (webm/wav) → `{text}`
- `POST /api/tts` — `{text, persona_id}` → audio/wav stream
- Frontend served from `frontend/dist` by the same FastAPI app (one process, one port)

### Voice loop (replaces ElevenLabs Conversational AI)

Browser MediaRecorder + AnalyserNode silence detection → `/api/stt` → transcript shown
(review-before-send preserved from SIT-chatbot) → `/api/chat` SSE → tokens render live →
sentence-buffered `/api/tts` → playback drives avatar speaking state.

### Preserved from the old apps

Persona→agent mapping, topic dynamic variables, summarize action, avatar speaking-state
sync, push-to-talk with transcript review, hybrid retrieval, abbreviation cache, concise
answer prompt, otter mascot, SIT branding.

### Fixed from the old apps

Client-side API keys (gone — nothing secret in the browser), path-traversal upload
filenames, fake SSE streaming (now real token streaming), duplicated backends, dead code.

## Deployment

- Project lives at `/media/nas_mount/Abhay/sit-platform` on Deathstar.
- Conda env at `/media/nas_mount/Abhay/conda_envs/sit-platform` (micromamba, python 3.11,
  same pattern as the user's existing env_build.log).
- Ollama already installed at /usr/local/bin/ollama; models pulled: qwen2.5:7b-instruct,
  nomic-embed-text. GPU: faster-whisper on CUDA.
- Frontend built on the Mac (node 26), dist shipped with rsync.

## Testing / loop engineering

Build→run→Playwright QA→fix loop until green: health endpoint, chat round-trip with RAG,
STT round-trip with a fixture wav, TTS returns audio, each module page renders and
navigates. Demo video is recorded by the same Playwright harness once QA passes.

## Out of scope (YAGNI)

Auth, user accounts, conversation persistence, admin UI, lip-sync models, websockets
(SSE suffices), multi-language UI, Docker.
