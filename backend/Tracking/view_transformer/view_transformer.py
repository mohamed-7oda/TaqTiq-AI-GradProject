import numpy as np
import cv2


class ViewTransformer():
    # Pixel vertices calibrated for a 1920×1080 reference frame
    _REF_W = 1920
    _REF_H = 1080
    _REF_VERTICES = np.array([[110, 1035],
                               [265,  275],
                               [910,  260],
                               [1640, 915]], dtype=np.float32)

    def __init__(self, frame=None):
        court_width  = 68
        court_length = 23.32

        pixel_vertices = self._REF_VERTICES.copy()

        # Scale reference vertices to actual frame resolution if a frame is provided
        if frame is not None:
            fh, fw = frame.shape[:2]
            scale_x = fw / self._REF_W
            scale_y = fh / self._REF_H
            pixel_vertices = pixel_vertices * np.array([scale_x, scale_y],
                                                        dtype=np.float32)

        self.pixel_vertices = pixel_vertices

        self.target_vertices = np.array([
            [0, court_width],
            [0, 0],
            [court_length, 0],
            [court_length, court_width],
        ], dtype=np.float32)

        self.persepctive_trasnformer = cv2.getPerspectiveTransform(
            self.pixel_vertices, self.target_vertices)

    def transform_point(self, point):
        reshaped_point = point.reshape(-1, 1, 2).astype(np.float32)
        tranform_point = cv2.perspectiveTransform(reshaped_point,
                                                   self.persepctive_trasnformer)
        result = tranform_point.reshape(-1, 2)
        if not np.all(np.isfinite(result)):
            return None
        return result

    def add_transformed_position_to_tracks(self, tracks):
        for object, object_tracks in tracks.items():
            for frame_num, track in enumerate(object_tracks):
                for track_id, track_info in track.items():
                    position = track_info.get('position_adjusted') \
                               or track_info.get('position')
                    if position is None:
                        tracks[object][frame_num][track_id]['position_transformed'] = None
                        continue
                    position_transformed = self.transform_point(np.array(position))
                    if position_transformed is not None:
                        position_transformed = position_transformed.squeeze().tolist()
                    tracks[object][frame_num][track_id]['position_transformed'] = \
                        position_transformed
