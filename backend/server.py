# backend/server.py
import os, uuid, json, threading, traceback, subprocess, shutil, secrets, smtplib

# Load .env if present (so HF_API_KEY and other secrets don't need to be in the shell)
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(_env_path):
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                os.environ.setdefault(_k.strip(), _v.strip())
from datetime import datetime, timedelta
from collections import Counter
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import numpy as np

class _NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)

def _to_python(obj):
    """Recursively convert numpy scalars/arrays to native Python types."""
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, dict):
        return {k: _to_python(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_python(v) for v in obj]
    return obj

from huggingface_hub import InferenceClient
# DB drivers imported conditionally below after DATABASE_URL is read
import bcrypt
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token,
    jwt_required, get_jwt_identity, get_jwt,
)
from werkzeug.utils import secure_filename

from inference_engine import InferenceEngine
from tracking_engine import TrackingEngine
from team_attributor import enrich_predictions

# ─────────────────────────── Config ─────────────────────────────────────────
HERE          = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(HERE, "uploads")
RESULTS_FOLDER= os.path.join(HERE, "results")
ALLOWED_EXTENSIONS = {"mp4", "mkv", "avi", "mov", "webm"}
MAX_UPLOAD_SIZE    = 2 * 1024 * 1024 * 1024

# ── Highlights generation ────────────────────────────────────────────────────
HIGHLIGHT_EVENTS = {
    "goal", "yellow card", "red card", "yellow->red card",
    "shots on target", "shot on target",
    "shots off target", "shot off target",
    "corner", "penalty", "foul",
    "direct free-kick", "indirect free-kick",
    "offside",
}
CLIP_BEFORE_SECS   = 5.0   # seconds to include before each event
CLIP_AFTER_SECS    = 7.0   # seconds to include after each event
HIGHLIGHT_MIN_CONF = 0.50  # minimum confidence to include an event
MAX_HIGHLIGHT_CLIPS = 40   # cap to avoid extremely long videos

DATABASE_URL = os.environ.get("DATABASE_URL", "")
IS_POSTGRES  = bool(DATABASE_URL)
SQL_NOW      = "NOW()" if IS_POSTGRES else "GETDATE()"

if IS_POSTGRES:
    import psycopg2, psycopg2.extras
    def get_db():
        return psycopg2.connect(DATABASE_URL)
else:
    import pyodbc
    _DB_CONN_STR = (
        "DRIVER={ODBC Driver 17 for SQL Server};"
        "SERVER=LAPTOP-BQ4FQFIA\\SQLEXPRESS;"
        "DATABASE=GradProject;"
        "Trusted_Connection=yes;"
    )
    class _Cur:
        """Wraps pyodbc cursor to accept %s-style params (same as psycopg2)."""
        def __init__(self, c): self._c = c
        def execute(self, sql, params=None):
            sql = sql.replace("%s", "?")
            self._c.execute(sql, params) if params else self._c.execute(sql)
            return self
        def fetchone(self):  return self._c.fetchone()
        def fetchall(self):  return self._c.fetchall()
        @property
        def rowcount(self):  return self._c.rowcount
    class _Conn:
        """Wraps pyodbc connection to return _Cur cursors."""
        def __init__(self, c): self._c = c
        def cursor(self):  return _Cur(self._c.cursor())
        def commit(self):  self._c.commit()
        def close(self):   self._c.close()
    def get_db():
        return _Conn(pyodbc.connect(_DB_CONN_STR))

# HuggingFace — chatbot
HF_API_KEY   = os.environ.get("HF_API_KEY", "")
HF_CHAT_MODEL = "Qwen/Qwen2.5-7B-Instruct"

# Groq — vision only (team classification in team_attributor.py)
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

# Email config for password reset (Gmail SMTP)
EMAIL_HOST     = "smtp.gmail.com"
EMAIL_PORT     = 587
EMAIL_USER     = os.environ.get("EMAIL_USER", "")
EMAIL_PASSWORD = os.environ.get("EMAIL_PASSWORD", "")
FRONTEND_URL   = os.environ.get("FRONTEND_URL", "http://localhost:3000")

ANALYST_SYSTEM_PROMPT = (
    "You are an expert football (soccer) analyst with deep knowledge of tactics, "
    "player performance, statistics, and the game at all levels. Your role is to:\n"
    "- Analyze match events, statistics, and patterns from provided match data\n"
    "- Give professional, data-driven insights about goals, fouls, cards, shots, and other events\n"
    "- Answer specific questions about a match when data is provided\n"
    "- Provide general football knowledge, tactical analysis, and clear explanations\n"
    "- Be concise, insightful, and use appropriate football terminology\n\n"
    "When match data is provided refer to specific events and statistics. "
    "Always be analytical and professional."
)

os.makedirs(UPLOAD_FOLDER,  exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

app = Flask(__name__)
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_SIZE

# Change this to a long random string before deploying.
app.config["JWT_SECRET_KEY"]          = os.environ.get("JWT_SECRET_KEY", "change-this-before-deploying")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=7)
jwt = JWTManager(app)

jwt_blacklist: set[str] = set()

@jwt.token_in_blocklist_loader
def check_if_revoked(_jwt_header, jwt_payload):
    return jwt_payload["jti"] in jwt_blacklist


# ─────────────────────────── DB helper (defined above with driver) ───────────


# ─────────────────────────── ML engines ─────────────────────────────────────
print("[Server] Loading event-detection engine...")
event_engine = InferenceEngine(gpu=-1)
print("[Server] Loading tracking engine...")
tracking_engine = TrackingEngine(device="cpu")
print("[Server] Ready!")

jobs: dict      = {}
jobs_lock       = threading.Lock()


# ─────────────────────────── Shared helpers ──────────────────────────────────
def allowed_file(fname):
    return "." in fname and fname.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def update_job(job_id, **kwargs):
    with jobs_lock:
        if job_id in jobs:
            jobs[job_id].update(kwargs)

def enrich_event_results(predictions_dict):
    """Convert raw model output into the enriched list + counts used by all callers."""
    preds = predictions_dict.get("predictions", [])
    enriched = []
    for p in preds:
        try:
            conf = float(p["confidence"])
        except Exception:
            conf = 0.0
        if conf < 0:
            continue
        position_ms = int(p.get("position", "0"))
        enriched.append({
            "label":            p["label"],
            "gameTime":         p["gameTime"],
            "position_ms":      position_ms,
            "position_seconds": position_ms / 1000.0,
            "half":             p["half"],
            "confidence":       round(conf, 4),
            "team":             p.get("team"),
            "team_color":       p.get("team_color"),
        })
    enriched.sort(key=lambda e: e["position_ms"])
    counts = dict(Counter(e["label"] for e in enriched))
    return enriched, counts

