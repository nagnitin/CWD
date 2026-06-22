/* ForecastTimeline Component — scrubbing controls for choosing forecast time horizons */

import { Clock, Eye } from 'lucide-react';

export type ForecastHorizon = 'now' | '+1m' | '+3m' | '+5m';

interface ForecastTimelineProps {
  currentHorizon: ForecastHorizon;
  onHorizonChange: (horizon: ForecastHorizon) => void;
}

export default function ForecastTimeline({
  currentHorizon,
  onHorizonChange,
}: ForecastTimelineProps) {
  const horizons: { id: ForecastHorizon; label: string; offset: string }[] = [
    { id: 'now', label: 'Real Time (Now)', offset: '0s' },
    { id: '+1m', label: '+1 Minute Projection', offset: '+60s' },
    { id: '+3m', label: '+3 Minutes Projection', offset: '+180s' },
    { id: '+5m', label: '+5 Minutes Projection', offset: '+300s' },
  ];

  return (
    <div className="forecast-timeline-container" style={{
      padding: '12px 16px',
      background: 'rgba(9, 13, 22, 0.6)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--border-radius)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      flexWrap: 'wrap'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Clock size={16} className="text-cyan animate-pulse" />
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-bright)' }}>
          Horizon Scrubber
        </span>
      </div>

      <div className="timeline-buttons" style={{
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        padding: 2,
        gap: 2
      }}>
        {horizons.map((h) => {
          const active = currentHorizon === h.id;
          return (
            <button
              key={h.id}
              onClick={() => onHorizonChange(h.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                background: active ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                boxShadow: active ? 'inset 0 0 10px rgba(6, 182, 212, 0.1)' : 'none',
                transition: 'all var(--transition-fast)'
              }}
            >
              {active && <Eye size={12} />}
              <span>{h.label}</span>
              <span style={{
                fontSize: '10px',
                padding: '1px 4px',
                borderRadius: 4,
                background: active ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                color: active ? '#090d16' : 'var(--text-muted)',
                fontWeight: 700
              }}>
                {h.offset}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
