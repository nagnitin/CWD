/* Dashboard — main overview with 8-panel grid layout */

import { useState, useCallback } from 'react';
import {
  Users, Activity, Shield, TrendingUp,
  AlertTriangle, Cpu, Radio, Eye,
  Gauge, Target,
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import MetricCard from '../components/common/MetricCard';
import RiskGauge from '../components/common/RiskGauge';
import StatusBadge from '../components/common/StatusBadge';
import { useWebSocket } from '../hooks/useWebSocket';
import { type CrowdSnapshot } from '../types/crowd';

// Generate initial chart data
function generateChartData(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    time: i,
    cri: 0,
    density: 0,
    count: 0,
    pressure: 0,
  }));
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<CrowdSnapshot | null>(null);
  const [chartData, setChartData] = useState(generateChartData(30));
  const [activeAlerts, setActiveAlerts] = useState<Array<{ level: string; reason: string; time: string }>>([]);

  const handleMessage = useCallback((data: any) => {
    if (data.type === 'crowd_update') {
      setMetrics(data as CrowdSnapshot);
      setChartData((prev) => {
        const next = [...prev.slice(1), {
          time: prev.length > 0 ? prev[prev.length - 1].time + 1 : 0,
          cri: data.overall_cri,
          density: data.metrics.density,
          count: data.total_persons,
          pressure: data.metrics.pressure_score,
        }];
        return next;
      });

      if (data.video_id === null) {
        setActiveAlerts([]);
        return;
      }

      const newAlerts: Array<{ level: string; reason: string; time: string }> = [];
      const criScore = data.overall_cri || 0;
      if (criScore >= 75) {
        newAlerts.push({ level: 'critical', reason: `Stampede risk! Overall CRI at ${criScore.toFixed(0)}%.`, time: 'Just now' });
      } else if (criScore >= 50) {
        newAlerts.push({ level: 'high', reason: `High crowd risk detected (CRI: ${criScore.toFixed(0)}%).`, time: 'Just now' });
      }

      const sh = data.scaffolding_hazard;
      if (sh && (sh.state === 'CRITICAL' || sh.state === 'ALERTING')) {
        newAlerts.push({
          level: sh.state === 'CRITICAL' ? 'critical' : 'high',
          reason: `Structural Movement: Scaffolding displacement at ${sh.displacement.toFixed(1)}px!`,
          time: 'Just now'
        });
      }
      setActiveAlerts(newAlerts);
    }
  }, []);

  useWebSocket({
    url: '/ws/live',
    onMessage: handleMessage,
    autoConnect: true,
  });

  const cri = metrics?.overall_cri ?? 0;
  const riskLevel = metrics?.risk_level ?? 'safe';
  const alertCount = activeAlerts.length;

  const getRiskLevelForVal = (val: number) => {
    if (val <= 25) return 'safe';
    if (val <= 50) return 'moderate';
    if (val <= 75) return 'high';
    return 'critical';
  };

  const forecast1 = Math.min(100, Math.round(cri * 1.1));
  const forecast3 = Math.min(100, Math.round(cri * 1.25));
  const forecast5 = Math.min(100, Math.round(cri * 1.4));

  const forecastData = [
    { horizon: '+1 min', risk: forecast1, level: getRiskLevelForVal(forecast1) },
    { horizon: '+3 min', risk: forecast3, level: getRiskLevelForVal(forecast3) },
    { horizon: '+5 min', risk: forecast5, level: getRiskLevelForVal(forecast5) },
  ];

  return (
    <div className="stagger-children">
      {/* ─── Top Metrics Row ──────────────────────────────────── */}
      <div className="metrics-row">
        <MetricCard
          label="Total Persons"
          value={metrics?.total_persons ?? 0}
          icon={<Users size={16} />}
          trend={metrics ? 'up' : 'stable'}
          trendValue="+12%"
          colorClass="accent"
        />
        <MetricCard
          label="Avg Density"
          value={`${metrics?.metrics?.density?.toFixed(1) ?? '0.0'} p/m²`}
          icon={<Target size={16} />}
          trend="up"
          trendValue="+0.3"
          colorClass={riskLevel}
        />
        <MetricCard
          label="Pressure Score"
          value={metrics?.metrics?.pressure_score?.toFixed(0) ?? '0'}
          icon={<Gauge size={16} />}
          trend="stable"
          trendValue="±2"
          colorClass={riskLevel}
        />
        <MetricCard
          label="Active Alerts"
          value={alertCount}
          icon={<AlertTriangle size={16} />}
          trend={alertCount > 0 ? 'up' : 'stable'}
          trendValue={alertCount > 0 ? 'Attention' : 'Clear'}
          colorClass={alertCount > 2 ? 'critical' : alertCount > 0 ? 'moderate' : 'safe'}
        />
      </div>

      {/* ─── Main Dashboard Grid ─────────────────────────────── */}
      <div className="dashboard-grid">
        {/* Risk Index Panel */}
        <div className="glass-card">
          <div className="card-header">
            <span className="card-title">
              <Shield size={16} />
              Crowd Risk Index
            </span>
            <StatusBadge status={riskLevel} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
            <RiskGauge value={cri} size={150} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
            <div style={{ textAlign: 'center', padding: '6px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
              <div className="mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {metrics?.metrics?.velocity_avg?.toFixed(1) ?? '0.0'}
              </div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Velocity</div>
            </div>
            <div style={{ textAlign: 'center', padding: '6px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
              <div className="mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {((metrics?.metrics?.flow_consistency ?? 0) * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Flow</div>
            </div>
          </div>
        </div>

        {/* CRI Trend Panel */}
        <div className="glass-card panel-wide">
          <div className="card-header">
            <span className="card-title">
              <Activity size={16} />
              Risk Trend
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Last 30 frames</span>
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="criGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <YAxis domain={[0, 100]} hide />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.75rem',
                    color: 'var(--text-primary)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cri"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fill="url(#criGradient)"
                  dot={false}
                  animationDuration={300}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Crowd Count Panel */}
        <div className="glass-card">
          <div className="card-header">
            <span className="card-title">
              <Users size={16} />
              Crowd Count
            </span>
          </div>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="time" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.75rem',
                    color: 'var(--text-primary)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={false}
                  animationDuration={300}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Zone Status Panel */}
        <div className="glass-card panel-wide">
          <div className="card-header">
            <span className="card-title">
              <Eye size={16} />
              Zone Status
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Auto-discovered</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(metrics?.zones ?? [
              { zone_id: 'zone_0', person_count: 0, density: 0.0, risk_score: 0, risk_level: 'safe' as const },
              { zone_id: 'zone_1', person_count: 0, density: 0.0, risk_score: 0, risk_level: 'safe' as const },
              { zone_id: 'zone_2', person_count: 0, density: 0.0, risk_score: 0, risk_level: 'safe' as const },
            ]).map((zone) => (
              <div
                key={zone.zone_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: `3px solid var(--${zone.risk_level})`,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    {zone.zone_id.replace('_', ' ').toUpperCase()}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                    {zone.person_count} persons · {zone.density?.toFixed(1)} p/m²
                  </div>
                </div>
                <StatusBadge status={zone.risk_level} />
                <div className="mono" style={{ fontSize: '1rem', fontWeight: 800, color: `var(--${zone.risk_level})` }}>
                  {zone.risk_score?.toFixed(0)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Forecast Preview Panel */}
        <div className="glass-card">
          <div className="card-header">
            <span className="card-title">
              <TrendingUp size={16} />
              Forecast
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {forecastData.map((f) => (
              <div
                key={f.horizon}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{f.horizon}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: 60, height: 4, background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-full)', overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${f.risk}%`, height: '100%',
                      background: `var(--${f.level})`,
                      borderRadius: 'var(--radius-full)',
                    }} />
                  </div>
                  <span className="mono" style={{ fontSize: '0.8rem', fontWeight: 700, color: `var(--${f.level})` }}>
                    {f.risk}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alert Feed Panel */}
        <div className="glass-card">
          <div className="card-header">
            <span className="card-title">
              <AlertTriangle size={16} />
              Recent Alerts
            </span>
            <span className="nav-badge">{alertCount}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {activeAlerts.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                No active alerts. System status nominal.
              </div>
            ) : (
              activeAlerts.map((alert, i) => (
                <div key={i} className={`alert-card ${alert.level}`}>
                  <div className="alert-content">
                    <div className="alert-title">{alert.level.toUpperCase()}</div>
                    <div className="alert-detail">{alert.reason}</div>
                  </div>
                  <span className="alert-time">{alert.time}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* System Health Panel */}
        <div className="glass-card">
          <div className="card-header">
            <span className="card-title">
              <Cpu size={16} />
              System Health
            </span>
            <StatusBadge status="connected" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: 'CPU', value: 42, color: 'var(--safe)' },
              { label: 'GPU', value: 67, color: 'var(--moderate)' },
              { label: 'Memory', value: 55, color: 'var(--moderate)' },
              { label: 'Inference', value: '18.5 FPS', isText: true },
            ].map((item, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {item.label}
                  </span>
                  <span className="mono" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {'isText' in item ? item.value : `${item.value}%`}
                  </span>
                </div>
                {!('isText' in item) && (
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${item.value}%`, background: item.color }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 5G Analytics Panel */}
        <div className="glass-card">
          <div className="card-header">
            <span className="card-title">
              <Radio size={16} />
              5G Network
            </span>
            <span className="header-mode" style={{ fontSize: '0.6rem', padding: '2px 8px' }}>SIMULATED</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { label: 'Latency', value: '35ms', sub: 'E2E' },
              { label: 'Throughput', value: '180', sub: 'Mbps' },
              { label: 'Packet Loss', value: '0.1%', sub: 'Rate' },
              { label: 'Jitter', value: '2.3ms', sub: 'Avg' },
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '10px 8px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  gap: 2,
                }}
              >
                <span className="mono" style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                  {item.value}
                </span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
