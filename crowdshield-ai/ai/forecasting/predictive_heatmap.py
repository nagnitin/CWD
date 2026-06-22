"""
CrowdShield AI — Predictive Heatmap Generator
Generates future crowd density heatmaps from forecasted zone metrics,
returning transparent base64 PNG strings.
"""

import numpy as np
from ai.density.heatmap_generator import generate_heatmap_uri


def generate_predictive_heatmap(
    predicted_zones: list,
    frame_shape: tuple,
    target_shape: tuple = (360, 640)
) -> str:
    """Generate a density heatmap from predicted zone densities.

    Args:
        predicted_zones: List of predicted zones containing 'bbox' and 'density'.
        frame_shape: (height, width) of the source video frame.
        target_shape: (height, width) for resizing the final output heatmap.

    Returns:
        A base64 encoded PNG data URI string of the future heatmap.
    """
    h, w = frame_shape[:2]
    out_h, out_w = h // 8, w // 8
    
    if out_h == 0 or out_w == 0:
        return ""

    # Create empty density map grid
    pred_density_map = np.zeros((out_h, out_w), dtype=np.float32)

    for zone in predicted_zones:
        density = zone["density"]
        if density <= 0.0:
            continue
            
        bbox = zone["bbox"]  # in original pixel coordinates
        
        # Scale zone coordinates to density map grid resolution
        x1 = int(bbox["x1"] / 8.0)
        y1 = int(bbox["y1"] / 8.0)
        x2 = int(bbox["x2"] / 8.0)
        y2 = int(bbox["y2"] / 8.0)

        # Cap boundaries
        x1 = max(0, min(out_w - 1, x1))
        x2 = max(0, min(out_w - 1, x2))
        y1 = max(0, min(out_h - 1, y1))
        y2 = max(0, min(out_h - 1, y2))

        if x1 >= x2 or y1 >= y2:
            continue

        # Distribute the density within the zone's grid box
        # Add a Gaussian peak in the center of the zone box for realism
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0
        
        # Standard deviation proportional to zone box size
        sigma_x = max(1.0, (x2 - x1) / 3.0)
        sigma_y = max(1.0, (y2 - y1) / 3.0)

        # Apply Gaussian distributions to generate continuous heat maps
        for y in range(y1, y2 + 1):
            for x in range(x1, x2 + 1):
                dist_x = (x - cx) ** 2
                dist_y = (y - cy) ** 2
                val = np.exp(-dist_x / (2 * sigma_x ** 2) - dist_y / (2 * sigma_y ** 2))
                
                # Scale weight to match target predicted density value
                pred_density_map[y, x] += val * density * 0.15

    # Smooth the overall predicted density map slightly using Gaussian blur
    # to blend borders together nicely
    # (Avoid using cv2.GaussianBlur directly on small float grids to prevent zero clipping)
    
    # Generate transparent base64 data URI
    return generate_heatmap_uri(pred_density_map, target_shape=target_shape)