def save_to_history(job_id):
    """Persist a completed job to AnalysisHistory. Called from background threads."""
    with jobs_lock:
        job = dict(jobs.get(job_id, {}))  # shallow copy, no long lock hold

    if not job or job.get("status") != "completed":
        return
    user_id = job.get("user_id")
    if not user_id:
        return

    mode           = job.get("mode")
    video_filename = job.get("video_filename", "")

    if mode == "events":
        predictions      = job.get("predictions", {})
        enriched, counts = enrich_event_results(predictions)
        total_events     = len(enriched)
        event_counts_json = json.dumps(counts, cls=_NumpyEncoder)
        results_json = json.dumps({
            "total_events": total_events,
            "event_counts": counts,
            "events":       enriched,
            "team_colors":  predictions.get("team_colors"),
        }, cls=_NumpyEncoder)
    else:
        stats            = job.get("stats", {})
        total_events     = None
        event_counts_json = None
        results_json     = json.dumps({"stats": stats}, cls=_NumpyEncoder)

    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO AnalysisHistory "
            "(UserID, JobID, VideoFileName, Mode, TotalEvents, EventCountsJSON, ResultsJSON) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (user_id, job_id, video_filename, mode,
             total_events, event_counts_json, results_json),
        )
        conn.commit()
        conn.close()
        print(f"[History] Saved job {job_id} for user {user_id}")
    except Exception as e:
        traceback.print_exc()
        print(f"[History] Failed to save job {job_id}: {e}")


# ─────────────────────────── Highlights helpers ──────────────────────────────
def _ffmpeg_path():
    return shutil.which("ffmpeg") or shutil.which("ffmpeg.exe")

def _get_video_duration(video_path):
    ffprobe = shutil.which("ffprobe") or shutil.which("ffprobe.exe")
    if not ffprobe:
        return None
    try:
        r = subprocess.run(
            [ffprobe, "-v", "quiet", "-show_entries", "format=duration",
             "-of", "csv=p=0", video_path],
            capture_output=True, text=True, timeout=30,
        )
        return float(r.stdout.strip())
    except Exception:
        return None

def _merge_intervals(intervals):
    """Merge a list of (start, end) float pairs into non-overlapping segments."""
    if not intervals:
        return []
    intervals = sorted(intervals)
    merged = list([list(intervals[0])])
    for start, end in intervals[1:]:
        if start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return [(s, e) for s, e in merged]

def _generate_highlights(job_id, video_path, events, output_dir):
    """
    Filter important high-confidence events, extract clips with ffmpeg,
    concatenate into a single highlights.mp4.
    Returns the output path on success, or None on failure/skip.
    """
    ffmpeg = _ffmpeg_path()
    if not ffmpeg:
        print("[Highlights] ffmpeg not found — skipping highlights generation")
        return None

    # Filter by event type and confidence
    important = [
        e for e in events
        if e.get("label", "").lower() in HIGHLIGHT_EVENTS
        and float(e.get("confidence", 0)) >= HIGHLIGHT_MIN_CONF
    ]
    if not important:
        print(f"[Highlights] No qualifying events for job {job_id}")
        return None

    # Sort chronologically, then keep at most MAX_HIGHLIGHT_CLIPS (prefer highest confidence)
    important.sort(key=lambda e: e["position_seconds"])
    if len(important) > MAX_HIGHLIGHT_CLIPS:
        important = sorted(important, key=lambda e: -e.get("confidence", 0))[:MAX_HIGHLIGHT_CLIPS]
        important.sort(key=lambda e: e["position_seconds"])

    duration = _get_video_duration(video_path)

    # Build and merge time intervals
    raw_intervals = []
    for e in important:
        pos   = float(e["position_seconds"])
        start = max(0.0, pos - CLIP_BEFORE_SECS)
        end   = pos + CLIP_AFTER_SECS
        if duration:
            end = min(duration, end)
        raw_intervals.append((start, end))
    merged = _merge_intervals(raw_intervals)

    # Extract one clip per merged interval
    clips_dir = os.path.join(output_dir, "hl_clips")
    os.makedirs(clips_dir, exist_ok=True)
    clip_paths = []

    for i, (start, end) in enumerate(merged):
        clip_path = os.path.join(clips_dir, f"clip_{i:04d}.mp4")
        cmd = [
            ffmpeg, "-y",
            "-i", video_path,
            "-ss", f"{start:.3f}",
            "-to", f"{end:.3f}",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "aac",
            "-map", "0:v:0",
            "-map", "0:a:0?",      # optional audio — won't fail if absent
            "-avoid_negative_ts", "make_zero",
            clip_path,
        ]
        r = subprocess.run(cmd, capture_output=True, timeout=300)
        if r.returncode == 0 and os.path.exists(clip_path):
            clip_paths.append(clip_path)
        else:
            print(f"[Highlights] Clip {i} failed: {r.stderr.decode(errors='replace')[-300:]}")

    if not clip_paths:
        print(f"[Highlights] No clips extracted for job {job_id}")
        return None

    # Write concat list (forward slashes for ffmpeg on Windows)
    filelist = os.path.join(clips_dir, "list.txt")
    with open(filelist, "w", encoding="utf-8") as f:
        for cp in clip_paths:
            safe = cp.replace("\\", "/")
            f.write(f"file '{safe}'\n")

    # Concatenate
    highlights_path = os.path.join(output_dir, "highlights.mp4")
    cmd = [
        ffmpeg, "-y",
        "-f", "concat", "-safe", "0",
        "-i", filelist,
        "-c", "copy",
        highlights_path,
    ]
    r = subprocess.run(cmd, capture_output=True, timeout=600)
    if r.returncode != 0:
        print(f"[Highlights] Concat failed: {r.stderr.decode(errors='replace')[-300:]}")
        return None

    print(f"[Highlights] Ready for job {job_id} — {len(clip_paths)} clips, "
          f"{len(important)} events")
    return highlights_path, len(important), len(clip_paths)

def _run_highlights(job_id, video_path, output_dir):
    """Background thread: generate highlights and update job dict."""
    with jobs_lock:
        job = dict(jobs.get(job_id, {}))
    enriched, _ = enrich_event_results(job.get("predictions", {}))

    result = _generate_highlights(job_id, video_path, enriched, output_dir)
    if result:
        path, event_count, clip_count = result
        update_job(job_id,
                   highlights_status="ready",
                   highlights_path=path,
                   highlights_event_count=event_count,
                   highlights_clip_count=clip_count)
    else:
        update_job(job_id, highlights_status="unavailable")


