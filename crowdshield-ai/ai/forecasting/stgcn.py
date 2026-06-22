"""
CrowdShield AI — Spatio-Temporal Graph Convolutional Network (STGCN)
PyTorch implementation of the STGCN architecture for crowd dynamic forecasting.
"""

import math
import torch
import torch.nn as nn


class TemporalConvLayer(nn.Module):
    """1D Temporal Convolutional Layer with Gated Linear Units (GLUs)."""

    def __init__(self, in_channels: int, out_channels: int, kernel_size: int = 3):
        super(TemporalConvLayer, self).__init__()
        # GLU output has half the channels, so we double the conv output channels
        self.conv = nn.Conv2d(in_channels, out_channels * 2, kernel_size=(1, kernel_size), padding=(0, 0))
        self.sigmoid = nn.Sigmoid()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Input shape: (Batch, Channels, Nodes, TimeSteps)
        out = self.conv(x)
        # Split channels in half for gated activation
        lhs, rhs = torch.chunk(out, 2, dim=1)
        return lhs * self.sigmoid(rhs)


class SpatialGraphConvLayer(nn.Module):
    """Spatial Graph Convolutional Layer modeling spatial dependencies across zones."""

    def __init__(self, in_channels: int, out_channels: int):
        super(SpatialGraphConvLayer, self).__init__()
        self.weight = nn.Parameter(torch.FloatTensor(in_channels, out_channels))
        self.bias = nn.Parameter(torch.FloatTensor(out_channels))
        self.reset_parameters()

    def reset_parameters(self):
        stdv = 1.0 / math.sqrt(self.weight.size(1))
        self.weight.data.uniform_(-stdv, stdv)
        self.bias.data.fill_(0.0)

    def forward(self, x: torch.Tensor, laplacian: torch.Tensor) -> torch.Tensor:
        """Forward pass.

        Args:
            x: Input tensor of shape (Batch, Channels, Nodes, TimeSteps)
            laplacian: Normalized Laplacian matrix of shape (Nodes, Nodes)

        Returns:
            Spatial graph convolved tensor of shape (Batch, OutChannels, Nodes, TimeSteps)
        """
        # Reshape to combine Batch, TimeSteps for spatial multiplication
        # Shape: (Batch, TimeSteps, Nodes, Channels)
        x_trans = x.permute(0, 3, 2, 1)
        batch_size, time_steps, num_nodes, num_channels = x_trans.shape

        # Flatten batch and time
        # Shape: (Batch * TimeSteps, Nodes, Channels)
        x_flat = x_trans.reshape(-1, num_nodes, num_channels)

        # 1. Spatial aggregation: A_sym @ X
        # Shape: (Batch * TimeSteps, Nodes, Channels)
        aggregated = torch.matmul(laplacian, x_flat)

        # 2. Linear projection: (A_sym @ X) @ W
        # Shape: (Batch * TimeSteps, Nodes, OutChannels)
        out_flat = torch.matmul(aggregated, self.weight) + self.bias

        # 3. Reshape back
        out = out_flat.reshape(batch_size, time_steps, num_nodes, -1)
        return out.permute(0, 3, 2, 1)


class STGCNBlock(nn.Module):
    """Spatio-Temporal block containing Temporal Conv -> Spatial Conv -> Temporal Conv."""

    def __init__(self, in_channels: int, hidden_channels: int, out_channels: int, kernel_size: int = 3):
        super(STGCNBlock, self).__init__()
        self.temporal1 = TemporalConvLayer(in_channels, hidden_channels, kernel_size)
        self.spatial = SpatialGraphConvLayer(hidden_channels, hidden_channels)
        self.temporal2 = TemporalConvLayer(hidden_channels, out_channels, kernel_size)
        self.layer_norm = nn.LayerNorm(out_channels)

    def forward(self, x: torch.Tensor, laplacian: torch.Tensor) -> torch.Tensor:
        # Input shape: (Batch, Channels, Nodes, TimeSteps)
        out = self.temporal1(x)
        out = self.spatial(out, laplacian)
        out = self.temporal2(out)
        
        # Layer Norm requires channels last
        # Shape: (Batch, TimeSteps, Nodes, Channels)
        out_trans = out.permute(0, 3, 2, 1)
        normalized = self.layer_norm(out_trans)
        return normalized.permute(0, 3, 2, 1)


class STGCN(nn.Module):
    """Spatio-Temporal Graph Convolutional Network (STGCN) model."""

    def __init__(self, num_nodes: int, in_features: int, out_features: int, time_steps_in: int = 12):
        """
        Args:
            num_nodes: Number of spatial zones.
            in_features: Number of input features per zone (e.g. density, velocity).
            out_features: Number of forecasted output features per zone.
            time_steps_in: Input history time window steps (e.g. 12 steps = past 30 seconds).
        """
        super(STGCN, self).__init__()
        self.block1 = STGCNBlock(in_features, 16, 32, kernel_size=3)
        self.block2 = STGCNBlock(32, 32, 64, kernel_size=3)
        
        # Output temporal projection to aggregate forecasted horizons
        # After 2 blocks with temporal conv kernel_size=3, time steps reduce by (3-1)*2*2 = 8 steps.
        # e.g., if input is 12 steps, blocks reduce it to 12 - 4 - 4 = 4 steps.
        remaining_time_steps = time_steps_in - 8
        self.fully_connected = nn.Linear(remaining_time_steps * 64, out_features)

    def forward(self, x: torch.Tensor, laplacian: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: Input feature tensors of shape (Batch, Channels, Nodes, TimeSteps)
            laplacian: Graph adjacency Laplacian (Nodes, Nodes)

        Returns:
            Forecasted metrics of shape (Batch, Nodes, OutFeatures)
        """
        out = self.block1(x, laplacian)
        out = self.block2(out, laplacian)
        
        # Flatten time steps and channels for linear regression projection
        # Shape: (Batch, Nodes, Channels * TimeSteps)
        batch_size, channels, num_nodes, time_steps = out.shape
        out_flat = out.permute(0, 2, 3, 1).reshape(batch_size, num_nodes, -1)
        
        # Project to target prediction steps
        forecast = self.fully_connected(out_flat)
        return forecast
