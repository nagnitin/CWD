"""
CrowdShield AI — Density estimation module
"""

from ai.density.csrnet import DensityEstimator
from ai.density.heatmap_generator import generate_heatmap_uri

__all__ = ["DensityEstimator", "generate_heatmap_uri"]