# ─────────────────────────── Annotation helpers ─────────────────────────────
OVERLAY_EVENTS = {
    "Goal":        ("GOAL",         "0x15803d"),
    "Penalty":     ("PENALTY",      "0x9a3412"),
    "Yellow card": ("YELLOW CARD",  "0x92400e"),
    "Red card":    ("RED CARD",     "0x991b1b"),
    "Foul":        ("FOUL",         "0xb45309"),
    "Corner":      ("CORNER",       "0x1e40af"),
}
ANNOTATION_MIN_CONF = 0.50
OVERLAY_SHOW_SECS   = 4.0
OVERLAY_FADE_SECS   = 0.4


def _find_font():
    candidates = [
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/calibrib.ttf",
        "C:/Windows/Fonts/calibri.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None


def _annotate_video(ffmpeg_exe, video_path, events, output_path):
    qualifying = sorted(
        [e for e in events
         if float(e.get("confidence", 0)) >= ANNOTATION_MIN_CONF
         and e.get("label") in OVERLAY_EVENTS],
        key=lambda e: e["position_seconds"],
    )

    base_cmd = [
        ffmpeg_exe, "-y", "-i", video_path,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
    ]

    if not qualifying:
        subprocess.run(base_cmd + [output_path],
                       capture_output=True, check=True, timeout=600)
        return

    font_path = _find_font()
    # Build one drawtext filter per event (text + box + fade alpha)
    filters = []
    for evt in qualifying:
        ts = float(evt["position_seconds"])
        te = ts + OVERLAY_SHOW_SECS
        fd = OVERLAY_FADE_SECS
        label, box_hex = OVERLAY_EVENTS[evt["label"]]

        font_opt = ""
        if font_path:
            # Forward slashes; colon after drive letter is safe inside single quotes
            fp = font_path.replace("\\", "/")
            font_opt = f":fontfile='{fp}'"

        # Fade in for fd seconds, hold, fade out for fd seconds
        alpha_expr = (
            f"if(lt(t,{ts+fd:.3f}),(t-{ts:.3f})/{fd:.3f},"
            f"if(gt(t,{te-fd:.3f}),({te:.3f}-t)/{fd:.3f},1))"
        )

        filters.append(
            f"drawtext=text='{label}'"
            f"{font_opt}"
            f":fontsize=28"
            f":fontcolor=white"
            f":box=1"
            f":boxcolor={box_hex}@0.90"
            f":boxborderw=10"
            f":x=w-tw-22:y=22"
            f":enable='between(t,{ts:.3f},{te:.3f})'"
            f":alpha='{alpha_expr}'"
        )

    vf = ",".join(filters)
    result = subprocess.run(
        base_cmd + ["-vf", vf, output_path],
        capture_output=True, text=True, timeout=600,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg annotation failed:\n{result.stderr[-400:]}")
    print(f"[Annotate] {len(qualifying)} overlay(s) applied → {output_path}")


def _run_analytics(job_id, video_path, output_dir):
    """Background thread: compute tactical analytics for event-detection jobs."""
    try:
        def cb(stage, msg):
            update_job(job_id, analytics_status=stage, analytics_message=msg)
        update_job(job_id, analytics_status="processing",
                   analytics_message="Starting analytics pipeline…")
        stats = tracking_engine.compute_analytics(
            video_path=video_path,
            output_dir=output_dir,
            progress_cb=cb,
        )
        update_job(job_id, analytics_status="ready", analytics_stats=_to_python(stats))
        print(f"[Analytics] Ready for job {job_id}")
    except Exception as e:
        traceback.print_exc()
        print(f"[Analytics] Failed for job {job_id}: {e}")
        update_job(job_id, analytics_status="failed")


def _run_annotation(job_id, video_path, output_dir):
    ffmpeg = _ffmpeg_path()
    if not ffmpeg:
        update_job(job_id, annotated_status="unavailable")
        return
    with jobs_lock:
        job = dict(jobs.get(job_id, {}))
    enriched, _ = enrich_event_results(job.get("predictions", {}))
    output_path = os.path.join(output_dir, "annotated.mp4")
    try:
        _annotate_video(ffmpeg, video_path, enriched, output_path)
        update_job(job_id, annotated_status="ready", annotated_path=output_path)
    except Exception as e:
        traceback.print_exc()
        print(f"[Annotate] Failed for job {job_id}: {e}")
        update_job(job_id, annotated_status="unavailable")


# ─────────────────────────── Job runners ────────────────────────────────────
def run_event_detection(job_id, video_path, output_dir):
    try:
        def cb(stage, msg):
            update_job(job_id, status=stage, message=msg)
        update_job(job_id, status="processing", message="Starting event detection...")
        json_path = event_engine.process_video(
            video_path=video_path, output_path=output_dir, progress_cb=cb
        )
        with open(json_path) as f:
            predictions = json.load(f)

        # ── Team attribution ─────────────────────────────────────────────────
        try:
            predictions = enrich_predictions(video_path, predictions, progress_cb=cb)
            has_team = any(p.get("team") and p["team"] != "Unknown"
                           for p in predictions.get("predictions", []))
            print(f"[TeamAttributor] Enrichment complete — team data present: {has_team}")
        except Exception:
            traceback.print_exc()
            print(f"[TeamAttributor] Enrichment failed for job {job_id} — continuing without team data")

        update_job(job_id, status="completed", message="Done!",
                   result_path=json_path, predictions=predictions,
                   highlights_status="generating",
                   annotated_status="generating")
        save_to_history(job_id)
        threading.Thread(
            target=_run_highlights,
            args=(job_id, video_path, output_dir),
            daemon=True,
        ).start()
        threading.Thread(
            target=_run_annotation,
            args=(job_id, video_path, output_dir),
            daemon=True,
        ).start()
    except Exception as e:
        traceback.print_exc()
        update_job(job_id, status="failed", message=str(e), error=str(e))

def run_tracking(job_id, video_path, output_dir):
    try:
        def cb(stage, msg):
            update_job(job_id, status=stage, message=msg)
        update_job(job_id, status="processing", message="Starting tracking...")
        out_video, report_path, stats = tracking_engine.process_video(
            video_path=video_path, output_dir=output_dir, progress_cb=cb,
        )
        update_job(job_id, status="completed", message="Done!",
                   video_path=out_video, report_path=report_path,
                   stats=_to_python(stats))
        save_to_history(job_id)
    except Exception as e:
        traceback.print_exc()
        update_job(job_id, status="failed", message=str(e), error=str(e))


# ─────────────────────────── Auth routes ─────────────────────────────────────
@app.route("/api/auth/register", methods=["POST"])
def register():
    data      = request.get_json(silent=True) or {}
    full_name = data.get("fullName", "").strip()
    email     = data.get("email",    "").strip().lower()
    password  = data.get("password", "")

    if not full_name or not email or not password:
        return jsonify({"error": "All fields are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    try:
        conn   = get_db()
        cursor = conn.cursor()
        if IS_POSTGRES:
            cursor.execute(
                "INSERT INTO Users (FullName, Email, PasswordHash) "
                "VALUES (%s, %s, %s) RETURNING UserID",
                (full_name, email, password_hash),
            )
        else:
            cursor.execute(
                "INSERT INTO Users (FullName, Email, PasswordHash) "
                "OUTPUT INSERTED.UserID VALUES (?, ?, ?)",
                (full_name, email, password_hash),
            )
        user_id = int(cursor.fetchone()[0])
        conn.commit()
        conn.close()
    except Exception as _e:
        if "unique" in str(_e).lower() or "duplicate" in str(_e).lower() or "23505" in str(_e) or "23000" in str(_e):
            return jsonify({"error": "Email is already registered"}), 409
        traceback.print_exc()
        return jsonify({"error": f"Database error: {_e}"}), 500

    token = create_access_token(identity=str(user_id))
    return jsonify({
        "token": token,
        "user":  {"id": user_id, "fullName": full_name, "email": email},
    }), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data     = request.get_json(silent=True) or {}
    email    = data.get("email",    "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT UserID, FullName, Email, PasswordHash FROM Users WHERE Email = %s",
            (email,),
        )
        row = cursor.fetchone()
        conn.close()
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Database error: {e}"}), 500

    if not row or not bcrypt.checkpw(password.encode("utf-8"), row[3].encode("utf-8")):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_access_token(identity=str(row[0]))
    return jsonify({
        "token": token,
        "user":  {"id": row[0], "fullName": row[1], "email": row[2]},
    })


@app.route("/api/auth/logout", methods=["POST"])
@jwt_required()
def logout():
    jwt_blacklist.add(get_jwt()["jti"])
    return jsonify({"message": "Logged out successfully"})


# ─── Password reset helpers ───────────────────────────────────────────────────
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")

def _send_reset_email(to_email: str, reset_url: str):
    html = f"""
    <div style="font-family:sans-serif;background:#0f172a;color:#f1f5f9;padding:40px;max-width:520px;margin:auto;border-radius:16px;">
      <h2 style="margin:0 0 8px;">&#x26BD; TaqTiq AI</h2>
      <p style="color:#94a3b8;margin:0 0 24px;">Password Reset Request</p>
      <p>We received a request to reset your password. Click the button below — this link expires in <strong>1 hour</strong>.</p>
      <a href="{reset_url}"
         style="display:inline-block;margin:24px 0;padding:14px 28px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:white;font-weight:600;font-size:1rem;border-radius:10px;text-decoration:none;">
        Reset Password
      </a>
      <p style="color:#64748b;font-size:0.85rem;">If you didn't request this, you can safely ignore this email. Your password will not change.</p>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:24px 0;">
      <p style="color:#475569;font-size:0.8rem;">TaqTiq AI · AI-Powered Soccer Analytics</p>
    </div>
    """

    import urllib.request, json as _json
    payload = _json.dumps({
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": EMAIL_USER, "name": "TaqTiq AI"},
        "subject": "Reset Your Password — TaqTiq AI",
        "content": [{"type": "text/html", "value": html}],
    }).encode()
    req = urllib.request.Request(
        "https://api.sendgrid.com/v3/mail/send",
        data=payload,
        headers={
            "Authorization": f"Bearer {SENDGRID_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        if resp.status >= 400:
            raise Exception(f"SendGrid error {resp.status}")


@app.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    data  = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "Email is required"}), 400

    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT UserID FROM Users WHERE Email = %s", (email,))
        row = cursor.fetchone()

        if not row:
            conn.close()
            # Don't reveal whether the email exists
            return jsonify({"message": "If that email is registered you will receive a reset link shortly."}), 200

        user_id = row[0]
        token   = secrets.token_urlsafe(32)
        expires = datetime.now() + timedelta(hours=1)

        cursor.execute("DELETE FROM PasswordResetTokens WHERE UserID = %s", (user_id,))
        cursor.execute(
            "INSERT INTO PasswordResetTokens (UserID, Token, ExpiresAt) VALUES (%s, %s, %s)",
            (user_id, token, expires),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Database error: {e}"}), 500

    reset_url = f"{FRONTEND_URL}?reset_token={token}"
    try:
        _send_reset_email(email, reset_url)
        print(f"[Auth] Password reset email sent to {email}")
    except Exception as e:
        traceback.print_exc()
        print(f"[Auth] Failed to send reset email — USER={EMAIL_USER!r} HOST={EMAIL_HOST} ERR={e}")
        return jsonify({"error": "Failed to send email. Check server email configuration."}), 500

    return jsonify({"message": "If that email is registered you will receive a reset link shortly."}), 200


@app.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    data        = request.get_json(silent=True) or {}
    token       = data.get("token", "").strip()
    new_password = data.get("password", "")

    if not token or not new_password:
        return jsonify({"error": "Token and new password are required"}), 400
    if len(new_password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT UserID, ExpiresAt FROM PasswordResetTokens WHERE Token = %s", (token,)
        )
        row = cursor.fetchone()

        if not row:
            conn.close()
            return jsonify({"error": "Invalid or expired reset link. Please request a new one."}), 400

        user_id, expires_at = row[0], row[1]
        if datetime.now() > expires_at:
            cursor.execute("DELETE FROM PasswordResetTokens WHERE Token = %s", (token,))
            conn.commit()
            conn.close()
            return jsonify({"error": "Reset link has expired. Please request a new one."}), 400

        password_hash = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        cursor.execute("UPDATE Users SET PasswordHash = %s WHERE UserID = %s", (password_hash, user_id))
        cursor.execute("DELETE FROM PasswordResetTokens WHERE UserID = %s", (user_id,))
        conn.commit()
        conn.close()
        print(f"[Auth] Password reset successfully for user {user_id}")
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Database error: {e}"}), 500

    return jsonify({"message": "Password reset successfully. You can now sign in."}), 200


@app.route("/api/auth/change-password", methods=["POST"])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    current_password = data.get("currentPassword", "")
    new_password     = data.get("newPassword", "")

    if not current_password or not new_password:
        return jsonify({"error": "Both current and new password are required"}), 400
    if len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400

    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT PasswordHash FROM Users WHERE UserID = %s", (user_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return jsonify({"error": "User not found"}), 404

        if not bcrypt.checkpw(current_password.encode("utf-8"), row[0].encode("utf-8")):
            conn.close()
            return jsonify({"error": "Current password is incorrect"}), 400

        new_hash = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        cursor.execute("UPDATE Users SET PasswordHash = %s WHERE UserID = %s", (new_hash, user_id))
        conn.commit()
        conn.close()
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Database error: {e}"}), 500

    return jsonify({"message": "Password changed successfully"}), 200


@app.route("/api/auth/me", methods=["GET"])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT UserID, FullName, Email FROM Users WHERE UserID = %s", (user_id,)
        )
        row = cursor.fetchone()
        conn.close()
    except Exception as e:
        return jsonify({"error": f"Database error: {e}"}), 500

    if not row:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"id": row[0], "fullName": row[1], "email": row[2]})


# ─────────────────────────── Profile routes ──────────────────────────────────
@app.route("/api/profile", methods=["GET"])
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()
    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT u.UserID, u.FullName, u.Email, "
            "  p.PhoneNumber, p.DateOfBirth, p.Country, p.City, "
            "  p.Organization, p.Role, p.Bio, p.UpdatedAt "
            "FROM Users u "
            "LEFT JOIN UserProfiles p ON u.UserID = p.UserID "
            "WHERE u.UserID = %s",
            (user_id,),
        )
        row = cursor.fetchone()
        conn.close()
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Database error: {e}"}), 500

    if not row:
        return jsonify({"error": "User not found"}), 404

    return jsonify({
        "id":           row[0],
        "fullName":     row[1],
        "email":        row[2],
        "phoneNumber":  row[3],
        "dateOfBirth":  row[4].isoformat() if row[4] else None,
        "country":      row[5],
        "city":         row[6],
        "organization": row[7],
        "role":         row[8],
        "bio":          row[9],
        "updatedAt":    row[10].isoformat() if row[10] else None,
    })


@app.route("/api/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}

    full_name = data.get("fullName", "").strip()
    phone     = data.get("phoneNumber",  "").strip() or None
    dob       = data.get("dateOfBirth")              or None
    country   = data.get("country",      "").strip() or None
    city      = data.get("city",         "").strip() or None
    org       = data.get("organization", "").strip() or None
    role      = data.get("role",         "").strip() or None
    bio       = data.get("bio",          "").strip() or None

    try:
        conn   = get_db()
        cursor = conn.cursor()

        if full_name:
            cursor.execute(
                "UPDATE Users SET FullName = %s WHERE UserID = %s",
                (full_name, user_id),
            )

        cursor.execute(
            "SELECT ProfileID FROM UserProfiles WHERE UserID = %s", (user_id,)
        )
        if cursor.fetchone():
            cursor.execute(
                f"UPDATE UserProfiles "
                f"SET PhoneNumber=%s, DateOfBirth=%s, Country=%s, City=%s, "
                f"    Organization=%s, Role=%s, Bio=%s, UpdatedAt={SQL_NOW} "
                f"WHERE UserID=%s",
                (phone, dob, country, city, org, role, bio, user_id),
            )
        else:
            cursor.execute(
                "INSERT INTO UserProfiles "
                "(UserID, PhoneNumber, DateOfBirth, Country, City, Organization, Role, Bio) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                (user_id, phone, dob, country, city, org, role, bio),
            )

        conn.commit()
        conn.close()
        return jsonify({"message": "Profile updated successfully"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Database error: {e}"}), 500


# ─────────────────────────── History routes ──────────────────────────────────
@app.route("/api/history", methods=["GET"])
@jwt_required()
def get_history():
    user_id = get_jwt_identity()
    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT HistoryID, JobID, VideoFileName, Mode, TotalEvents, "
            "       EventCountsJSON, AnalyzedAt "
            "FROM AnalysisHistory "
            "WHERE UserID = %s "
            "ORDER BY AnalyzedAt DESC",
            (user_id,),
        )
        rows = cursor.fetchall()
        cursor.execute(
            "SELECT HistoryID, TagID, Label FROM AnalysisTags "
            "WHERE UserID = %s ORDER BY CreatedAt",
            (user_id,),
        )
        tag_rows = cursor.fetchall()
        conn.close()
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Database error: {e}"}), 500

    tags_map = {}
    for tr in tag_rows:
        tags_map.setdefault(tr[0], []).append({"tagId": tr[1], "label": tr[2]})

    history = []
    for r in rows:
        history.append({
            "historyId":     r[0],
            "jobId":         r[1],
            "videoFileName": r[2],
            "mode":          r[3],
            "totalEvents":   r[4],
            "eventCounts":   json.loads(r[5]) if r[5] else None,
            "analyzedAt":    r[6].isoformat() if r[6] else None,
            "tags":          tags_map.get(r[0], []),
        })

    return jsonify({"history": history, "total": len(history)})


@app.route("/api/history/<int:history_id>", methods=["GET", "DELETE"])
@jwt_required()
def history_item(history_id):
    user_id = get_jwt_identity()

    if request.method == "DELETE":
        try:
            conn   = get_db()
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM AnalysisHistory WHERE HistoryID = %s AND UserID = %s",
                (history_id, user_id),
            )
            deleted = cursor.rowcount
            conn.commit()
            conn.close()
        except Exception as e:
            traceback.print_exc()
            return jsonify({"error": f"Database error: {e}"}), 500

        if deleted == 0:
            return jsonify({"error": "Not found or not authorized"}), 404
        return jsonify({"success": True}), 200

    # GET
    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT HistoryID, JobID, VideoFileName, Mode, TotalEvents, "
            "       EventCountsJSON, ResultsJSON, AnalyzedAt "
            "FROM AnalysisHistory "
            "WHERE HistoryID = %s AND UserID = %s",
            (history_id, user_id),
        )
        r = cursor.fetchone()
        conn.close()
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Database error: {e}"}), 500

    if not r:
        return jsonify({"error": "Not found"}), 404

    return jsonify({
        "historyId":     r[0],
        "jobId":         r[1],
        "videoFileName": r[2],
        "mode":          r[3],
        "totalEvents":   r[4],
        "eventCounts":   json.loads(r[5]) if r[5] else None,
        "results":       json.loads(r[6]) if r[6] else None,
        "analyzedAt":    r[7].isoformat() if r[7] else None,
    })


# ─────────────────────────── Tags routes ────────────────────────────────────
@app.route("/api/history/<int:history_id>/tags", methods=["GET", "POST"])
@jwt_required()
def history_tags(history_id):
    user_id = get_jwt_identity()
    if request.method == "POST":
        data  = request.get_json(silent=True) or {}
        label = (data.get("label") or "").strip()[:100]
        if not label:
            return jsonify({"error": "Label required"}), 400
        try:
            conn   = get_db()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT 1 FROM AnalysisHistory WHERE HistoryID=%s AND UserID=%s",
                (history_id, user_id),
            )
            if not cursor.fetchone():
                conn.close()
                return jsonify({"error": "Not found"}), 404
            if IS_POSTGRES:
                cursor.execute(
                    "INSERT INTO AnalysisTags (UserID, HistoryID, Label) "
                    "VALUES (%s, %s, %s) RETURNING TagID, CreatedAt",
                    (user_id, history_id, label),
                )
            else:
                cursor.execute(
                    "INSERT INTO AnalysisTags (UserID, HistoryID, Label) "
                    "OUTPUT INSERTED.TagID, INSERTED.CreatedAt VALUES (?, ?, ?)",
                    (user_id, history_id, label),
                )
            row = cursor.fetchone()
            conn.commit()
            conn.close()
            return jsonify({
                "tagId":     row[0],
                "label":     label,
                "createdAt": row[1].isoformat() if row[1] else None,
            }), 201
        except Exception as e:
            if "UQ_AnalysisTags_Unique" in str(e):
                return jsonify({"error": "Tag already exists"}), 409
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500

    # GET
    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT TagID, Label, CreatedAt FROM AnalysisTags "
            "WHERE HistoryID=%s AND UserID=%s ORDER BY CreatedAt",
            (history_id, user_id),
        )
        rows = cursor.fetchall()
        conn.close()
        return jsonify({"tags": [
            {"tagId": r[0], "label": r[1],
             "createdAt": r[2].isoformat() if r[2] else None}
            for r in rows
        ]})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/history/<int:history_id>/tags/<int:tag_id>", methods=["DELETE"])
