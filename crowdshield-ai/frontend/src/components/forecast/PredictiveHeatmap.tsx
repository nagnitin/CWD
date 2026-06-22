import { TrendingUp, Activity, Layers } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import type { RiskLevel } from '../../types/crowd';

interface HeatmapFrameProps {
  title: string;
  heatmapUrl?: string;
  cri: number;
  riskLevel: RiskLevel;
  timeLabel: string;
}

function HeatmapCard({
  title,
  heatmapUrl,
  cri,
  riskLevel,
  timeLabel,
}: HeatmapFrameProps) {
  return (
    <div className="glass-card heatmap-card animate-fade-in" style={{
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      border: '1px solid var(--border-color)',
    }}>
      {/* Header Info */}
      <div style={{
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.02)',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{timeLabel}</span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-bright)' }}>{title}</span>
        </div>
        <StatusBadge status={riskLevel} />
      </div>

      {/* Visual map preview */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#090d16', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Placeholder background video/image to represent camera scene */}
        <div style={{
          width: '100%',
          height: '100%',
          opacity: 0.15,
          background: 'radial-gradient(circle at center, rgba(6,182,212,0.15) 0%, transparent 80%)'
        }} />
        
        {/* Transparent overlay density heatmap image */}
        {heatmapUrl ? (
          <img
            src={heatmapUrl}
            alt={`${title} Density`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.75,
            }}
          />
        ) : (
          <div style={{ position: 'absolute', color: 'var(--text-muted)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={14} />
            <span>Calculating Projections...</span>
          </div>
        )}

        {/* Small bottom float indicator */}
        <div style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          background: 'rgba(15,23,42,0.8)',
          borderRadius: 4,
          padding: '2px 6px',
          fontSize: '10px',
          fontWeight: 700,
          color: 'var(--accent)',
          border: '1px solid rgba(6,182,212,0.3)'
        }}>
          CRI: {Math.round(cri)}
        </div>
      </div>
    </div>
  );
}

interface PredictiveHeatmapProps {
  nowHeatmap?: string;
  nowCri?: number;
  nowRisk?: RiskLevel;
  
  forecasts?: {
    [key: string]: {
      zones: any[];
      heatmap_url?: string;
    };
  };
}

export default function PredictiveHeatmap({
  nowHeatmap,
  nowCri = 0,
  nowRisk = 'safe',
  forecasts,
}: PredictiveHeatmapProps) {
  // Extract forecast metrics
  const f1 = forecasts?.['+1m'];
  const f3 = forecasts?.['+3m'];
  const f5 = forecasts?.['+5m'];

  // Calculate overall CRI predictions (mean of predicted zone risk scores)
  const getCRIProjections = (horizonZones: any[] = []) => {
    if (horizonZones.length === 0) return 0;
    return horizonZones.reduce((acc, curr) => acc + curr.risk_score, 0) / horizonZones.length;
  };

  const getRiskLevel = (cri: number): RiskLevel => {
    if (cri <= 25) return 'safe';
    if (cri <= 50) return 'moderate';
    if (cri <= 75) return 'high';
    return 'critical';
  };

  const cri1 = f1 ? getCRIProjections(f1.zones) : nowCri * 1.05;
  const cri3 = f3 ? getCRIProjections(f3.zones) : nowCri * 1.12;
  const cri5 = f5 ? getCRIProjections(f5.zones) : nowCri * 1.25;

  return (
    <div className="glass-card panel-wide animate-fade-in" style={{ gridColumn: 'span 3' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="card-title">
          <TrendingUp size={16} className="text-cyan" />
          Predictive Density Map Projections
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Activity size={12} />
          Spatio-Temporal Graph Predictions Active
        </span>
      </div>

      <div style={{
        padding: 'var(--space-md)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 'var(--space-md)'
      }}>
        <HeatmapCard
          title="Current State"
          heatmapUrl={nowHeatmap}
          cri={nowCri}
          riskLevel={nowRisk}
          timeLabel="T = 0s"
        />
        <HeatmapCard
          title="1 Min Forecast"
          heatmapUrl={f1?.heatmap_url}
          cri={cri1}
          riskLevel={getRiskLevel(cri1)}
          timeLabel="T = +60s"
        />
        <HeatmapCard
          title="3 Min Forecast"
          heatmapUrl={f3?.heatmap_url}
          cri={cri3}
          riskLevel={getRiskLevel(cri3)}
          timeLabel="T = +180s"
        />
        <HeatmapCard
          title="5 Min Forecast"
          heatmapUrl={f5?.heatmap_url}
          cri={cri5}
          riskLevel={getRiskLevel(cri5)}
          timeLabel="T = +300s"
        />
      </div>
    </div>
  );
}
