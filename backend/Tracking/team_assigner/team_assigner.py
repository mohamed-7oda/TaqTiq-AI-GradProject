import numpy as np
from sklearn.cluster import KMeans


class TeamAssigner:
    def __init__(self):
        self.team_colors = {}
        self.player_team_dict = {}
        self.left_team_id = 1
        self.right_team_id = 2

    def get_clustering_model(self, image):
        image_2d = image.reshape(-1, 3)
        kmeans = KMeans(n_clusters=2, init="k-means++", n_init=1)
        kmeans.fit(image_2d)
        return kmeans

    def get_player_color(self, frame, bbox):
        fh, fw = frame.shape[:2]
        x1 = max(0, int(bbox[0])); y1 = max(0, int(bbox[1]))
        x2 = min(fw, int(bbox[2])); y2 = min(fh, int(bbox[3]))
        image = frame[y1:y2, x1:x2]
        if image.size == 0:
            return np.array([0.0, 0.0, 0.0])
        top_half_image = image[0:max(1, int(image.shape[0] / 2)), :]
        if top_half_image.reshape(-1, 3).shape[0] < 2:
            return (top_half_image.reshape(-1, 3)[0]
                    if top_half_image.size > 0
                    else np.array([0.0, 0.0, 0.0]))
        kmeans = self.get_clustering_model(top_half_image)
        labels = kmeans.labels_
        clustered_image = labels.reshape(top_half_image.shape[0],
                                         top_half_image.shape[1])
        corner_clusters = [clustered_image[0, 0], clustered_image[0, -1],
                           clustered_image[-1, 0], clustered_image[-1, -1]]
        non_player_cluster = max(set(corner_clusters), key=corner_clusters.count)
        player_cluster = 1 - non_player_cluster
        return kmeans.cluster_centers_[player_cluster]

    def assign_team_color(self, frame, player_detections):
        player_colors = []
        player_x_positions = []
        for _, player_detection in player_detections.items():
            bbox = player_detection["bbox"]
            player_colors.append(self.get_player_color(frame, bbox))
            player_x_positions.append((bbox[0] + bbox[2]) / 2)

        # Use 3 clusters (Team1, Team2, Goalkeeper) when enough players present
        n_clusters = 3 if len(player_colors) >= 3 else 2
        kmeans = KMeans(n_clusters=n_clusters, init="k-means++", n_init=10)
        kmeans.fit(player_colors)
        self.kmeans = kmeans

        labels = kmeans.labels_
        if n_clusters == 3:
            # Smallest cluster = goalkeeper (only 1-2 per team)
            counts = [int(np.sum(labels == i)) for i in range(3)]
            self._gk_cluster = int(np.argmin(counts))
            team_clusters = [i for i in range(3) if i != self._gk_cluster]
        else:
            self._gk_cluster = None
            team_clusters = [0, 1]

        self.team_colors[1] = kmeans.cluster_centers_[team_clusters[0]]
        self.team_colors[2] = kmeans.cluster_centers_[team_clusters[1]]
        self._team_cluster_map = {team_clusters[0]: 1, team_clusters[1]: 2}

        # Determine which team plays on the left vs right by average x position
        xs_0 = [player_x_positions[i] for i, l in enumerate(labels) if l == team_clusters[0]]
        xs_1 = [player_x_positions[i] for i, l in enumerate(labels) if l == team_clusters[1]]
        mean_x_0 = sum(xs_0) / len(xs_0) if xs_0 else float('inf')
        mean_x_1 = sum(xs_1) / len(xs_1) if xs_1 else float('inf')
        if mean_x_0 < mean_x_1:
            self.left_team_id, self.right_team_id = 1, 2
        else:
            self.left_team_id, self.right_team_id = 2, 1

    def assign_team_color_multi(self, frames_players):
        """Fit team colours from multiple (frame, player_detections) samples."""
        player_colors = []
        player_x_positions = []
        for frame, player_detections in frames_players:
            for _, player_detection in player_detections.items():
                bbox = player_detection["bbox"]
                try:
                    color = self.get_player_color(frame, bbox)
                    player_colors.append(color)
                    player_x_positions.append((bbox[0] + bbox[2]) / 2)
                except Exception:
                    continue

        if len(player_colors) < 2:
            self.team_colors[1] = np.array([255, 0, 0])
            self.team_colors[2] = np.array([0, 0, 255])
            self._gk_cluster = None
            self._team_cluster_map = {0: 1, 1: 2}
            return

        n_clusters = 3 if len(player_colors) >= 3 else 2
        kmeans = KMeans(n_clusters=n_clusters, init="k-means++", n_init=10)
        kmeans.fit(player_colors)
        self.kmeans = kmeans

        labels = kmeans.labels_
        if n_clusters == 3:
            counts = [int(np.sum(labels == i)) for i in range(3)]
            self._gk_cluster = int(np.argmin(counts))
            team_clusters = [i for i in range(3) if i != self._gk_cluster]
        else:
            self._gk_cluster = None
            team_clusters = [0, 1]

        self.team_colors[1] = kmeans.cluster_centers_[team_clusters[0]]
        self.team_colors[2] = kmeans.cluster_centers_[team_clusters[1]]
        self._team_cluster_map = {team_clusters[0]: 1, team_clusters[1]: 2}

        xs_0 = [player_x_positions[i] for i, l in enumerate(labels) if l == team_clusters[0]]
        xs_1 = [player_x_positions[i] for i, l in enumerate(labels) if l == team_clusters[1]]
        mean_x_0 = sum(xs_0) / len(xs_0) if xs_0 else float('inf')
        mean_x_1 = sum(xs_1) / len(xs_1) if xs_1 else float('inf')
        if mean_x_0 < mean_x_1:
            self.left_team_id, self.right_team_id = 1, 2
        else:
            self.left_team_id, self.right_team_id = 2, 1

    def get_player_team(self, frame, player_bbox, player_id):
        if player_id in self.player_team_dict:
            return self.player_team_dict[player_id]

        player_color = self.get_player_color(frame, player_bbox)
        predicted_cluster = int(self.kmeans.predict(player_color.reshape(1, -1))[0])

        frame_width = frame.shape[1]
        player_center_x = (player_bbox[0] + player_bbox[2]) / 2

        # Goalkeeper cluster or near-goal position → assign by field side, not jersey
        is_gk_color = (hasattr(self, '_gk_cluster') and
                       self._gk_cluster is not None and
                       predicted_cluster == self._gk_cluster)
        is_near_goal = (player_center_x < frame_width * 0.15 or
                        player_center_x > frame_width * 0.85)

        if is_gk_color or is_near_goal:
            team_id = (self.left_team_id if player_center_x < frame_width * 0.5
                       else self.right_team_id)
        else:
            team_id = self._team_cluster_map.get(predicted_cluster,
                                                  predicted_cluster + 1)

        self.player_team_dict[player_id] = team_id
        return team_id
