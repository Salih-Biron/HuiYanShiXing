#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
yolo detect train \
  data="${YOLO_DATA:-$ROOT/datasets/camera_fall_v2_yolo/data.yaml}" \
  model="${YOLO_MODEL:-$ROOT/weights/yolo/best.pt}" \
  epochs="${YOLO_EPOCHS:-40}" imgsz=960 batch=4 workers=2 \
  project="$ROOT/outputs/yolo_finetune" name=camera_fall_v2
