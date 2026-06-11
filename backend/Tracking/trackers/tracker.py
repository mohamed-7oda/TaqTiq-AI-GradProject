import os as _os, sys as _sys
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))

from ultralytics import YOLO
import supervision as sv
import pickle
import os
import numpy as np
import pandas as pd
import cv2
from utils import get_center_of_bbox, get_bbox_width, get_foot_position

class Tracker:
    def __init__(self, model_path, device="cpu"):
        self.model = YOLO(model_path)
        self.model.to(device)
        self.tracker = sv.ByteTrack()

    def add_position_to_tracks(self, tracks):
        for object, object_tracks in tracks.items():
            for frame_num, track in enumerate(object_tracks):
                for track_id, track_info in track.items():
                    bbox = track_info['bbox']
                    if object == 'ball':
                        position = get_center_of_bbox(bbox)
                    else:
                        position = get_foot_position(bbox)
                    tracks[object][frame_num][track_id]['position'] = position

    def interpolate_ball_positions(self, ball_positions):
        ball_positions = [x.get(1, {}).get('bbox', []) for x in ball_positions]
        df_ball_positions = pd.DataFrame(ball_positions, columns=['x1','y1','x2','y2'])
        df_ball_positions = df_ball_positions.interpolate()
        df_ball_positions = df_ball_positions.bfill()
        ball_positions = [{1: {"bbox": x}} for x in df_ball_positions.to_numpy().tolist()]
        return ball_positions

    def detect_frames(self, frames):
        batch_size = 20
        detections = []
        for i in range(0, len(frames), batch_size):
            detections_batch = self.model.predict(frames[i:i+batch_size], conf=0.1)
            detections += detections_batch
        return detections

    def get_object_tracks(self, frames, read_from_stub=False, stub_path=None):
        if read_from_stub and stub_path is not None and os.path.exists(stub_path):
            with open(stub_path, 'rb') as f:
                tracks = pickle.load(f)
            return tracks

        detections = self.detect_frames(frames)
        tracks = {"players": [], "referees": [], "ball": []}

        for frame_num, detection in enumerate(detections):
            cls_names = detection.names
            cls_names_inv = {v: k for k, v in cls_names.items()}
            detection_supervision = sv.Detections.from_ultralytics(detection)
            for object_ind, class_id in enumerate(detection_supervision.class_id):
                if cls_names[class_id] == "goalkeeper":
                    detection_supervision.class_id[object_ind] = cls_names_inv["player"]
            detection_with_tracks = self.tracker.update_with_detections(detection_supervision)
            tracks["players"].append({})
            tracks["referees"].append({})
            tracks["ball"].append({})
            for frame_detection in detection_with_tracks:
                bbox = frame_detection[0].tolist()
                cls_id = frame_detection[3]
                track_id = frame_detection[4]
                if cls_id == cls_names_inv['player']:
                    tracks["players"][frame_num][track_id] = {"bbox": bbox}
                if cls_id == cls_names_inv['referee']:
                    tracks["referees"][frame_num][track_id] = {"bbox": bbox}
            for frame_detection in detection_supervision:
                bbox = frame_detection[0].tolist()
                cls_id = frame_detection[3]
                if cls_id == cls_names_inv['ball']:
                    tracks["ball"][frame_num][1] = {"bbox": bbox}

        if stub_path is not None:
            with open(stub_path, 'wb') as f:
                pickle.dump(tracks, f)
        return tracks

    def get_object_tracks_streaming(self, video_path, read_from_stub=False,
                                    stub_path=None, progress_cb=None):
        """Stream video frame-by-frame; returns (tracks, first_frame)."""
        if read_from_stub and stub_path is not None and os.path.exists(stub_path):
            with open(stub_path, 'rb') as f:
                data = pickle.load(f)
            if isinstance(data, tuple):
                return data
            cap = cv2.VideoCapture(video_path)
            _, first_frame = cap.read()
            cap.release()
            return data, first_frame

        cap = cv2.VideoCapture(video_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
        tracks = {"players": [], "referees": [], "ball": []}
        first_frame = None
        frame_num = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if first_frame is None:
                first_frame = frame.copy()

            detection = self.model.predict(frame, conf=0.1, verbose=False)[0]
            cls_names = detection.names
            cls_names_inv = {v: k for k, v in cls_names.items()}
            detection_supervision = sv.Detections.from_ultralytics(detection)
            for obj_ind, class_id in enumerate(detection_supervision.class_id):
                if cls_names[class_id] == "goalkeeper":
                    detection_supervision.class_id[obj_ind] = cls_names_inv["player"]
            detection_with_tracks = self.tracker.update_with_detections(detection_supervision)
            tracks["players"].append({})
            tracks["referees"].append({})
            tracks["ball"].append({})

            for frame_detection in detection_with_tracks:
                bbox = frame_detection[0].tolist()
                cls_id = frame_detection[3]
                track_id = frame_detection[4]
                if cls_id == cls_names_inv.get('player'):
                    tracks["players"][frame_num][track_id] = {"bbox": bbox}
                if cls_id == cls_names_inv.get('referee'):
                    tracks["referees"][frame_num][track_id] = {"bbox": bbox}
            for frame_detection in detection_supervision:
                bbox = frame_detection[0].tolist()
                cls_id = frame_detection[3]
                if cls_id == cls_names_inv.get('ball'):
                    tracks["ball"][frame_num][1] = {"bbox": bbox}

            frame_num += 1
            if progress_cb and frame_num % 30 == 0:
                progress_cb(frame_num, total_frames)

        cap.release()
        if progress_cb:
            progress_cb(frame_num, frame_num)

        if stub_path is not None:
            os.makedirs(os.path.dirname(stub_path) or ".", exist_ok=True)
            with open(stub_path, 'wb') as f:
                pickle.dump((tracks, first_frame), f)

        return tracks, first_frame

    def draw_ellipse(self, frame, bbox, color, track_id=None):
        fh, fw = frame.shape[:2]
        s = fh / 1080
        y2 = int(bbox[3])
        x_center, _ = get_center_of_bbox(bbox)
        raw_width = get_bbox_width(bbox)
        width = min(raw_width, int(fw * 0.06))

        cv2.ellipse(frame, center=(x_center, y2),
                    axes=(int(width), int(0.35 * width)),
                    angle=0.0, startAngle=-45, endAngle=235,
                    color=color, thickness=2, lineType=cv2.LINE_4)

        rw = int(40 * s); rh = int(20 * s)
        x1_rect = x_center - rw // 2; x2_rect = x_center + rw // 2
        y1_rect = y2 - rh // 2 + int(15 * s); y2_rect = y2 + rh // 2 + int(15 * s)

        if track_id is not None:
            cv2.rectangle(frame, (int(x1_rect), int(y1_rect)),
                          (int(x2_rect), int(y2_rect)), color, cv2.FILLED)
            x1_text = x1_rect + int(12 * s)
            if track_id > 99:
                x1_text -= int(10 * s)
            cv2.putText(frame, f"{track_id}",
                        (int(x1_text), int(y1_rect + 15 * s)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6 * s, (0, 0, 0),
                        max(1, int(2 * s)))
        return frame

    def draw_traingle(self, frame, bbox, color):
        fh = frame.shape[0]; s = fh / 1080
        y = int(bbox[1]); x, _ = get_center_of_bbox(bbox); sz = int(10 * s)
        triangle_points = np.array([[x, y], [x - sz, y - sz * 2], [x + sz, y - sz * 2]])
        cv2.drawContours(frame, [triangle_points], 0, color, cv2.FILLED)
        cv2.drawContours(frame, [triangle_points], 0, (0, 0, 0), 2)
        return frame

    def draw_triangle(self, frame, bbox, color):
        return self.draw_traingle(frame, bbox, color)

    def draw_pass_counter(self, frame, team_passes, team_colors=None):
        h, w = frame.shape[:2]; s = h / 1080
        t1 = team_passes.get(1, 0); t2 = team_passes.get(2, 0)
        x1 = w - int(570*s); y1 = h - int(105*s)
        x2 = w - int(20*s);  y2 = h - int(10*s)
        overlay = frame.copy()
        cv2.rectangle(overlay, (x1, y1), (x2, y2), (255, 255, 255), -1)
        cv2.addWeighted(overlay, 0.4, frame, 0.6, 0, frame)

        sq = int(18*s); tx = x1 + int(10*s)
        for row, (tid, passes) in enumerate([(1, t1), (2, t2)]):
            ty = y1 + int((38 + 42*row)*s)
            if team_colors and tid in team_colors:
                c = tuple(int(v) for v in team_colors[tid])
                cv2.rectangle(frame, (tx, ty - sq), (tx + sq, ty), c, -1)
                cv2.rectangle(frame, (tx, ty - sq), (tx + sq, ty), (0, 0, 0), 1)
            cv2.putText(frame, f"Team {tid} Passes: {passes}",
                        (tx + sq + int(6*s), ty),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9*s, (0, 0, 0),
                        max(1, int(2*s)))
        return frame

    def draw_team_ball_control(self, frame, frame_num, team_ball_control,
                               team_colors=None):
        h, w = frame.shape[:2]; s = h / 1080
        x1, y1 = w - int(570*s), h - int(230*s)
        x2, y2 = w - int(20*s),  h - int(110*s)
        overlay = frame.copy()
        cv2.rectangle(overlay, (x1, y1), (x2, y2), (255, 255, 255), -1)
        cv2.addWeighted(overlay, 0.4, frame, 0.6, 0, frame)

        team_ball_control_till_frame = team_ball_control[:frame_num+1]
        team_1_num_frames = team_ball_control_till_frame[team_ball_control_till_frame==1].shape[0]
        team_2_num_frames = team_ball_control_till_frame[team_ball_control_till_frame==2].shape[0]
        total = team_1_num_frames + team_2_num_frames
        team_1 = team_1_num_frames / total if total > 0 else 0
        team_2 = team_2_num_frames / total if total > 0 else 0

        sq = int(20*s); tx = x1 + int(10*s)
        for row, (tid, pct) in enumerate([(1, team_1), (2, team_2)]):
            ty = y1 + int((40 + 50*row)*s)
            if team_colors and tid in team_colors:
                c = tuple(int(v) for v in team_colors[tid])
                cv2.rectangle(frame, (tx, ty - sq), (tx + sq, ty), c, -1)
                cv2.rectangle(frame, (tx, ty - sq), (tx + sq, ty), (0, 0, 0), 1)
            cv2.putText(frame, f"Team {tid} Ball Control: {pct*100:.2f}%",
                        (tx + sq + int(8*s), ty),
                        cv2.FONT_HERSHEY_SIMPLEX, s, (0, 0, 0),
                        max(1, int(3*s)))
        return frame

    def draw_annotations(self, video_frames, tracks, team_ball_control):
        output_video_frames = []
        for frame_num, frame in enumerate(video_frames):
            frame = frame.copy()
            player_dict  = tracks["players"][frame_num]
            ball_dict    = tracks["ball"][frame_num]
            referee_dict = tracks["referees"][frame_num]

            for track_id, player in player_dict.items():
                color = player.get("team_color", (0, 0, 255))
                frame = self.draw_ellipse(frame, player["bbox"], color, track_id)
                if player.get('has_ball', False):
                    frame = self.draw_traingle(frame, player["bbox"], (0, 0, 255))
            for _, referee in referee_dict.items():
                frame = self.draw_ellipse(frame, referee["bbox"], (0, 255, 255))
            for _, ball in ball_dict.items():
                frame = self.draw_traingle(frame, ball["bbox"], (0, 255, 0))
            frame = self.draw_team_ball_control(frame, frame_num, team_ball_control)
            output_video_frames.append(frame)
        return output_video_frames
