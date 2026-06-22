"""
CrowdShield AI — Heatmap Generator
Converts 2D density maps to color-coded, transparent RGBA heatmaps,
encoded as base64 data URIs for direct WebSocket transmission.
"""

import cv2
import base64
import numpy as np


def generate_heatmap_uri(density_map: np.ndarray, target_shape: tuple = (360, 640)) -> str:
    """Convert raw density map into a base64 encoded transparent RGBA image.

    Args:
        density_map: 2D numpy array containing estimated densities.
        target_shape: (height, width) to resize the final heatmap image to.

    Returns:
        A base64 data URI string (e.g., 'data:image/png;base64,iVBORw0...')
    """
    if density_map is None or density_map.size == 0:
        return ""

    # 1. Normalize density values to 0-255 range
    max_val = density_map.max()
    if max_val > 0:
        normalized = (density_map / max_val * 255.0).astype(np.uint8)
    else:
        normalized = np.zeros_like(density_map, dtype=np.uint8)

    # 2. Resize to target shape for display
    h, w = target_shape[:2]
    resized = cv2.resize(normalized, (w, h), interpolation=cv2.INTER_LINEAR)

    # 3. Apply color mapping (COLORMAP_JET matches blue-cyan-green-yellow-red scale)
    color_mapped = cv2.applyColorMap(resized, cv2.COLORMAP_JET)

    # 4. Generate alpha channel (transparent where density is zero)
    # Scale alpha to max 160 (to keep overlay semi-transparent)
    alpha = (resized.astype(float) * (160.0 / 255.0)).astype(np.uint8)

    # Threshold very small alpha values to 0 to prevent background bleed
    alpha[alpha < 15] = 0

    # Merge BGR and Alpha channels to create RGBA
    b, g, r = cv2.split(color_mapped)
    rgba = cv2.merge([b, g, r, alpha])

    # 5. Compress to PNG and encode as base64
    _, buffer = cv2.imencode(".png", rgba)
    base64_str = base64.b64encode(buffer).decode("utf-8")

    return f"data:image/png;base64,{base64_str}"