@jwt_required()
def delete_history_tag(history_id, tag_id):
    user_id = get_jwt_identity()
    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM AnalysisTags WHERE TagID=%s AND HistoryID=%s AND UserID=%s",
            (tag_id, history_id, user_id),
        )
        deleted = cursor.rowcount
        conn.commit()
        conn.close()
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    if deleted == 0:
        return jsonify({"error": "Not found"}), 404
    return jsonify({"success": True})


# ─────────────────────────── Notes routes ────────────────────────────────────
@app.route("/api/history/<int:history_id>/notes", methods=["GET", "POST"])
@jwt_required()
def history_notes(history_id):
    user_id = get_jwt_identity()
    if request.method == "POST":
        data      = request.get_json(silent=True) or {}
        note_text = (data.get("noteText") or "").strip()
        if not note_text:
            return jsonify({"error": "Note text required"}), 400
        try:
            conn   = get_db()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT 1 FROM AnalysisHistory WHERE HistoryID=%s AND UserID=%s",
                (history_id, user_id),
            )
            if not cursor.fetchone():
                conn.close()
                return jsonify({"error": "Not found"}), 404
            if IS_POSTGRES:
                cursor.execute(
                    "INSERT INTO MatchNotes (HistoryID, UserID, NoteText) "
                    "VALUES (%s, %s, %s) RETURNING NoteID, CreatedAt",
                    (history_id, user_id, note_text),
                )
            else:
                cursor.execute(
                    "INSERT INTO MatchNotes (HistoryID, UserID, NoteText) "
                    "OUTPUT INSERTED.NoteID, INSERTED.CreatedAt VALUES (?, ?, ?)",
                    (history_id, user_id, note_text),
                )
            row = cursor.fetchone()
            conn.commit()
            conn.close()
            ts = row[1].isoformat() if row[1] else None
            return jsonify({
                "noteId":    row[0],
                "noteText":  note_text,
                "createdAt": ts,
                "updatedAt": ts,
            }), 201
        except Exception as e:
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500

    # GET
    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT NoteID, NoteText, CreatedAt, UpdatedAt FROM MatchNotes "
            "WHERE HistoryID=%s AND UserID=%s ORDER BY CreatedAt",
            (history_id, user_id),
        )
        rows = cursor.fetchall()
        conn.close()
        return jsonify({"notes": [
            {"noteId":    r[0], "noteText": r[1],
             "createdAt": r[2].isoformat() if r[2] else None,
             "updatedAt": r[3].isoformat() if r[3] else None}
            for r in rows
        ]})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/history/<int:history_id>/notes/<int:note_id>", methods=["PUT", "DELETE"])
