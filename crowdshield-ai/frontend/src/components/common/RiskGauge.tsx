/* RiskGauge — animated circular gauge for Crowd Risk Index (0-100) */

import { useMemo } from 'react';
import { getRiskColor, getCRILevel, type RiskLevel } from '../../types/crowd';

interface RiskGaugeProps {
  value: number;  // 0-100
  size?: number;
  strokeWidth?: number;
}

export default function RiskGauge({
  value,
  size = 160,
  strokeWidth = 8,
}: RiskGaugeProps) {
  const level = getCRILevel(value);
  const color = getRiskColor(level);

  const { radius, circumference, offset } = useMemo(() => {
    const r = (size - strokeWidth * 2) / 2;
    const c = 2 * Math.PI * r;
    const progress = Math.max(0, Math.min(100, value)) / 100;
    const o = c * (1 - progress);
    return { radius: r, circumference: c, offset: o };
  }, [value, size, strokeWidth]);

  const center = size / 2;

  const levelLabel: Record<RiskLevel, string> = {
    safe: 'SAFE',
    moderate: 'MODERATE',
    high: 'HIGH',
    critical: 'CRITICAL',
  };

  return (
    <div className="risk-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <circle
          className="gauge-track"
          cx={center}
          cy={center}
          r={radius}
        />
        {/* Animated fill */}
        <circle
          className="gauge-fill"
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            filter: level === 'critical'
              ? `drop-shadow(0 0 8px ${color})`
              : `drop-shadow(0 0 4px ${color}40)`,
          }}
        />
      </svg>
      <div className="gauge-center">
        <span className="gauge-value" style={{ color }}>
          {Math.round(value)}
        </span>
        <span className="gauge-label" style={{ color }}>
          {levelLabel[level]}
        </span>
      </div>
    </div>
  );
}
