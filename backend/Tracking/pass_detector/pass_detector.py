import cv2


class PassDetector:
    # Minimum pixel distance between passer and receiver to count as a genuine pass.
    # Filters out cases where the ball briefly leaves a player and returns to the same spot.
    MIN_PASS_DISTANCE = 100

    def detect_passes(self, tracks):
        passes_per_frame = []
        running_counts = {1: 0, 2: 0}
        last_player_id = None
        last_team_id = None
        last_position = None

        for player_track in tracks['players']:
            current_player_id = None
            current_team_id = None
            current_position = None

            for player_id, player_info in player_track.items():
                if player_info.get('has_ball', False):
                    current_player_id = player_id
                    current_team_id = player_info.get('team')
                    pos = player_info.get('position_adjusted')
                    if pos is None:
                        bbox = player_info.get('bbox', [])
                        if bbox:
                            pos = ((bbox[0] + bbox[2]) / 2, bbox[3])
                    current_position = pos
                    break

            if current_player_id is not None:
                if (last_player_id is not None
                        and current_player_id != last_player_id
                        and current_team_id == last_team_id
                        and current_team_id in running_counts):

                    genuine = True
                    if last_position is not None and current_position is not None:
                        dx = current_position[0] - last_position[0]
                        dy = current_position[1] - last_position[1]
                        genuine = (dx**2 + dy**2) ** 0.5 >= self.MIN_PASS_DISTANCE

                    if genuine:
                        running_counts[current_team_id] += 1

                last_player_id = current_player_id
                last_team_id = current_team_id
                last_position = current_position

            passes_per_frame.append(dict(running_counts))

        return passes_per_frame

    def draw_passes(self, frames, passes_per_frame):
        for frame_num, frame in enumerate(frames):
            counts = passes_per_frame[frame_num]
            s = frame.shape[0] / 1080

            overlay = frame.copy()
            cv2.rectangle(overlay, (0, int(110*s)), (int(430*s), int(200*s)), (255, 255, 255), -1)
            cv2.addWeighted(overlay, 0.4, frame, 0.6, 0, frame)

            th = max(1, int(3*s))
            cv2.putText(frame, f"Team 1 Passes: {counts[1]}",
                        (int(10*s), int(148*s)), cv2.FONT_HERSHEY_SIMPLEX, s, (0, 0, 0), th)
            cv2.putText(frame, f"Team 2 Passes: {counts[2]}",
                        (int(10*s), int(188*s)), cv2.FONT_HERSHEY_SIMPLEX, s, (0, 0, 0), th)

        return frames
