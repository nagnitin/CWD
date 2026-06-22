"""
CrowdShield AI — Zone Discovery Module
Performs dynamic, automated zone discovery using DBSCAN spatial clustering
on active crowd detection coordinates.
"""

import logging
import numpy as np
from sklearn.cluster import DBSCAN

logger = logging.getLogger("crowdshield.ai.zones")


class ZoneDiscovery:
    """Clusters active crowd positions into dynamic spatial zones."""

    def __init__(self, eps: float = 180.0, min_samples: int = 3):
        """
        Args:
            eps: DBSCAN maximum distance between two samples to be considered in the same neighborhood.
            min_samples: The number of samples in a neighborhood for a point to be a core point.
        """
        self.eps = eps
        self.min_samples = min_samples

    def discover_zones(self, detections: list, frame_shape: tuple) -> list:
        """Group detections spatially into zones.

        Args:
            detections: List of active detections with 'bbox' fields.
            frame_shape: (height, width) of the video frame.

        Returns:
            A list of zone dicts, each with:
                - zone_id: str
                - bbox: {x1, y1, x2, y2}
                - detections: list of detections belonging to this zone.
        """
        h, w = frame_shape[:2]

        if not detections:
            return self._get_fallback_grid_zones([], w, h)

        # 1. Extract centroid coordinates for clustering
        centroids = []
        for det in detections:
            bbox = det["bbox"]
            if isinstance(bbox, dict):
                cx = (bbox["x1"] + bbox["x2"]) / 2.0
                cy = (bbox["y1"] + bbox["y2"]) / 2.0
            else:
                cx = (bbox[0] + bbox[2]) / 2.0
                cy = (bbox[1] + bbox[3]) / 2.0
            centroids.append([cx, cy])

        X = np.array(centroids)

        # If we have fewer detections than min_samples, DBSCAN cannot cluster
        if X.shape[0] < self.min_samples:
            return self._get_fallback_grid_zones(detections, w, h)

        # 2. Run DBSCAN clustering
        try:
            clustering = DBSCAN(eps=self.eps, min_samples=self.min_samples).fit(X)
            labels = clustering.labels_
        except Exception as e:
            logger.error(f"DBSCAN clustering failed: {e}")
            return self._get_fallback_grid_zones(detections, w, h)

        unique_labels = set(labels)
        discovered_zones = []
        noise_detections = []

        # 3. Aggregate detections by cluster label
        for label in unique_labels:
            indices = np.where(labels == label)[0]
            cluster_dets = [detections[idx] for idx in indices]

            if label == -1:
                # Noise points (outliers not in any zone)
                noise_detections.extend(cluster_dets)
                continue

            # Compute bounding box of the cluster
            x1s, y1s, x2s, y2s = [], [], [], []
            for det in cluster_dets:
                bbox = det["bbox"]
                if isinstance(bbox, dict):
                    x1s.append(bbox["x1"])
                    y1s.append(bbox["y1"])
                    x2s.append(bbox["x2"])
                    y2s.append(bbox["y2"])
                else:
                    x1s.append(bbox[0])
                    y1s.append(bbox[1])
                    x2s.append(bbox[2])
                    y2s.append(bbox[3])

            zone_bbox = {
                "x1": float(np.min(x1s)),
                "y1": float(np.min(y1s)),
                "x2": float(np.max(x2s)),
                "y2": float(np.max(y2s)),
            }

            discovered_zones.append({
                "zone_id": f"zone_{label}",
                "bbox": zone_bbox,
                "detections": cluster_dets,
            })

        # Distribute noise detections to their closest discovered zone
        for noise in noise_detections:
            if not discovered_zones:
                break
            
            # Find center of noise detection
            nb = noise["bbox"]
            ncx = (nb["x1"] + nb["x2"]) / 2.0 if isinstance(nb, dict) else (nb[0] + nb[2]) / 2.0
            ncy = (nb["y1"] + nb["y2"]) / 2.0 if isinstance(nb, dict) else (nb[1] + nb[3]) / 2.0

            # Calculate distances to zone centers
            closest_zone = None
            min_dist = float("inf")
            for zone in discovered_zones:
                zb = zone["bbox"]
                zcx = (zb["x1"] + zb["x2"]) / 2.0
                zcy = (zb["y1"] + zb["y2"]) / 2.0
                dist = math.sqrt((ncx - zcx) ** 2 + (ncy - zcy) ** 2)
                if dist < min_dist:
                    min_dist = dist
                    closest_zone = zone

            if closest_zone and min_dist < self.eps * 1.5:
                closest_zone["detections"].append(noise)

        # If DBSCAN grouped everything as noise, fall back to default grid
        if not discovered_zones:
            return self._get_fallback_grid_zones(detections, w, h)

        return discovered_zones

    def _get_fallback_grid_zones(self, detections: list, width: int, height: int) -> list:
        """Divide the frame into 3 static columns as a fallback structure."""
        zones = [
            {"zone_id": "zone_a", "bbox": {"x1": 0.0, "y1": 0.0, "x2": width / 3.0, "y2": float(height)}, "detections": []},
            {"zone_id": "zone_b", "bbox": {"x1": width / 3.0, "y1": 0.0, "x2": 2.0 * width / 3.0, "y2": float(height)}, "detections": []},
            {"zone_id": "zone_c", "bbox": {"x1": 2.0 * width / 3.0, "y1": 0.0, "x2": float(width), "y2": float(height)}, "detections": []},
        ]

        for det in detections:
            bbox = det["bbox"]
            x1 = bbox["x1"] if isinstance(bbox, dict) else bbox[0]
            
            if x1 < width / 3.0:
                zones[0]["detections"].append(det)
            elif x1 < 2.0 * width / 3.0:
                zones[1]["detections"].append(det)
            else:
                zones[2]["detections"].append(det)

        return zones
