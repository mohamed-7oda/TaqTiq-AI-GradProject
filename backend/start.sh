#!/bin/bash
set -e

MODEL_URL_BASE="https://huggingface.co/mohamed7oda/taqtiq-yolo/resolve/main"
AUTH_HEADER="Authorization: Bearer $HF_API_KEY"

if [ ! -f "Tracking/models/best.pt" ]; then
    echo "Downloading best.pt from HuggingFace..."
    mkdir -p Tracking/models
    curl -L -H "$AUTH_HEADER" "$MODEL_URL_BASE/best.pt" -o "Tracking/models/best.pt"
    echo "best.pt downloaded."
fi

if [ ! -f "Inference/models/CALF_finetuned/model.pth.tar" ]; then
    echo "Downloading model.pth.tar from HuggingFace..."
    mkdir -p Inference/models/CALF_finetuned
    curl -L -H "$AUTH_HEADER" "$MODEL_URL_BASE/model.pth.tar" -o "Inference/models/CALF_finetuned/model.pth.tar"
    echo "model.pth.tar downloaded."
fi

exec gunicorn --bind 0.0.0.0:7860 --timeout 600 --workers 1 server:app
