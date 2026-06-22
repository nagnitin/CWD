/* Types for crowd metrics, zones, and risk */

export interface ZoneMetrics {
  zone_id: string;
  bbox?: { x1: number; y1: number; x2: number; y2: number };
  person_count: number;
  density: number;
  occupancy?: number;
  velocity_avg?: number;
  flow_consistency?: number;
  growth_rate?: number;
  pressure_score?: number;
  risk_score: number;
  risk_level: RiskLevel;
}

export interface FlowArrow {
  x: number;
  y: number;
  dx: number;
  dy: number;
  magnitude: number;
  angle: number;
}

export interface CrowdSnapshot {
  type: string;
  frame_number: number;
  timestamp: number;
  total_persons: number;
  overall_cri: number;
  risk_level: RiskLevel;
  metrics: {
    density: number;
    occupancy: number;
    velocity_avg: number;
    flow_consistency: number;
    pressure_score: number;
    flow_conflict: number;
    density_growth_rate: number;
    speed_drop: number;
    counter_flow_ratio: number;
  };
  zones: ZoneMetrics[];
  detections?: Detection[];
  heatmap_url?: string;
  flow_arrows?: FlowArrow[];
  forecasts?: {
    [key: string]: {
      zones: ZoneMetrics[];
      heatmap_url?: string;
    };
  };
}

export interface Detection {
  bbox: { x1: number; y1: number; x2: number; y2: number };
  confidence: number;
  track_id?: number;
  velocity?: number;
  direction?: number;
  trajectory?: { x: number; y: number }[];
}

export interface CrowdMetric {
  id: string;
  video_id?: string;
  camera_id?: string;
  frame_number: number;
  timestamp: number;
  zone_id?: string;
  person_count: number;
  density: number;
  density_level: string;
  occupancy: number;
  velocity_avg: number;
  flow_consistency: number;
  pressure_score: number;
  risk_score: number;
  risk_level: RiskLevel;
  created_at: string;
}

export type RiskLevel = 'safe' | 'moderate' | 'high' | 'critical';

export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'safe': return 'var(--safe)';
    case 'moderate': return 'var(--moderate)';
    case 'high': return 'var(--high)';
    case 'critical': return 'var(--critical)';
  }
}

export function getCRILevel(cri: number): RiskLevel {
  if (cri <= 25) return 'safe';
  if (cri <= 50) return 'moderate';
  if (cri <= 75) return 'high';
  return 'critical';
}
