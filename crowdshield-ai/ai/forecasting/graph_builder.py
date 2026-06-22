"""
CrowdShield AI — Spatial Graph Builder
Constructs spatial adjacency matrices and computes normalized graph Laplacians
from discovered zone boundaries.
"""

import math
import numpy as np
import scipy.sparse as sp


class GraphBuilder:
    """Builds neighborhood adjacency and Laplacian matrices from dynamic zone coordinates."""

    def __init__(self, distance_threshold: float = 600.0, sigma: float = 300.0):
        """
        Args:
            distance_threshold: Pixels threshold beyond which zones are considered disconnected.
            sigma: Scaling parameter for Gaussian weight kernel.
        """
        self.distance_threshold = distance_threshold
        self.sigma = sigma

    def build_graph(self, zones: list) -> tuple[np.ndarray, np.ndarray]:
        """Build adjacency and normalized Laplacian matrices from zone bounds.

        Args:
            zones: List of zone metrics/dicts containing 'bbox' and 'zone_id'.

        Returns:
            A tuple of (adjacency_matrix, symmetric_laplacian) as numpy float32 arrays.
        """
        num_nodes = len(zones)
        if num_nodes == 0:
            return np.zeros((1, 1), dtype=np.float32), np.zeros((1, 1), dtype=np.float32)

        # 1. Extract centers
        centers = []
        for zone in zones:
            bbox = zone["bbox"]
            cx = (bbox["x1"] + bbox["x2"]) / 2.0
            cy = (bbox["y1"] + bbox["y2"]) / 2.0
            centers.append((cx, cy))

        # 2. Compute Gaussian-weighted adjacency matrix
        adj = np.zeros((num_nodes, num_nodes), dtype=np.float32)
        for i in range(num_nodes):
            for j in range(i, num_nodes):
                if i == j:
                    adj[i, j] = 0.0  # no self loops in adjacency
                    continue

                dx = centers[i][0] - centers[j][0]
                dy = centers[i][1] - centers[j][1]
                dist = math.sqrt(dx * dx + dy * dy)

                if dist < self.distance_threshold:
                    weight = math.exp(-(dist * dist) / (self.sigma * self.sigma))
                    adj[i, j] = weight
                    adj[j, i] = weight

        # 3. Compute normalized symmetric Laplacian: L_sym = I - D^(-1/2) * A * D^(-1/2)
        # Degree vector
        degree = np.sum(adj, axis=1)
        
        # Identity matrix
        I = np.identity(num_nodes, dtype=np.float32)
        
        # Handle disconnected node degree to prevent division-by-zero
        with np.errstate(divide='ignore', invalid='ignore'):
            degree_inv_sqrt = np.power(degree, -0.5)
            degree_inv_sqrt[np.isinf(degree_inv_sqrt)] = 0.0
            degree_inv_sqrt[np.isnan(degree_inv_sqrt)] = 0.0
            
        D_inv_sqrt = np.diag(degree_inv_sqrt)
        
        # L_sym = I - D^(-1/2) @ A @ D^(-1/2)
        # Note: some STGCN implementations use the symmetric normalized adjacency (D_inv_sqrt @ A @ D_inv_sqrt)
        # instead, which we compute here
        laplacian = D_inv_sqrt @ adj @ D_inv_sqrt

        # Add self-loops to prevent disappearing features
        laplacian = laplacian + I

        return adj, laplacian.astype(np.float32)
