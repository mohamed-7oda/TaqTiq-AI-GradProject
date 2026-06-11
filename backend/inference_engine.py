"""
inference_engine.py — Reusable CALF inference engine for the Flask backend.

Loads the model ONCE at startup (not per request) for fast inference.
Unloads CALF before TF feature extraction to avoid OOM on 8GB RAM machines.
"""

import os
import sys
import subprocess
import threading

import numpy as np
import torch

# Add the inference folder to Python path so we can import its modules
HERE = os.path.dirname(os.path.abspath(__file__))
INFERENCE_DIR = os.path.join(HERE, "Inference")
sys.path.insert(0, INFERENCE_DIR)

from model import ContextAwareModel
from dataset import SoccerNetClipsTesting
from preprocessing import batch2long, timestamps2long, NMS
from json_io import predictions2json
from config.classes import INVERSE_EVENT_DICTIONARY_V2


class InferenceEngine:
    """Loads model once, reuses it for many requests."""
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls, *args, **kwargs):
        # Singleton pattern
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self, model_ckpt=None, gpu=-1,
                 chunk_size=120, receptive_field=40, framerate=2,
                 num_features=512, dim_capsule=16):
        if hasattr(self, "_initialized"):
            return
        self._initialized = True
        
        if model_ckpt is None:
            model_ckpt = os.path.join(INFERENCE_DIR, "models", "CALF_finetuned", "model.pth.tar")
        
        self.model_ckpt = model_ckpt
        self.chunk_size = chunk_size
        self.receptive_field = receptive_field
        self.framerate = framerate
        self.num_features = num_features
        self.dim_capsule = dim_capsule
        self.device = torch.device("cuda" if (torch.cuda.is_available() and gpu >= 0) else "cpu")
        
        if not os.path.exists(model_ckpt):
            raise FileNotFoundError(f"Model checkpoint not found: {model_ckpt}")
        
        self.model = None
        self._reload_model()

    def _unload_model(self):
        if self.model is not None:
            del self.model
            self.model = None
            import gc
            gc.collect()
            torch.cuda.empty_cache()
            print("[InferenceEngine] CALF unloaded — RAM freed")

    def _reload_model(self):
        print(f"[InferenceEngine] Loading model from {self.model_ckpt} on {self.device}...")
        self.model = ContextAwareModel(
            input_size=self.num_features,
            num_classes=17,
            chunk_size=self.chunk_size * self.framerate,
            dim_capsule=self.dim_capsule,
            receptive_field=self.receptive_field * self.framerate,
            num_detections=15,
            framerate=self.framerate,
        ).to(self.device)
        ckpt = torch.load(self.model_ckpt, map_location=self.device, weights_only=False)
        self.model.load_state_dict(ckpt["state_dict"])
        self.model.eval()
        print("[InferenceEngine] CALF model loaded successfully")
    
    def extract_features(self, video_path, output_npy, fps=2.0, gpu=-1, progress_cb=None):
        """Run VideoFeatureExtractor.py as subprocess to extract features."""
        script = os.path.join(INFERENCE_DIR, "VideoFeatureExtractor.py")
        pca_file = os.path.join(INFERENCE_DIR, "pca_512_TF2.pkl")
        scaler_file = os.path.join(INFERENCE_DIR, "average_512_TF2.pkl")
        
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
        
        if progress_cb:
            progress_cb("extracting", "Extracting video features (this can take 5-10 min)...")
        
        print(f"[InferenceEngine] Extracting features: {video_path}")
        subprocess.run(cmd, check=True, cwd=INFERENCE_DIR)
        print(f"[InferenceEngine] Features saved to: {output_npy}")
    
    def run_inference(self, features_folder, feature_filename, output_path,
                      half=1, progress_cb=None):
        """Run CALF model on extracted features and write Predictions-v2.json."""
        if progress_cb:
            progress_cb("inferring", "Detecting events with CALF model...")
        
        test_dataset = SoccerNetClipsTesting(
            path=features_folder,
            features=feature_filename,
            framerate=self.framerate,
            chunk_size=self.chunk_size * self.framerate,
            receptive_field=self.receptive_field * self.framerate,
        )
        test_loader = torch.utils.data.DataLoader(
            test_dataset, batch_size=1, shuffle=False, num_workers=0
        )
        
        chunk_size_frames = self.model.chunk_size
        receptive_field_frames = self.model.receptive_field
        
        spotting_predictions = []
        with torch.no_grad():
            for feat, size in test_loader:
                feat = feat.to(self.device).squeeze(0).unsqueeze(1)
                _, output_spot = self.model(feat)
                
                size_int = int(size.item()) if torch.is_tensor(size) else int(size)
                ts = timestamps2long(output_spot.cpu().detach(), size_int,
                                     chunk_size_frames, receptive_field_frames)
                spotting_predictions.append(ts.numpy())
        
        detections = NMS(spotting_predictions[0], 20 * self.model.framerate)
        
        os.makedirs(output_path, exist_ok=True)
        predictions2json(detections, output_path, self.model.framerate, half=half)
        
        return os.path.join(output_path, "Predictions-v2.json")
    
    def process_video(self, video_path, output_path, fps=2.0, gpu=-1,
                      skip_extraction=False, progress_cb=None):
        """End-to-end: video → features → predictions JSON."""
        video_dir = os.path.dirname(video_path)
        video_name = os.path.basename(video_path)
        half_prefix = video_name.split("_")[0]
        try:
            half_num = int(half_prefix)
            if half_num not in (1, 2):
                half_num = 1
        except (ValueError, IndexError):
            half_num = 1
            half_prefix = "1"
        
        feat_filename = f"{half_prefix}_ResNET_TF2_PCA512.npy"
        feat_path = os.path.join(video_dir, feat_filename)
        
        # Step 1: Unload CALF to free RAM, then run TF feature extraction
        if skip_extraction and os.path.exists(feat_path):
            if progress_cb:
                progress_cb("skipped", "Using existing features")
        else:
            self._unload_model()        # free ~500MB before TF subprocess starts
            self.extract_features(video_path, feat_path, fps=fps, gpu=gpu,
                                  progress_cb=progress_cb)
            self._reload_model()        # reload CALF after TF subprocess has exited
        
        # Step 2: Run CALF inference (model is guaranteed loaded here)
        json_path = self.run_inference(
            features_folder=video_dir,
            feature_filename=feat_filename,
            output_path=output_path,
            half=half_num,
            progress_cb=progress_cb,
        )
        
        if progress_cb:
            progress_cb("done", "Complete!")
        
        return json_path