@jwt_required()
def history_note(history_id, note_id):
    user_id = get_jwt_identity()
    if request.method == "DELETE":
        try:
            conn   = get_db()
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM MatchNotes WHERE NoteID=%s AND HistoryID=%s AND UserID=%s",
                (note_id, history_id, user_id),
            )
            deleted = cursor.rowcount
            conn.commit()
            conn.close()
        except Exception as e:
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500
        if deleted == 0:
            return jsonify({"error": "Not found"}), 404
        return jsonify({"success": True})

    # PUT
    data      = request.get_json(silent=True) or {}
    note_text = (data.get("noteText") or "").strip()
    if not note_text:
        return jsonify({"error": "Note text required"}), 400
    try:
        conn   = get_db()
        cursor = conn.cursor()
        if IS_POSTGRES:
            cursor.execute(
                "UPDATE MatchNotes SET NoteText=%s, UpdatedAt=NOW() "
                "WHERE NoteID=%s AND HistoryID=%s AND UserID=%s "
                "RETURNING UpdatedAt",
                (note_text, note_id, history_id, user_id),
            )
        else:
            cursor.execute(
                "UPDATE MatchNotes SET NoteText=?, UpdatedAt=GETDATE() "
                "OUTPUT INSERTED.UpdatedAt "
                "WHERE NoteID=? AND HistoryID=? AND UserID=?",
                (note_text, note_id, history_id, user_id),
            )
        row = cursor.fetchone()
        conn.commit()
        conn.close()
        if not row:
            return jsonify({"error": "Not found"}), 404
        return jsonify({
            "noteId":    note_id,
            "noteText":  note_text,
            "updatedAt": row[0].isoformat() if row[0] else None,
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ─────────────────────────── Core app routes ─────────────────────────────────
@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/upload", methods=["POST"])
@jwt_required()
def upload_video():
    if "video" not in request.files:
        return jsonify({"error": "No video file"}), 400
    file = request.files["video"]
    mode = request.form.get("mode", "events")
    if mode not in ("events", "tracking"):
        return jsonify({"error": "Invalid mode"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": "Bad extension"}), 400

    user_id    = get_jwt_identity()
    job_id     = uuid.uuid4().hex[:12]
    job_upload  = os.path.join(UPLOAD_FOLDER,  job_id)
    job_results = os.path.join(RESULTS_FOLDER, job_id)
    os.makedirs(job_upload,  exist_ok=True)
    os.makedirs(job_results, exist_ok=True)

    original_name = secure_filename(file.filename)
    ext       = original_name.rsplit(".", 1)[1].lower()
    save_path = os.path.join(job_upload, f"1_224p.{ext}")
    file.save(save_path)

    with jobs_lock:
        jobs[job_id] = {
            "id": job_id, "mode": mode, "status": "queued",
            "message": "Queued", "video_filename": original_name,
            "uploaded_at": datetime.now().isoformat(),
            "user_id": user_id,
            "upload_path": save_path,
        }

    target = run_event_detection if mode == "events" else run_tracking
    threading.Thread(target=target, args=(job_id, save_path, job_results), daemon=True).start()
    return jsonify({"job_id": job_id, "mode": mode, "status": "queued"})


@app.route("/api/status/<job_id>")
def status(job_id):
    with jobs_lock:
        job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "not found"}), 404
    return jsonify({
        "id": job["id"], "mode": job["mode"], "status": job["status"],
        "message": job["message"], "video_filename": job.get("video_filename"),
    })


@app.route("/api/results/<job_id>")
def results(job_id):
    with jobs_lock:
        job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "not found"}), 404
    if job["status"] != "completed":
        return jsonify({"error": "not done", "status": job["status"]}), 400

    if job["mode"] == "events":
        predictions = job.get("predictions", {})
        enriched, counts = enrich_event_results(predictions)
        return jsonify({
            "id": job["id"], "mode": "events",
            "video_filename": job.get("video_filename"),
            "total_events":  len(enriched),
            "event_counts":  counts,
            "events":        enriched,
            "team_colors":   predictions.get("team_colors"),
        })
    else:
        has_report = bool(job.get("report_path") and os.path.exists(job["report_path"]))
        return jsonify({
            "id": job["id"], "mode": "tracking",
            "video_filename": job.get("video_filename"),
            "video_url": f"/api/video/{job_id}",
            "report_url": f"/api/report/{job_id}" if has_report else None,
            "stats": job.get("stats", {}),
        })


