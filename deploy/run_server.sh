#!/usr/bin/env bash
# (Re)start the SIT AI Platform backend on Deathstar. Idempotent.
set -euo pipefail

DEST=/media/nas_mount/Abhay/sit-platform
ENV=/media/nas_mount/Abhay/conda_envs/sit-platform
LOG=/media/nas_mount/Abhay/sit-platform/backend.log

# user-level ollama with models on NAS (root disk is full)
if ! curl -s --max-time 2 localhost:11435/api/tags > /dev/null; then
  OLLAMA_MODELS=/media/nas_mount/Abhay/ollama_models OLLAMA_HOST=127.0.0.1:11435 \
    nohup ollama serve > /media/nas_mount/Abhay/ollama_serve.log 2>&1 &
  sleep 3
fi

pkill -f "uvicorn app:app --host 0.0.0.0 --port ${APP_PORT:-8090}" 2>/dev/null || true
sleep 1

CUDNN=$("$ENV/bin/python" -c "import site, glob; print(':'.join(glob.glob(site.getsitepackages()[0] + '/nvidia/*/lib')))")

cd "$DEST/backend"
[ -f .env ] && set -a && . ./.env && set +a
OLLAMA_URL=http://127.0.0.1:11435 \
CHAT_MODEL=qwen2.5:7b-instruct \
WHISPER_MODEL=medium WHISPER_DEVICE=cuda \
CUDA_VISIBLE_DEVICES=${CUDA_VISIBLE_DEVICES:-3} \
LD_LIBRARY_PATH="$CUDNN:${LD_LIBRARY_PATH:-}" \
HF_HOME=/media/nas_mount/Abhay/hf_cache \
nohup "$ENV/bin/uvicorn" app:app --host 0.0.0.0 --port ${APP_PORT:-8090} > "$LOG" 2>&1 &

sleep 6
curl -s localhost:${APP_PORT:-8090}/api/health && echo " — backend up (log: $LOG)"
