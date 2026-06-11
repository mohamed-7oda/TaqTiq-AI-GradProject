#!/bin/bash
set -e

MODEL_PATH="Tracking/models/best.pt"
MODEL_URL="https://huggingface.co/mohamed7oda/taqtiq-yolo/resolve/main/best.pt"

if [ ! -f "$MODEL_PATH" ]; then
    echo "Downloading best.pt from HuggingFace..."
    mkdir -p Tracking/models
    curl -L -H "Authorization: Bearer $HF_API_KEY" "$MODEL_URL" -o "$MODEL_PATH"
    echo "Model downloaded."
fi

exec gunicorn --bind 0.0.0.0:7860 --timeout 600 --workers 1 server:app
