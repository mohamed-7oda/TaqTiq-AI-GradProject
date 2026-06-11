#!/bin/bash
set -e

MODEL_URL_BASE="https://huggingface.co/mohamed7oda/taqtiq-yolo/resolve/main"
AUTH_HEADER="Authorization: Bearer $HF_API_KEY"

download_if_missing() {
    local path="$1"
    local url="$2"
    if [ ! -f "$path" ]; then
        echo "Downloading $path..."
        mkdir -p "$(dirname "$path")"
        curl -L -H "$AUTH_HEADER" "$url" -o "$path"
        echo "Done: $path"
    fi
}

download_if_missing "Tracking/models/best.pt"                        "$MODEL_URL_BASE/best.pt"
download_if_missing "Inference/models/CALF_finetuned/model.pth.tar"  "$MODEL_URL_BASE/model.pth.tar"
download_if_missing "Inference/pca_512_TF2.pkl"                      "$MODEL_URL_BASE/pca_512_TF2.pkl"
download_if_missing "Inference/average_512_TF2.pkl"                  "$MODEL_URL_BASE/average_512_TF2.pkl"

exec gunicorn --bind 0.0.0.0:7860 --timeout 600 --workers 1 server:app
