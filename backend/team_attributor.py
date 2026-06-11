"""
team_attributor.py
Uses Groq Vision (llama-4-scout) for team jersey detection and event attribution.
"""

import base64
import os
import time

import cv2
import requests

# ── Config ────────────────────────────────────────────────────────────────────
GROQ_API_KEY   = os.environ.get("GROQ_API_KEY", "")
GROQ_URL       = "https://api.groq.com/openai/v1/chat/completions"
GROQ_VIS_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

print(f"[TeamAttributor] Using Groq vision — model: {GROQ_VIS_MODEL}")

MIN_CONF = 0.50

ENRICH_LABELS = {
    "goal", "penalty", "offside", "foul", "corner", "throw-in", "clearance",
    "substitution", "shots on target", "shot on target",
    "shots off target", "shot off target",
    "direct free-kick", "indirect free-kick",
    "red card", "yellow card", "yellow->red card",
}

COLOR_SAMPLE_TIMES = (60, 90, 45, 120, 30)

COLOR_HEX = {
    "red": "#cc2200", "blue": "#1144cc", "green": "#15803d",
    "white": "#f0f0f0", "black": "#1a1a2e", "yellow": "#eab308",
    "orange": "#f97316", "purple": "#8b5cf6", "pink": "#ec4899",
    "gray": "#6b7280", "grey": "#6b7280", "navy": "#1e3a8a",
    "maroon": "#991b1b", "cyan": "#06b6d4", "teal": "#0d9488",
    "lime": "#84cc16", "brown": "#92400e", "dark": "#1a1a2e",
    "light": "#e2e8f0", "indigo": "#4338ca", "violet": "#7c3aed",
    "crimson": "#dc2626", "sky": "#0ea5e9",
}


# ── Frame helpers ─────────────────────────────────────────────────────────────
def _extract_frame(video_path: str, seconds: float):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None
    cap.set(cv2.CAP_PROP_POS_MSEC, seconds * 1000)
    ret, frame = cap.read()
    cap.release()
    return frame if ret else None


def _frame_to_b64(frame, max_dim: int = 480) -> str:
    h, w = frame.shape[:2]
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        frame = cv2.resize(frame, (int(w * scale), int(h * scale)),
                           interpolation=cv2.INTER_AREA)
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return base64.b64encode(buf.tobytes()).decode("utf-8")


# ── Groq Vision call ──────────────────────────────────────────────────────────
def _groq_vision(b64_image: str, prompt: str, retries: int = 2) -> str:
    for attempt in range(retries + 1):
        try:
            resp = requests.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type":  "application/json",
                },
                json={
                    "model": GROQ_VIS_MODEL,
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "image_url",
                             "image_url": {"url": f"data:image/jpeg;base64,{b64_image}"}},
                            {"type": "text", "text": prompt},
                        ],
                    }],
                    "max_tokens": 20,
                    "temperature": 0,
                },
                timeout=30,
            )

            if resp.status_code == 429:
                print("[TeamAttributor] Groq rate limit — waiting 10s…")
                time.sleep(10)
                continue

            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip().lower()

        except Exception as exc:
            print(f"[TeamAttributor] Groq vision failed (attempt {attempt + 1}): {exc}")
            if attempt < retries:
                time.sleep(2)

    return ""


