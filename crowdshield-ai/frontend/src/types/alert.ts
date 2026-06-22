/* Types for alerts */

export type AlertLevel = 'info' | 'warning' | 'high' | 'critical';

export interface Alert {
  id: string;
  level: AlertLevel;
  alert_type: string;
  zone?: string;
  reason: string;
  confidence: number;
  prediction_horizon?: string;
  recommended_action?: string;
  confirmation_frames: number;
  persistence_seconds: number;
  fused_confidence: number;
  acknowledged: boolean;
  resolved: boolean;
  is_false_alarm: boolean;
  created_at: string;
}

export interface AlertStats {
  total: number;
  info: number;
  warning: number;
  high: number;
  critical: number;
  false_alarm_rate: number;
  avg_lead_time_seconds: number;
}