@app.route("/api/video/<job_id>")
def serve_video(job_id):
    with jobs_lock:
        job = jobs.get(job_id)
    if not job or "video_path" not in job:
        return jsonify({"error": "video not ready"}), 404
    return send_file(job["video_path"], mimetype="video/mp4",
                     as_attachment=False, conditional=True)


@app.route("/api/report/<job_id>")
def serve_report(job_id):
    with jobs_lock:
        job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "not found"}), 404
    report_path = job.get("report_path")
    if not report_path or not os.path.exists(report_path):
        return jsonify({"error": "report not available"}), 404
    return send_file(report_path, mimetype="text/html")


@app.route("/api/original_video/<job_id>")
def serve_original_video(job_id):
    with jobs_lock:
        job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "not found"}), 404
    upload_path = job.get("upload_path")
    if not upload_path or not os.path.exists(upload_path):
        return jsonify({"error": "original video not found"}), 404
    ext = upload_path.rsplit(".", 1)[-1].lower()
    mime_map = {
        "mp4": "video/mp4", "mkv": "video/x-matroska",
        "avi": "video/x-msvideo", "mov": "video/quicktime",
        "webm": "video/webm",
    }
    mimetype = mime_map.get(ext, "video/mp4")
    return send_file(upload_path, mimetype=mimetype, as_attachment=False, conditional=True)


