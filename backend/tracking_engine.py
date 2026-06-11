# backend/tracking_engine.py
"""Reusable tracking engine — model loaded once."""
import os
import sys
import threading
import shutil
import subprocess
import numpy as np
import cv2

HERE = os.path.dirname(os.path.abspath(__file__))
TRACKING_DIR = os.path.join(HERE, "Tracking")

# Add Tracking/ to sys.path so its sub-packages are importable as top-level
if TRACKING_DIR not in sys.path:
    sys.path.insert(0, TRACKING_DIR)

from trackers import Tracker
from team_assigner import TeamAssigner
from player_ball_assigner import PlayerBallAssigner
from view_transformer import ViewTransformer
from speed_and_distance_estimator import SpeedAndDistance_Estimator
from camera_movement_estimator import CameraMovementEstimator
from utils import video_frame_iter, get_video_info
from report_generator import ReportGenerator


class TrackingEngine:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, model_path=None, device="cpu"):
        if hasattr(self, "_initialized"):
            return
        self._initialized = True

        if model_path is None:
            model_path = os.path.join(TRACKING_DIR, "models", "best.pt")
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"YOLO model not found: {model_path}")

        print(f"[TrackingEngine] Loading YOLO from {model_path} (device={device})...")
        self.tracker = Tracker(model_path, device=device)
        self.device = device

        # ---- ffmpeg discovery ----
        self.ffmpeg_path = shutil.which("ffmpeg")
        if self.ffmpeg_path:
            print(f"[TrackingEngine] ✓ ffmpeg found at: {self.ffmpeg_path}")
        else:
            print("[TrackingEngine] ⚠ ffmpeg NOT found — video may not play in browser!")
            print("                  Install with: winget install ffmpeg")

        print("[TrackingEngine] Ready")

    # ---------------------------------------------------------------
    def _transcode_to_h264(self, src_path, progress_cb=None):
        """Re-encode mp4v video to browser-friendly H.264."""
        if not self.ffmpeg_path:
            print("[TrackingEngine] ⚠ Skipping transcode (ffmpeg missing)")
            return src_path

        if progress_cb:
            progress_cb("encoding", "Encoding video for web playback...")

        tmp_path = src_path.replace(".mp4", "_h264.mp4")
        cmd = [
            self.ffmpeg_path, "-y",
            "-i", src_path,
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "23",
            "-pix_fmt", "yuv420p",        # browser compatibility
            "-movflags", "+faststart",     # progressive streaming
            "-an",                         # no audio (we have none)
            tmp_path,
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            os.remove(src_path)
            os.rename(tmp_path, src_path)
            print(f"[TrackingEngine] ✓ Transcoded to H.264: {src_path}")
        except subprocess.CalledProcessError as e:
            print(f"[TrackingEngine] ❌ ffmpeg failed:\n{e.stderr[:500]}")
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception as e:
            print(f"[TrackingEngine] ❌ Transcode error: {e}")
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

        return src_path

    # ---------------------------------------------------------------
    def process_video(self, video_path, output_dir, progress_cb=None,
                      use_stub=False, stub_path=None):
        """Batch pipeline — exact port of Tracking/main.py for full visual quality."""
        from pass_detector import PassDetector

        os.makedirs(output_dir, exist_ok=True)
        info  = get_video_info(video_path)
        fps   = info["fps"] or 24
        out_w, out_h = 1280, 720

        # ---- 1. Load all frames at working resolution ----
        if progress_cb:
            progress_cb("detecting", "Loading video frames...")
        cap = cv2.VideoCapture(video_path)
        video_frames = []
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            video_frames.append(cv2.resize(frame, (out_w, out_h)))
        cap.release()
        if not video_frames:
            raise RuntimeError("Could not read any video frames")

        # ---- 2. Detection + ByteTrack ----
        if progress_cb:
            progress_cb("detecting", "Running YOLO detection & tracking...")
        tracks = self.tracker.get_object_tracks(
            video_frames,
            read_from_stub=use_stub,
            stub_path=stub_path,
        )
        # Clamp frames to stub length (same as main.py)
        video_frames = video_frames[:len(tracks["players"])]
        n_frames = len(tracks["players"])

        # ---- 3. Add positions ----
        self.tracker.add_position_to_tracks(tracks)

        # ---- 4. Camera movement ----
        if progress_cb:
            progress_cb("processing", "Estimating camera movement...")
        cam_est = CameraMovementEstimator(video_frames[0])
        camera_movement_per_frame = cam_est.get_camera_movement(video_frames)
        cam_est.add_adjust_positions_to_tracks(tracks, camera_movement_per_frame)

        # ---- 5. View transform ----
        ViewTransformer(video_frames[0]).add_transformed_position_to_tracks(tracks)

        # ---- 6. Ball interpolation ----
        tracks["ball"] = self.tracker.interpolate_ball_positions(tracks["ball"])

        # ---- 7. Speed / distance ----
        sde = SpeedAndDistance_Estimator(frame_rate=fps)
        sde.add_speed_and_distance_to_tracks(tracks)

        # ---- 8. Teams (colour model from best frame, needs >= 2 players) ----
        if progress_cb:
            progress_cb("processing", "Assigning team colors...")
        team_assigner = TeamAssigner()
        best_frame_idx = max(range(n_frames), key=lambda i: len(tracks['players'][i]))
        if len(tracks['players'][best_frame_idx]) < 2:
            raise RuntimeError(
                "Not enough players detected to assign teams. "
                "Try a longer clip or a clip with more players visible."
            )
        team_assigner.assign_team_color(video_frames[best_frame_idx], tracks['players'][best_frame_idx])
        for frame_num, player_track in enumerate(tracks['players']):
            for player_id, track in player_track.items():
                team = team_assigner.get_player_team(
                    video_frames[frame_num], track['bbox'], player_id)
                tracks['players'][frame_num][player_id]['team']       = team
                tracks['players'][frame_num][player_id]['team_color'] = \
                    team_assigner.team_colors[team]

        # ---- 9. Ball assignment ----
        pba = PlayerBallAssigner()
        team_ball_control = []
        for frame_num, player_track in enumerate(tracks['players']):
            ball_bbox = tracks['ball'][frame_num].get(1, {}).get('bbox')
            if ball_bbox:
                assigned_player = pba.assign_ball_to_player(player_track, ball_bbox)
            else:
                assigned_player = -1
            if assigned_player != -1:
                tracks['players'][frame_num][assigned_player]['has_ball'] = True
                team_ball_control.append(
                    tracks['players'][frame_num][assigned_player]['team'])
            else:
                team_ball_control.append(team_ball_control[-1] if team_ball_control else 0)
        team_ball_control_arr = np.array(team_ball_control)

        # ---- 10. Pass detection ----
        pass_detector    = PassDetector()
        passes_per_frame = pass_detector.detect_passes(tracks)

        # ---- 11. Collect stats data ----
        player_team_map: dict = {}
        player_passes:   dict = {}
        team_passes:     dict = {}
        pass_transfers:  dict = {}
        HEATMAP_COLS, HEATMAP_ROWS = 80, 52
        team_heatmaps = {
            1: np.zeros((HEATMAP_ROWS, HEATMAP_COLS), dtype=np.float32),
            2: np.zeros((HEATMAP_ROWS, HEATMAP_COLS), dtype=np.float32),
        }
        player_positions_hm: dict = {}

        _pts = [p["position_transformed"]
                for fr in tracks["players"][::5] for p in fr.values()
                if p.get("position_transformed") is not None]
        if _pts:
            hm_x_min = min(float(pt[0]) for pt in _pts)
            hm_x_max = max(float(pt[0]) for pt in _pts)
            hm_y_min = min(float(pt[1]) for pt in _pts)
            hm_y_max = max(float(pt[1]) for pt in _pts)
        else:
            hm_x_min, hm_x_max, hm_y_min, hm_y_max = 0.0, 105.0, 0.0, 68.0
        hm_x_range = max(1.0, hm_x_max - hm_x_min)
        hm_y_range = max(1.0, hm_y_max - hm_y_min)

        # Pass-network from passes_per_frame
        prev_counts = {1: 0, 2: 0}
        for frame_num, player_track in enumerate(tracks['players']):
            for pid, p in player_track.items():
                team = p.get("team")
                player_team_map[pid] = team
                pos_t = p.get("position_transformed")
                if pos_t is not None and team in (1, 2):
                    nx = int(min(HEATMAP_COLS-1, max(0,
                        (float(pos_t[0])-hm_x_min)/hm_x_range*HEATMAP_COLS)))
                    ny = int(min(HEATMAP_ROWS-1, max(0,
                        (float(pos_t[1])-hm_y_min)/hm_y_range*HEATMAP_ROWS)))
                    team_heatmaps[team][ny, nx] += 1.0
                    if pid not in player_positions_hm:
                        player_positions_hm[pid] = {"sx":0.0,"sy":0.0,"n":0,"team":team}
                    player_positions_hm[pid]["sx"] += nx / HEATMAP_COLS
                    player_positions_hm[pid]["sy"] += ny / HEATMAP_ROWS
                    player_positions_hm[pid]["n"]  += 1
            # Accumulate per-frame pass deltas
            cur = passes_per_frame[frame_num] if frame_num < len(passes_per_frame) else prev_counts
            for tid in (1, 2):
                delta = cur.get(tid, 0) - prev_counts.get(tid, 0)
                if delta > 0:
                    team_passes[tid] = team_passes.get(tid, 0) + delta
            prev_counts = dict(cur)

        for _team in (1, 2):
            _mx = float(team_heatmaps[_team].max())
            if _mx > 0:
                team_heatmaps[_team] /= _mx

        # ---- 12. Draw — exactly like main.py ----
        if progress_cb:
            progress_cb("rendering", "Drawing annotations & encoding video...")

        output_video_frames = self.tracker.draw_annotations(
            video_frames, tracks, team_ball_control_arr)
        output_video_frames = cam_est.draw_camera_movement(
            output_video_frames, camera_movement_per_frame)
        sde.draw_speed_and_distance(output_video_frames, tracks)
        output_video_frames = pass_detector.draw_passes(
            output_video_frames, passes_per_frame)

        # ---- 13. Write video ----
        out_path = os.path.join(output_dir, "output.mp4")
        fourcc   = cv2.VideoWriter_fourcc(*"mp4v")
        writer   = cv2.VideoWriter(out_path, fourcc, fps, (out_w, out_h))
        for frame in output_video_frames:
            writer.write(frame)
        writer.release()
        del video_frames, output_video_frames  # free RAM

        # ---- 13b. Transcode to H.264 ----
        out_path = self._transcode_to_h264(out_path, progress_cb=progress_cb)

        # ---- 14. Build summary stats ----
        stats = self._build_stats(
            tracks, team_ball_control_arr, fps,
            team_assigner.team_colors,
            player_passes, team_passes, player_team_map,
            team_heatmaps, player_positions_hm, pass_transfers,
        )

        # ---- 15. Generate HTML report ----
        if progress_cb:
            progress_cb("rendering", "Generating match report...")
        report_path = os.path.join(output_dir, "report.html")
        try:
            ReportGenerator().generate(
                tracks, team_ball_control_arr, passes_per_frame, report_path)
        except Exception as e:
            print(f"[TrackingEngine] ⚠ Report generation failed: {e}")
            report_path = None

        if progress_cb:
            progress_cb("done", "Tracking complete!")
        return out_path, report_path, stats

    # (old streaming process_video kept below for reference — not used)
    def _process_video_streaming_unused(self, video_path, output_dir, progress_cb=None,
                      use_stub=False, stub_path=None):
        """Streaming variant — kept for reference, not called."""
        os.makedirs(output_dir, exist_ok=True)
        info = get_video_info(video_path)
        out_w, out_h = 1280, 720

        # ---- 1. Detection + ByteTrack ----
        if progress_cb:
            progress_cb("detecting", "Running YOLO detection & tracking...")
        tracks, first_frame = self.tracker.get_object_tracks_streaming(
            video_path,
            read_from_stub=use_stub,
            stub_path=stub_path,
            progress_cb=lambda done, total: progress_cb(
                "detecting", f"Detecting objects ({done}/{total})..."
            ) if progress_cb else None,
        )
        n_frames = len(tracks["players"])

        # ---- 2. Add positions ----
        self.tracker.add_position_to_tracks(tracks)

        # ---- 3. Camera movement (streaming at reduced resolution — no bulk RAM load) ----
        if progress_cb:
            progress_cb("processing", "Estimating camera movement...")
        CAM_W, CAM_H = 640, 360
        scale_x = out_w / CAM_W
        scale_y = out_h / CAM_H
        first_small   = cv2.resize(first_frame, (CAM_W, CAM_H))
        cam_est       = CameraMovementEstimator(first_small)
        cam_est.init_streaming(cv2.cvtColor(first_small, cv2.COLOR_BGR2GRAY))
        camera_movement_per_frame = [[0.0, 0.0]]   # frame 0 = no movement

        for cam_frame in video_frame_iter(video_path, resize=(CAM_W, CAM_H)):
            gray = cv2.cvtColor(cam_frame, cv2.COLOR_BGR2GRAY)
            mv   = cam_est.process_frame(gray)
            # scale movement from 640×360 space back to full 1280×720 space
            camera_movement_per_frame.append([mv[0] * scale_x, mv[1] * scale_y])
            if len(camera_movement_per_frame) >= n_frames:
                break

        # Pad if the video was shorter than the tracks array
        while len(camera_movement_per_frame) < n_frames:
            camera_movement_per_frame.append([0.0, 0.0])

        # ---- 3b. Apply camera-movement correction to positions ----
        # (add_position_to_tracks wrote raw pixel coords; subtract camera drift)
        for _, object_tracks in tracks.items():
            for frame_num, track in enumerate(object_tracks):
                if frame_num >= len(camera_movement_per_frame):
                    break
                cm = camera_movement_per_frame[frame_num]
                if cm[0] == 0.0 and cm[1] == 0.0:
                    continue
                for _, tinfo in track.items():
                    if "position_adjusted" in tinfo:
                        pa = tinfo["position_adjusted"]
                        tinfo["position_adjusted"] = [pa[0] - cm[0], pa[1] - cm[1]]

        # ---- 4. View transform ----
        ViewTransformer(first_frame).add_transformed_position_to_tracks(tracks)

        # ---- 5. Ball interpolation ----
        tracks["ball"] = self.tracker.interpolate_ball_positions(tracks["ball"])

        # ---- 6. Speed / distance ----
        sde = SpeedAndDistance_Estimator(frame_rate=info["fps"] or 24)
        sde.add_speed_and_distance_to_tracks(tracks)

        # ---- 7. Teams ----
        if progress_cb:
            progress_cb("processing", "Assigning team colors...")
        team_assigner = TeamAssigner()
        # Sample up to 10 evenly-spaced frames for a more robust colour model
        sample_indices = np.linspace(0, n_frames - 1, min(10, n_frames), dtype=int)
        init_frames_players = []
        cap_for_init = cv2.VideoCapture(video_path)
        for idx in sample_indices:
            cap_for_init.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            ok, sample_frame = cap_for_init.read()
            if ok and sample_frame is not None and tracks["players"][idx]:
                if sample_frame.shape[1] != out_w or sample_frame.shape[0] != out_h:
                    sample_frame = cv2.resize(sample_frame, (out_w, out_h))
                init_frames_players.append((sample_frame, tracks["players"][idx]))
        cap_for_init.release()
        if init_frames_players:
            team_assigner.assign_team_color_multi(init_frames_players)
        else:
            team_assigner.team_colors[1] = np.array([255, 0, 0])
            team_assigner.team_colors[2] = np.array([0, 0, 255])

        # ---- 8. Analytics pre-pass: team + ball assignment, heatmaps ----
        # Do all analytics in one streaming pass so rendering is clean.
        if progress_cb:
            progress_cb("processing", "Assigning teams and ball possession...")

        pba = PlayerBallAssigner()
        team_ball_control: list = []
        player_passes:    dict  = {}
        team_passes:      dict  = {}
        player_team_map:  dict  = {}

        HEATMAP_COLS, HEATMAP_ROWS = 80, 52
        team_heatmaps = {
            1: np.zeros((HEATMAP_ROWS, HEATMAP_COLS), dtype=np.float32),
            2: np.zeros((HEATMAP_ROWS, HEATMAP_COLS), dtype=np.float32),
        }
        player_positions_hm: dict = {}
        pass_transfers:      dict = {}

        _pts = [p["position_transformed"]
                for fr in tracks["players"][::5] for p in fr.values()
                if p.get("position_transformed") is not None]
        if _pts:
            _xs = [float(pt[0]) for pt in _pts]
            _ys = [float(pt[1]) for pt in _pts]
            hm_x_min, hm_x_max = min(_xs), max(_xs)
            hm_y_min, hm_y_max = min(_ys), max(_ys)
        else:
            hm_x_min, hm_x_max, hm_y_min, hm_y_max = 0.0, 105.0, 0.0, 68.0
        hm_x_range = max(1.0, hm_x_max - hm_x_min)
        hm_y_range = max(1.0, hm_y_max - hm_y_min)

        # Pass-detection state (for stats/network only; PassDetector handles the overlay)
        _MIN_HOLD = 3; _MAX_GAP = 60
        _prev_holder = _prev_team = _curr_holder = None
        _curr_hold_cnt = _gap_cnt = 0

        for frame_num, frame in enumerate(video_frame_iter(video_path, resize=(out_w, out_h))):
            if frame_num >= n_frames:
                break
            player_dict = tracks["players"][frame_num]
            ball_dict   = tracks["ball"][frame_num]

            # Team assignment (cached after first call per player)
            for pid, p in player_dict.items():
                team = team_assigner.get_player_team(frame, p["bbox"], pid)
                p["team"]       = team
                p["team_color"] = team_assigner.team_colors[team]
                player_team_map[pid] = team
                pos_t = p.get("position_transformed")
                if pos_t is not None and team in (1, 2):
                    nx = int(min(HEATMAP_COLS-1, max(0,
                        (float(pos_t[0])-hm_x_min)/hm_x_range*HEATMAP_COLS)))
                    ny = int(min(HEATMAP_ROWS-1, max(0,
                        (float(pos_t[1])-hm_y_min)/hm_y_range*HEATMAP_ROWS)))
                    team_heatmaps[team][ny, nx] += 1.0
                    if pid not in player_positions_hm:
                        player_positions_hm[pid] = {"sx":0.0,"sy":0.0,"n":0,"team":team}
                    player_positions_hm[pid]["sx"] += nx/HEATMAP_COLS
                    player_positions_hm[pid]["sy"] += ny/HEATMAP_ROWS
                    player_positions_hm[pid]["n"]  += 1

            # Ball assignment
            assigned_player = -1
            if 1 in ball_dict:
                assigned_player = pba.assign_ball_to_player(player_dict, ball_dict[1]["bbox"])
            if assigned_player != -1:
                player_dict[assigned_player]["has_ball"] = True
                team_ball_control.append(player_dict[assigned_player]["team"])
            else:
                team_ball_control.append(team_ball_control[-1] if team_ball_control else 0)

            # Pass network accumulation
            if assigned_player != -1 and assigned_player in player_dict:
                _gap_cnt = 0; pid = assigned_player
                pteam = player_dict[pid]["team"]
                if pid == _curr_holder:
                    _curr_hold_cnt += 1
                else:
                    _curr_holder = pid; _curr_hold_cnt = 1
                if _curr_hold_cnt == _MIN_HOLD:
                    if (_prev_holder is not None and _prev_holder != pid
                            and _prev_team == pteam):
                        player_passes[_prev_holder] = player_passes.get(_prev_holder,0)+1
                        team_passes[pteam]           = team_passes.get(pteam,0)+1
                        tk = (_prev_holder, pid)
                        if tk not in pass_transfers:
                            pass_transfers[tk] = {"team":pteam,"count":0}
                        pass_transfers[tk]["count"] += 1
                    _prev_holder = pid; _prev_team = pteam
            else:
                _gap_cnt += 1
                if _gap_cnt > _MAX_GAP:
                    _prev_holder = _prev_team = None
                _curr_holder = None; _curr_hold_cnt = 0

        # ---- 8b. Detect passes for per-frame overlay ----
        from pass_detector import PassDetector
        pass_detector   = PassDetector()
        passes_per_frame = pass_detector.detect_passes(tracks)

        # ---- 9. Streaming render (pure drawing pass) ----
        if progress_cb:
            progress_cb("rendering", "Drawing annotations & encoding video...")

        team_ball_ctrl_arr = np.array(team_ball_control)
        out_path = os.path.join(output_dir, "output.mp4")
        fourcc   = cv2.VideoWriter_fourcc(*"mp4v")
        writer   = cv2.VideoWriter(out_path, fourcc, info["fps"] or 24, (out_w, out_h))

        for frame_num, frame in enumerate(video_frame_iter(video_path, resize=(out_w, out_h))):
            if frame_num >= n_frames:
                break

            player_dict = tracks["players"][frame_num]
            ball_dict   = tracks["ball"][frame_num]
            ref_dict    = tracks["referees"][frame_num]

            # Players
            for tid, pl in player_dict.items():
                color = tuple(int(c) for c in pl.get("team_color", (0, 0, 255)))
                self.tracker.draw_ellipse(frame, pl["bbox"], color, tid)
                if pl.get("has_ball"):
                    self.tracker.draw_triangle(frame, pl["bbox"], (0, 0, 255))

            # Referees
            for _, ref in ref_dict.items():
                self.tracker.draw_ellipse(frame, ref["bbox"], (0, 255, 255))

            # Ball
            for _, ball in ball_dict.items():
                self.tracker.draw_triangle(frame, ball["bbox"], (0, 255, 0))

            # Speed & distance labels (matches main.py draw_speed_and_distance)
            sde.draw_speed_and_distance(
                [frame],
                {"players": [player_dict], "referees": [ref_dict], "ball": [ball_dict]},
            )

            # Camera movement overlay (top-left, matches main.py)
            cam_mv = camera_movement_per_frame[frame_num] if frame_num < len(camera_movement_per_frame) else [0.0, 0.0]
            cam_est.draw_camera_movement([frame], [cam_mv])

            # Pass counter (top-left, below camera movement, matches main.py)
            pass_detector.draw_passes([frame], [passes_per_frame[frame_num]])

            # Ball control overlay (bottom-right)
            self.tracker.draw_team_ball_control(
                frame, frame_num, team_ball_ctrl_arr,
                team_colors=team_assigner.team_colors,
            )

            writer.write(frame)

            if progress_cb and frame_num % 30 == 0:
                progress_cb("rendering", f"Rendering frames ({frame_num}/{n_frames})...")

        writer.release()

        # Normalise heatmaps to [0, 1]
        for _team in (1, 2):
            _mx = float(team_heatmaps[_team].max())
            if _mx > 0:
                team_heatmaps[_team] /= _mx

        # ---- 9b. Transcode to browser-friendly H.264 ----
        out_path = self._transcode_to_h264(out_path, progress_cb=progress_cb)

        # ---- 10. Build summary stats ----
        stats = self._build_stats(tracks, team_ball_ctrl_arr,
                                   info["fps"] or 24, team_assigner.team_colors,
                                   player_passes, team_passes, player_team_map,
                                   team_heatmaps, player_positions_hm, pass_transfers)

        if progress_cb:
            progress_cb("done", "Tracking complete!")

        return out_path, stats

    # ---------------------------------------------------------------
    def compute_analytics(self, video_path, output_dir, progress_cb=None):
        """
        Fast analytics pipeline for long videos (45+ min).
        Subsamples to ~4 fps via ffmpeg then runs detection + analytics without
        rendering any output video. Returns the same stats dict as _build_stats.
        """
        SAMPLE_FPS = 4
        os.makedirs(output_dir, exist_ok=True)
        info = get_video_info(video_path)
        fps  = info["fps"] or 24
        out_w, out_h = 1280, 720

        # First frame from original video (needed by ViewTransformer)
        cap = cv2.VideoCapture(video_path)
        ok, first_frame = cap.read()
        cap.release()
        if not ok or first_frame is None:
            raise RuntimeError("Cannot read video")
        first_frame = cv2.resize(first_frame, (out_w, out_h))

        # ---- Subsample via ffmpeg ----------------------------------------
        sub_path  = os.path.join(output_dir, "_analytics_sub.mp4")
        if self.ffmpeg_path and fps > SAMPLE_FPS:
            if progress_cb:
                progress_cb("processing", "Subsampling video for fast analysis…")
            cmd = [
                self.ffmpeg_path, "-y", "-i", video_path,
                "-vf", f"fps={SAMPLE_FPS}",
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "30",
                "-an", sub_path,
            ]
            try:
                subprocess.run(cmd, capture_output=True, timeout=3600, check=True)
                work_path = sub_path
                work_fps  = SAMPLE_FPS
            except Exception as e:
                print(f"[Analytics] Subsample failed ({e}) — using full video")
                work_path = video_path
                work_fps  = fps
        else:
            work_path = video_path
            work_fps  = fps

        # ---- Detection ---------------------------------------------------
        if progress_cb:
            progress_cb("detecting", "Detecting players (fast mode)…")
        tracks, _ = self.tracker.get_object_tracks_streaming(
            work_path,
            progress_cb=lambda done, total: progress_cb(
                "detecting", f"Detecting players ({done}/{total})…"
            ) if progress_cb else None,
        )
        n_frames = len(tracks["players"])

        # ---- Positions + view transform (no camera-movement correction) --
        self.tracker.add_position_to_tracks(tracks)
        ViewTransformer(first_frame).add_transformed_position_to_tracks(tracks)
        tracks["ball"] = self.tracker.interpolate_ball_positions(tracks["ball"])

        # ---- Speed / distance (adjusted fps) ----------------------------
        sde = SpeedAndDistance_Estimator(frame_rate=work_fps)
        sde.add_speed_and_distance_to_tracks(tracks)

        # ---- Team colours -----------------------------------------------
        if progress_cb:
            progress_cb("processing", "Assigning team colours…")
        team_assigner = TeamAssigner()
        sample_indices = np.linspace(0, n_frames - 1, min(10, n_frames), dtype=int)
        init_frames_players = []
        cap2 = cv2.VideoCapture(work_path)
        for idx in sample_indices:
            cap2.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            ok2, sf = cap2.read()
            if ok2 and sf is not None and tracks["players"][idx]:
                if sf.shape[1] != out_w or sf.shape[0] != out_h:
                    sf = cv2.resize(sf, (out_w, out_h))
                init_frames_players.append((sf, tracks["players"][idx]))
        cap2.release()
        if init_frames_players:
            team_assigner.assign_team_color_multi(init_frames_players)
        else:
            team_assigner.team_colors[1] = np.array([255, 0, 0])
            team_assigner.team_colors[2] = np.array([0, 0, 255])

        # ---- Analytics-only loop (no drawing / no writer) ---------------
        pba = PlayerBallAssigner()
        team_ball_control: list[int] = []
        _MIN_HOLD = 3;  _MAX_GAP = max(10, int(30 * work_fps / 24))
        _prev_holder = _prev_team = _curr_holder = None
        _curr_hold_cnt = _gap_cnt = 0
        player_passes:   dict[int, int]   = {}
        team_passes:     dict[int, int]   = {}
        player_team_map: dict[int, int]   = {}

        HEATMAP_COLS, HEATMAP_ROWS = 80, 52
        team_heatmaps = {
            1: np.zeros((HEATMAP_ROWS, HEATMAP_COLS), dtype=np.float32),
            2: np.zeros((HEATMAP_ROWS, HEATMAP_COLS), dtype=np.float32),
        }
        player_positions_hm: dict[int, dict] = {}
        pass_transfers:      dict[tuple, dict] = {}

        _pts = [p["position_transformed"]
                for fr in tracks["players"][::5] for p in fr.values()
                if p.get("position_transformed") is not None]
        if _pts:
            _xs = [float(pt[0]) for pt in _pts]
            _ys = [float(pt[1]) for pt in _pts]
            hm_x_min, hm_x_max = min(_xs), max(_xs)
            hm_y_min, hm_y_max = min(_ys), max(_ys)
        else:
            hm_x_min, hm_x_max, hm_y_min, hm_y_max = 0.0, 105.0, 0.0, 68.0
        hm_x_range = max(1.0, hm_x_max - hm_x_min)
        hm_y_range = max(1.0, hm_y_max - hm_y_min)

        if progress_cb:
            progress_cb("rendering", "Computing tactical analytics…")

        for frame_num, frame in enumerate(
            video_frame_iter(work_path, resize=(out_w, out_h))
        ):
            if frame_num >= n_frames:
                break

            player_dict = tracks["players"][frame_num]
            ball_dict   = tracks["ball"][frame_num]

            for pid, p in player_dict.items():
                team = team_assigner.get_player_team(frame, p["bbox"], pid)
                p["team"] = team
                player_team_map[pid] = team
                pos_t = p.get("position_transformed")
                if pos_t is not None and team in (1, 2):
                    nx = int(min(HEATMAP_COLS - 1, max(0,
                        (float(pos_t[0]) - hm_x_min) / hm_x_range * HEATMAP_COLS)))
                    ny = int(min(HEATMAP_ROWS - 1, max(0,
                        (float(pos_t[1]) - hm_y_min) / hm_y_range * HEATMAP_ROWS)))
                    team_heatmaps[team][ny, nx] += 1.0
                    if pid not in player_positions_hm:
                        player_positions_hm[pid] = {"sx": 0.0, "sy": 0.0, "n": 0, "team": team}
                    player_positions_hm[pid]["sx"] += nx / HEATMAP_COLS
                    player_positions_hm[pid]["sy"] += ny / HEATMAP_ROWS
                    player_positions_hm[pid]["n"]  += 1

            assigned_player = -1
            if 1 in ball_dict:
                assigned_player = pba.assign_ball_to_player(player_dict, ball_dict[1]["bbox"])
            team_ball_control.append(
                player_dict[assigned_player].get("team", 0)
                if assigned_player != -1 else 0
            )

            if assigned_player != -1 and assigned_player in player_dict:
                _gap_cnt = 0
                pid   = assigned_player
                pteam = player_dict[pid].get("team", 0)
                if pid == _curr_holder:
                    _curr_hold_cnt += 1
                else:
                    _curr_holder = pid;  _curr_hold_cnt = 1
                if _curr_hold_cnt == _MIN_HOLD:
                    if (_prev_holder is not None
                            and _prev_holder != pid
                            and _prev_team == pteam):
                        player_passes[_prev_holder] = player_passes.get(_prev_holder, 0) + 1
                        team_passes[pteam]           = team_passes.get(pteam, 0) + 1
                        tk = (_prev_holder, pid)
                        if tk not in pass_transfers:
                            pass_transfers[tk] = {"team": pteam, "count": 0}
                        pass_transfers[tk]["count"] += 1
                    _prev_holder = pid;  _prev_team = pteam
            else:
                _gap_cnt += 1
                if _gap_cnt > _MAX_GAP:
                    _prev_holder = _prev_team = None
                _curr_holder = None;  _curr_hold_cnt = 0

            if progress_cb and frame_num % 100 == 0:
                progress_cb("rendering", f"Computing analytics ({frame_num}/{n_frames})…")

        # Normalise heatmaps
        for _team in (1, 2):
            _mx = float(team_heatmaps[_team].max())
            if _mx > 0:
                team_heatmaps[_team] /= _mx

        # Remove temp subsample file
        if os.path.exists(sub_path):
            try:
                os.remove(sub_path)
            except Exception:
                pass

        stats = self._build_stats(
            tracks, np.array(team_ball_control, dtype=np.int64),
            work_fps, team_assigner.team_colors,
            player_passes, team_passes, player_team_map,
            team_heatmaps, player_positions_hm, pass_transfers,
        )
        if progress_cb:
            progress_cb("done", "Analytics complete!")
        return stats

    def _build_stats(self, tracks, team_ball_control, fps,
                     team_colors=None, player_passes=None, team_passes=None,
                     player_team_map=None, team_heatmaps=None,
                     player_positions_hm=None, pass_transfers=None):
        t1 = float((team_ball_control == 1).sum())
        t2 = float((team_ball_control == 2).sum())
        total = max(1.0, t1 + t2)

        player_distances = {}
        for frame in tracks["players"]:
            for pid, p in frame.items():
                if "distance" in p:
                    player_distances[pid] = max(player_distances.get(pid, 0), p["distance"])

        player_max_speed = {}
        for frame in tracks["players"]:
            for pid, p in frame.items():
                if "speed" in p:
                    player_max_speed[pid] = max(player_max_speed.get(pid, 0), p["speed"])

        def _bgr_to_hex(arr):
            b, g, r = int(arr[0]), int(arr[1]), int(arr[2])
            return f"#{r:02x}{g:02x}{b:02x}"

        tc = team_colors or {}
        team1_color = _bgr_to_hex(tc[1]) if 1 in tc else "#60a5fa"
        team2_color = _bgr_to_hex(tc[2]) if 2 in tc else "#f472b6"

        pp  = player_passes  or {}
        tp  = team_passes    or {}
        ptm = player_team_map or {}

        team_dist = {1: 0.0, 2: 0.0}
        for pid, dist in player_distances.items():
            team = ptm.get(pid)
            if team in team_dist:
                team_dist[team] += dist

        return {
            "duration_seconds": len(team_ball_control) / fps,
            "team1_possession_pct": round(100 * t1 / total, 2),
            "team2_possession_pct": round(100 * t2 / total, 2),
            "team1_color": team1_color,
            "team2_color": team2_color,
            "team1_passes": int(tp.get(1, 0)),
            "team2_passes": int(tp.get(2, 0)),
            "team1_total_distance_m": round(team_dist[1], 1),
            "team2_total_distance_m": round(team_dist[2], 1),
            "num_players_tracked": len(player_distances),
            "top_distances": sorted(
                [{"player_id": int(k), "distance_m": round(v, 1)} for k, v in player_distances.items()],
                key=lambda x: -x["distance_m"],
            )[:10],
            "top_speeds": sorted(
                [{"player_id": int(k), "max_speed_kmh": round(v, 1)} for k, v in player_max_speed.items()],
                key=lambda x: -x["max_speed_kmh"],
            )[:10],
            "top_passers": sorted(
                [{"player_id": int(k), "passes": v} for k, v in pp.items()],
                key=lambda x: -x["passes"],
            )[:10],
            "team1_heatmap": team_heatmaps[1].tolist() if team_heatmaps else [],
            "team2_heatmap": team_heatmaps[2].tolist() if team_heatmaps else [],
            "player_avg_positions": [
                {
                    "player_id": int(pid),
                    "x": round(v["sx"] / v["n"], 4),
                    "y": round(v["sy"] / v["n"], 4),
                    "team": v["team"],
                }
                for pid, v in (player_positions_hm or {}).items()
                if v["n"] > 0
            ],
            "pass_network": [
                {
                    "from": int(k[0]),
                    "to": int(k[1]),
                    "team": v["team"],
                    "count": v["count"],
                }
                for k, v in (pass_transfers or {}).items()
            ],
        }