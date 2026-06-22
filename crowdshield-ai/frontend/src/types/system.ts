/* Types for system health and 5G metrics */

export interface SystemHealth {
  cpu_utilization: number;
  gpu_utilization: number;
  memory_utilization: number;
  disk_utilization: number;
  inference_fps: number;
  active_streams: number;
  deployment_mode: string;
  mec_status: string;
  uptime_seconds: number;
}

export interface LatencyBreakdown {
  camera_latency_ms: number;
  mec_latency_ms: number;
  inference_latency_ms: number;
  alert_latency_ms: number;
  e2e_latency_ms: number;
}

export interface NetworkMetrics {
  throughput_mbps: number;
  packet_loss_percent: number;
  bandwidth_consumption_mbps: number;
  jitter_ms: number;
  deployment_mode: string;
}

export interface CloudVsMEC {
  metric: string;
  cloud_value: number;
  mec_value: number;
  improvement_percent: number;
  unit: string;
}