@app.route("/api/annotated_video/<job_id>")
def serve_annotated_video(job_id):
    with jobs_lock:
        job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "not found"}), 404
    if job.get("annotated_status") != "ready":
        return jsonify({"error": "not ready", "status": job.get("annotated_status", "unavailable")}), 404
    path = job.get("annotated_path")
    if not path or not os.path.exists(path):
        return jsonify({"error": "file not found"}), 404
    return send_file(path, mimetype="video/mp4", as_attachment=False, conditional=True)


# ── Highlights status (no JWT – job_id is opaque, same pattern as /api/status)
@app.route("/api/highlights/status/<job_id>")
def highlights_status(job_id):
    with jobs_lock:
        job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "not found"}), 404
    hl_status = job.get("highlights_status", "unavailable")
    return jsonify({
        "status":      hl_status,
        "eventCount":  job.get("highlights_event_count"),
        "clipCount":   job.get("highlights_clip_count"),
    })


@app.route("/api/analytics/status/<job_id>")
def analytics_status(job_id):
    with jobs_lock:
        job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "not found"}), 404
    status = job.get("analytics_status", "unavailable")
    return jsonify({
        "status":  status,
        "message": job.get("analytics_message", ""),
        "stats":   job.get("analytics_stats") if status == "ready" else None,
    })


@app.route("/api/highlights/<job_id>")
def serve_highlights(job_id):
    with jobs_lock:
        job = jobs.get(job_id)
    if not job or job.get("highlights_status") != "ready":
        return jsonify({"error": "highlights not ready"}), 404
    as_download = request.args.get("download") == "1"
    return send_file(
        job["highlights_path"],
        mimetype="video/mp4",
        as_attachment=as_download,
        download_name="highlights.mp4",
        conditional=True,
    )