# ── Colour detection ──────────────────────────────────────────────────────────
def detect_team_colors(video_path: str):
    frame = None
    for t in COLOR_SAMPLE_TIMES:
        frame = _extract_frame(video_path, t)
        if frame is not None:
            break

    if frame is None:
        print("[TeamAttributor] Could not extract frame — using fallback colours")
        return "#cc2200", "red", "#1144cc", "blue"

    b64 = _frame_to_b64(frame, max_dim=480)

    try:
        prompt = (
            "This is a football (soccer) match frame. "
            "What are the two jersey colors worn by the two teams? "
            "Reply with exactly two color words separated by a comma, e.g.: red, blue. "
            "Only use simple color names: red, blue, green, white, black, yellow, "
            "orange, purple, pink, gray, navy."
        )
        answer = _groq_vision(b64, prompt)
        print(f"[TeamAttributor] Color detection answer: '{answer}'")

        parts = [p.strip().split()[0] for p in answer.split(",") if p.strip()]
        name1 = parts[0] if len(parts) > 0 else "red"
        name2 = parts[1] if len(parts) > 1 else "blue"

        if name1 == name2:
            name2 = "blue" if name1 != "blue" else "red"

        hex1 = COLOR_HEX.get(name1, "#cc2200")
        hex2 = COLOR_HEX.get(name2, "#1144cc")

        print(f"[TeamAttributor] Team 1: {name1} ({hex1}), Team 2: {name2} ({hex2})")
        return hex1, name1, hex2, name2

    except Exception as exc:
        print(f"[TeamAttributor] Colour detection failed: {exc}")

    return "#cc2200", "red", "#1144cc", "blue"


# ── Team attribution per event ────────────────────────────────────────────────
def _attribute_team(frame_b64: str, event_label: str,
                    color1: str, color2: str) -> str:
    try:
        prompt = (
            f"This is a football (soccer) match frame. "
            f"A '{event_label}' is happening. "
            f"One team wears {color1} jerseys (Team 1) and the other wears {color2} jerseys (Team 2). "
            f"Which team is performing this {event_label}? "
            f"Reply with only one word: '{color1}', '{color2}', or 'unknown'."
        )
        answer = _groq_vision(frame_b64, prompt)

        if color1 in answer:
            return "Team 1"
        if color2 in answer:
            return "Team 2"
        return "Unknown"

    except Exception as exc:
        print(f"[TeamAttributor] Attribution failed: {exc}")
        return "Unknown"


# ── Main entry point ──────────────────────────────────────────────────────────
def enrich_predictions(video_path: str, predictions_dict: dict,
                       progress_cb=None) -> dict:
    preds = predictions_dict.get("predictions", [])
    if not preds:
        return predictions_dict

    qualifying = [
        p for p in preds
        if p.get("label", "").lower() in ENRICH_LABELS
        and float(p.get("confidence", 0)) >= MIN_CONF
    ]

    if not qualifying:
        print("[TeamAttributor] No qualifying events to enrich.")
        return predictions_dict

    if progress_cb:
        progress_cb("team_colors", "Detecting team jersey colours…")
    hex1, name1, hex2, name2 = detect_team_colors(video_path)

    predictions_dict["team_colors"] = {
        "team1": {"hex": hex1, "name": name1},
        "team2": {"hex": hex2, "name": name2},
    }

    total = len(qualifying)
    print(f"[TeamAttributor] Enriching {total} events…")

    for idx, pred in enumerate(qualifying, 1):
        label   = pred.get("label", "event")
        pos_ms  = int(pred.get("position", 0))
        seconds = pos_ms / 1000.0

        if progress_cb:
            progress_cb(
                "team_attribution",
                f"Attributing team ({idx}/{total}): {label} @ {seconds:.0f}s…",
            )

        frame = _extract_frame(video_path, seconds)
        if frame is None:
            frame = _extract_frame(video_path, max(0.0, seconds - 0.5))

        if frame is None:
            pred["team"]       = "Unknown"
            pred["team_color"] = None
            print(f"  [{idx}/{total}] {label} @ {seconds:.0f}s → frame missing")
            continue

        b64    = _frame_to_b64(frame)
        result = _attribute_team(b64, label, name1, name2)

        pred["team"]       = result
        pred["team_color"] = hex1 if result == "Team 1" else \
                             (hex2 if result == "Team 2" else None)
        print(f"  [{idx}/{total}] {label} @ {seconds:.0f}s → {result}")

        time.sleep(0.5)

    return predictions_dict