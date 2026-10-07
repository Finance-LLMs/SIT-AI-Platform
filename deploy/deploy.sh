#!/usr/bin/env bash
# Deploy SIT AI Platform to Deathstar (research3@192.168.3.6), everything on NAS.
set -euo pipefail

HOST=research3@192.168.3.6
DEST=/media/nas_mount/Abhay/sit-platform
ENV=/media/nas_mount/Abhay/conda_envs/sit-platform
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> building frontend"
(cd "$ROOT/frontend" && npm run build)

echo "==> rsync project"
rsync -az --delete \
  --exclude '.venv' --exclude 'node_modules' --exclude 'demo/out' \
  --exclude 'frontend/src' --exclude 'frontend/public' --exclude '.git' \
  "$ROOT/" "$HOST:$DEST/"

echo "==> conda env + deps (NAS prefix)"
ssh "$HOST" "
  set -e
  /opt/anaconda/anaconda3/bin/conda create -y -q -p $ENV python=3.11 2>/dev/null || true
  $ENV/bin/pip install -q -r $DEST/backend/requirements.txt
  $ENV/bin/pip install -q nvidia-cublas-cu12 nvidia-cudnn-cu12  # faster-whisper CUDA libs
"

echo "==> restart backend"
ssh "$HOST" "bash $DEST/deploy/run_server.sh"

echo "==> deployed: http://192.168.3.6:8090"
