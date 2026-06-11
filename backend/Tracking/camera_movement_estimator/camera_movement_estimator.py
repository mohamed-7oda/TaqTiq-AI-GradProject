import os as _os, sys as _sys
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))

import pickle
import cv2
import numpy as np
import os
from utils import measure_distance, measure_xy_distance


class CameraMovementEstimator():
    def __init__(self, frame):
        self.minimum_distance = 5
        self.lk_params = dict(
            winSize=(15, 15),
            maxLevel=2,
            criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 10, 0.03)
        )

        first_frame_grayscale = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) \
            if len(frame.shape) == 3 else frame
        w = first_frame_grayscale.shape[1]

        # Mask relative to frame width so it works at any resolution
        mask_features = np.zeros_like(first_frame_grayscale)
        mask_features[:, 0:max(20, w // 50)] = 1
        mask_features[:, max(0, w - w // 8):] = 1

        self.features = dict(
            maxCorners=100,
            qualityLevel=0.3,
            minDistance=3,
            blockSize=7,
            mask=mask_features,
        )

        # Streaming state (populated by init_streaming)
        self._old_gray = None
        self._old_features = None

    def get_camera_movement(self, frames, read_from_stub=False, stub_path=None):
        if read_from_stub and stub_path is not None and os.path.exists(stub_path):
            with open(stub_path, 'rb') as f:
                return pickle.load(f)

        camera_movement = [[0, 0] for _ in range(len(frames))]
        old_gray = cv2.cvtColor(frames[0], cv2.COLOR_BGR2GRAY)
        old_features = cv2.goodFeaturesToTrack(old_gray, **self.features)

        for frame_num in range(1, len(frames)):
            frame_gray = cv2.cvtColor(frames[frame_num], cv2.COLOR_BGR2GRAY)
            if old_features is None:
                old_features = cv2.goodFeaturesToTrack(frame_gray, **self.features)
                old_gray = frame_gray.copy()
                continue

            new_features, _, _ = cv2.calcOpticalFlowPyrLK(
                old_gray, frame_gray, old_features, None, **self.lk_params)

            max_distance = 0
            camera_movement_x, camera_movement_y = 0, 0
            if new_features is not None:
                for new, old in zip(new_features, old_features):
                    distance = measure_distance(new.ravel(), old.ravel())
                    if distance > max_distance:
                        max_distance = distance
                        camera_movement_x, camera_movement_y = measure_xy_distance(
                            old.ravel(), new.ravel())

            if max_distance > self.minimum_distance:
                camera_movement[frame_num] = [camera_movement_x, camera_movement_y]
                old_features = cv2.goodFeaturesToTrack(frame_gray, **self.features)
            old_gray = frame_gray.copy()

        if stub_path is not None:
            with open(stub_path, 'wb') as f:
                pickle.dump(camera_movement, f)
        return camera_movement

    def add_adjust_positions_to_tracks(self, tracks, camera_movement_per_frame):
        for _, object_tracks in tracks.items():
            for frame_num, track in enumerate(object_tracks):
                for _, track_info in track.items():
                    position = track_info.get('position_adjusted',
                                              track_info.get('position', None))
                    if position is None:
                        continue
                    camera_movement = camera_movement_per_frame[frame_num]
                    track_info['position_adjusted'] = (
                        position[0] - camera_movement[0],
                        position[1] - camera_movement[1],
                    )

    def init_streaming(self, first_gray):
        """Initialise optical-flow state for frame-by-frame streaming."""
        self._old_gray = first_gray.copy()
        self._old_features = cv2.goodFeaturesToTrack(first_gray, **self.features)

    def process_frame(self, gray):
        """Process one grayscale frame; return [dx, dy] camera movement."""
        if self._old_features is None:
            self._old_features = cv2.goodFeaturesToTrack(gray, **self.features)
            self._old_gray = gray.copy()
            return [0.0, 0.0]

        new_features, _, _ = cv2.calcOpticalFlowPyrLK(
            self._old_gray, gray, self._old_features, None, **self.lk_params)

        max_distance = 0
        camera_movement_x, camera_movement_y = 0.0, 0.0
        if new_features is not None:
            for new, old in zip(new_features, self._old_features):
                distance = measure_distance(new.ravel(), old.ravel())
                if distance > max_distance:
                    max_distance = distance
                    camera_movement_x, camera_movement_y = measure_xy_distance(
                        old.ravel(), new.ravel())

        if max_distance > self.minimum_distance:
            self._old_features = cv2.goodFeaturesToTrack(gray, **self.features)
        self._old_gray = gray.copy()

        return ([camera_movement_x, camera_movement_y]
                if max_distance > self.minimum_distance else [0.0, 0.0])

    def draw_camera_movement(self, frames, camera_movement_per_frame):
        output_frames = []
        for frame_num, frame in enumerate(frames):
            h = frame.shape[0]; s = h / 1080
            cv2.rectangle(frame, (0, 0), (int(500*s), int(100*s)), (255, 255, 255), -1)
            x_movement, y_movement = camera_movement_per_frame[frame_num]
            cv2.putText(frame, f"Camera Movement X: {x_movement:.2f}",
                        (int(10*s), int(30*s)), cv2.FONT_HERSHEY_SIMPLEX,
                        s, (0, 0, 0), max(1, int(3*s)))
            cv2.putText(frame, f"Camera Movement Y: {y_movement:.2f}",
                        (int(10*s), int(60*s)), cv2.FONT_HERSHEY_SIMPLEX,
                        s, (0, 0, 0), 3)
            output_frames.append(frame)
        return output_frames