# ─────────────────────────── HD Highlights ───────────────────────────────────
def _run_hd_highlights(job_id, video_path, output_dir):
    """Background thread: re-encode highlights at higher quality (CRF 18, slow preset)."""
    ffmpeg = _ffmpeg_path()
    if not ffmpeg:
        update_job(job_id, hd_status="unavailable")
        return

    with jobs_lock:
        job = dict(jobs.get(job_id, {}))
    enriched, _ = enrich_event_results(job.get("predictions", {}))

    important = [
        e for e in enriched
        if e.get("label", "").lower() in HIGHLIGHT_EVENTS
        and float(e.get("confidence", 0)) >= HIGHLIGHT_MIN_CONF
    ]
    if not important:
        update_job(job_id, hd_status="unavailable")
        return

    important.sort(key=lambda e: e["position_seconds"])
    if len(important) > MAX_HIGHLIGHT_CLIPS:
        important = sorted(important, key=lambda e: -e.get("confidence", 0))[:MAX_HIGHLIGHT_CLIPS]
        important.sort(key=lambda e: e["position_seconds"])

    duration = _get_video_duration(video_path)
    raw_intervals = []
    for e in important:
        pos   = float(e["position_seconds"])
        start = max(0.0, pos - CLIP_BEFORE_SECS)
        end   = min(duration, pos + CLIP_AFTER_SECS) if duration else pos + CLIP_AFTER_SECS
        raw_intervals.append((start, end))
    merged = _merge_intervals(raw_intervals)

    clips_dir = os.path.join(output_dir, "hd_clips")
    os.makedirs(clips_dir, exist_ok=True)
    clip_paths = []

    for i, (start, end) in enumerate(merged):
        clip_path = os.path.join(clips_dir, f"clip_{i:04d}.mp4")
        cmd = [
            ffmpeg, "-y",
            "-i", video_path,
            "-ss", f"{start:.3f}", "-to", f"{end:.3f}",
            "-vf", "unsharp=3:3:1.0:3:3:0.0",   # sharpen only — no upscale
            "-c:v", "libx264", "-preset", "medium", "-crf", "17",
            "-maxrate", "6M", "-bufsize", "12M",
            "-c:a", "aac", "-b:a", "256k",
            "-map", "0:v:0", "-map", "0:a:0?",
            "-avoid_negative_ts", "make_zero",
            clip_path,
        ]
        r = subprocess.run(cmd, capture_output=True, timeout=600)
        if r.returncode == 0 and os.path.exists(clip_path):
            clip_paths.append(clip_path)

    if not clip_paths:
        update_job(job_id, hd_status="unavailable")
        return

    filelist = os.path.join(clips_dir, "list.txt")
    with open(filelist, "w", encoding="utf-8") as f:
        for cp in clip_paths:
            f.write(f"file '{cp.replace(chr(92), '/')}'\n")

    output_path = os.path.join(output_dir, "highlights_hd.mp4")
    cmd = [
        ffmpeg, "-y",
        "-f", "concat", "-safe", "0", "-i", filelist,
        "-c", "copy",          # clips are already encoded — just mux
        "-movflags", "+faststart",
        output_path,
    ]
    r = subprocess.run(cmd, capture_output=True, timeout=600)

    if r.returncode == 0 and os.path.exists(output_path):
        update_job(job_id, hd_status="ready", hd_highlights_path=output_path)
        print(f"[HD Highlights] Ready for job {job_id}")
    else:
        update_job(job_id, hd_status="unavailable")
        print(f"[HD Highlights] Encoding failed for job {job_id}")


@app.route("/api/highlights/hd/<job_id>", methods=["POST"])
def request_hd_highlights(job_id):
    with jobs_lock:
        job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "not found"}), 404
    current = job.get("hd_status", "none")
    if current in ("generating", "ready"):
        return jsonify({"status": current}), 200

    upload_path = job.get("upload_path")
    if not upload_path or not os.path.exists(upload_path):
        return jsonify({"error": "original video not found"}), 404

    job_results = os.path.join(RESULTS_FOLDER, job_id)
    update_job(job_id, hd_status="generating")
    threading.Thread(
        target=_run_hd_highlights,
        args=(job_id, upload_path, job_results),
        daemon=True,
    ).start()
    print(f"[HD Highlights] Started for job {job_id}")
    return jsonify({"status": "generating"}), 200


@app.route("/api/highlights/hd/status/<job_id>")
def hd_highlights_status(job_id):
    with jobs_lock:
        job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "not found"}), 404
    return jsonify({"status": job.get("hd_status", "none")})


@app.route("/api/highlights/hd/serve/<job_id>")
def serve_hd_highlights(job_id):
    with jobs_lock:
        job = jobs.get(job_id)
    if not job or job.get("hd_status") != "ready":
        return jsonify({"error": "not ready"}), 404
    path = job.get("hd_highlights_path")
    if not path or not os.path.exists(path):
        return jsonify({"error": "file not found"}), 404
    as_download = request.args.get("download") == "1"
    return send_file(
        path, mimetype="video/mp4",
        as_attachment=as_download,
        download_name="highlights_hd.mp4",
        conditional=True,
    )


# ─────────────────────────── Chat (AI analyst) ──────────────────────────────
def _format_match_context(match_context: dict) -> str:
    lines = ["=== MATCH DATA ==="]
    events = match_context.get("events", [])

    if events:
        valid = [e for e in events if e.get("confidence", 0) >= 0.50]
        counts = Counter(e.get("label", "Unknown") for e in valid)
        lines.append(f"Detected events (confidence ≥50%): {len(valid)}")
        lines.append("Overall breakdown: " + ", ".join(f"{l}: {c}" for l, c in sorted(counts.items(), key=lambda x: -x[1])))

        lines.append("\nFull timeline:")
        for e in sorted(valid, key=lambda x: x.get("position_seconds", 0)):
            t   = e.get("gameTime", "?")
            lbl = e.get("label", "?")
            cf  = e.get("confidence", 0)
            h   = e.get("half", "")
            lines.append(f"  {t}{' H'+str(h) if h else ''}: {lbl} ({cf:.0%})")

    stats = match_context.get("stats", {})
    if stats:
        lines.append("\nTracking stats: " + "; ".join(
            f"{k}={v}" for k, v in stats.items() if not isinstance(v, (dict, list))
        ))
    return "\n".join(lines)



@app.route("/api/chat", methods=["POST"])
@jwt_required()
def chat():
    body     = request.get_json(silent=True) or {}
    messages = body.get("messages", [])
    ctx      = body.get("match_context")

    if not messages:
        return jsonify({"error": "No messages provided"}), 400

    system_text = ANALYST_SYSTEM_PROMPT
    if ctx:
        system_text += "\n\n" + _format_match_context(ctx)

    api_msgs = [{"role": "system", "content": system_text}] + messages

    try:
        hf_client = InferenceClient(api_key=HF_API_KEY)
        resp = hf_client.chat.completions.create(
            model=HF_CHAT_MODEL,
            messages=api_msgs,
            max_tokens=800,
            temperature=0.7,
        )
        reply = resp.choices[0].message.content
        return jsonify({"reply": reply})
    except Exception as exc:
        print(f"[Chat] Error: {exc}")
        return jsonify({"error": "AI service error. Please try again."}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
