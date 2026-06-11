"""
app.py — End-to-end inference on a single soccer video.

Pipeline:
  1_224p.mkv  →  ResNet152 features (2048-d)  →  PCA (512-d)  →  CALF model  →  Predictions-v2.json

Usage (from the Inference folder):
  python app.py --video "C:\path\to\1_224p.mkv"

Optional:
  python app.py --video "..." --output_path "predictions/Chelsea_Burnley" --skip_extraction
"""

import os
import sys
import argparse
import logging
import subprocess

import numpy as np
import torch

# Local imports (these files must exist in the same folder)
from model import ContextAwareModel
from dataset import SoccerNetClipsTesting
from preprocessing import batch2long, timestamps2long, NMS
from json_io import predictions2json


# ----------------------------------------------------------------------------- 
# Step 1: Feature extraction (calls VideoFeatureExtractor.py as a subprocess)
# ----------------------------------------------------------------------------- 
def extract_features(video_path, output_npy, fps=2.0, gpu=-1):
    """Run VideoFeatureExtractor.py to produce PCA-reduced 512-d features."""
    here = os.path.dirname(os.path.abspath(__file__))
    script = os.path.join(here, "VideoFeatureExtractor.py")
    pca_file = os.path.join(here, "pca_512_TF2.pkl")
    scaler_file = os.path.join(here, "average_512_TF2.pkl")

    for f in (script, pca_file, scaler_file):
        if not os.path.exists(f):
            raise FileNotFoundError(f"Required file missing: {f}")

    cmd = [
        sys.executable, script,
        "--path_video", video_path,
        "--path_features", output_npy,
        "--PCA", pca_file,
        "--PCA_scaler", scaler_file,
        "--FPS", str(fps),
        "--transform", "crop",
        "--back_end", "TF2",
        "--GPU", str(gpu),
        "--overwrite",
    ]
    print("\n[1/2] Extracting features...")
    print("Running:", " ".join(f'"{c}"' if " " in c else c for c in cmd))
    subprocess.run(cmd, check=True, cwd=here)
    print(f"✓ Features saved to: {output_npy}")


# ----------------------------------------------------------------------------- 
# Step 2: Run the CALF model on the features and write predictions JSON
# ----------------------------------------------------------------------------- 
def run_inference(features_folder, feature_filename, model_ckpt, output_path,
                  half=1, chunk_size=120, receptive_field=40, framerate=2,
                  num_features=512, dim_capsule=16, gpu=-1):
    device = torch.device("cuda" if (torch.cuda.is_available() and gpu >= 0) else "cpu")
    print(f"\n[2/2] Running CALF inference on {device}...")

    # Build model
    model = ContextAwareModel(
        input_size=num_features,
        num_classes=17,
        chunk_size=chunk_size * framerate,
        dim_capsule=dim_capsule,
        receptive_field=receptive_field * framerate,
        num_detections=15,
        framerate=framerate,
    ).to(device)

    if not os.path.exists(model_ckpt):
        raise FileNotFoundError(f"Model checkpoint not found: {model_ckpt}")
    ckpt = torch.load(model_ckpt, map_location=device, weights_only=False)
    model.load_state_dict(ckpt["state_dict"])
    model.eval()
    print(f"Loaded model from: {model_ckpt}")

    # Build dataset / loader
    test_dataset = SoccerNetClipsTesting(
        path=features_folder,
        features=feature_filename,
        framerate=framerate,
        chunk_size=chunk_size * framerate,
        receptive_field=receptive_field * framerate,
    )
    test_loader = torch.utils.data.DataLoader(
        test_dataset, batch_size=1, shuffle=False, num_workers=0
    )

    chunk_size_frames = model.chunk_size
    receptive_field_frames = model.receptive_field

    # Forward pass
    spotting_predictions = []
    segmentation_predictions = []
    with torch.no_grad():
        for feat, size in test_loader:
            feat = feat.to(device).squeeze(0).unsqueeze(1)  # (N_chunks, 1, T, D)
            output_seg, output_spot = model(feat)

            size_int = int(size.item()) if torch.is_tensor(size) else int(size)
            ts = timestamps2long(output_spot.cpu().detach(), size_int,
                                 chunk_size_frames, receptive_field_frames)
            seg = batch2long(output_seg.cpu().detach(), size_int,
                             chunk_size_frames, receptive_field_frames)
            spotting_predictions.append(ts.numpy())
            segmentation_predictions.append(seg.numpy())

    # NMS on detections
    detections = NMS(spotting_predictions[0], 20 * model.framerate)

    # Save JSON
    os.makedirs(output_path, exist_ok=True)
    predictions2json(detections, output_path, model.framerate, half=half)
    print(f"\nDone! Predictions saved to: {os.path.join(output_path, 'Predictions-v2.json')}")


# ----------------------------------------------------------------------------- 
# Main entry point
# ----------------------------------------------------------------------------- 
def main():
    parser = argparse.ArgumentParser(description="CALF end-to-end inference on a soccer video.")
    parser.add_argument("--video", required=True,
                        help="Full path to the input video, e.g. '...\\1_224p.mkv'")
    parser.add_argument("--model_ckpt", default="models/CALF_finetuned/model.pth.tar",
                        help="Path to the trained CALF checkpoint")
    parser.add_argument("--output_path", default="predictions/result",
                        help="Folder where Predictions-v2.json will be written")
    parser.add_argument("--gpu", type=int, default=-1, help="GPU id, or -1 for CPU")
    parser.add_argument("--fps", type=float, default=2.0)
    parser.add_argument("--chunk_size", type=int, default=120, help="seconds")
    parser.add_argument("--receptive_field", type=int, default=40, help="seconds")
    parser.add_argument("--skip_extraction", action="store_true",
                        help="Skip feature extraction if .npy already exists")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s [%(levelname)s] %(message)s")

    if not os.path.exists(args.video):
        raise FileNotFoundError(f"Video not found: {args.video}")

    # Derive feature path next to the video
    video_dir = os.path.dirname(args.video)
    video_name = os.path.basename(args.video)         # e.g. "1_224p.mkv"
    half_prefix = video_name.split("_")[0]            # "1" or "2"
    try:
        half_num = int(half_prefix)
    except ValueError:
        half_num = 1
    feat_filename = f"{half_prefix}_ResNET_TF2_PCA512.npy"
    feat_path = os.path.join(video_dir, feat_filename)

    # Step 1: extract features
    if args.skip_extraction and os.path.exists(feat_path):
        print(f"⏭  Skipping extraction — using existing: {feat_path}")
    else:
        extract_features(args.video, feat_path, fps=args.fps, gpu=args.gpu)

    # Step 2: inference
    run_inference(
        features_folder=video_dir,
        feature_filename=feat_filename,
        model_ckpt=args.model_ckpt,
        output_path=args.output_path,
        half=half_num,
        chunk_size=args.chunk_size,
        receptive_field=args.receptive_field,
        framerate=int(args.fps),
        gpu=args.gpu,
    )


if __name__ == "__main__":
    main()