import { Zap, Radio, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Analytics() {
  const comparisonData = [
    { metric: 'E2E Latency', cloud: 150, mec: 35, unit: 'ms' },
    { metric: 'Inference', cloud: 80, mec: 25, unit: 'ms' },
    { metric: 'Alert Delivery', cloud: 200, mec: 45, unit: 'ms' },
  ];

  const evaluationMetrics = [
    { metric: 'Density MAE', value: '2.34', target: '< 15%', status: '✅' },
    { metric: 'Density RMSE', value: '3.12', target: '< 20%', status: '✅' },
    { metric: 'Forecast MAE (1m)', value: '4.5', target: '< 20%', status: '✅' },
    { metric: 'Forecast RMSE (1m)', value: '6.2', target: '< 25%', status: '✅' },
    { metric: 'Detection Precision', value: '0.91', target: '> 0.85', status: '✅' },
    { metric: 'Detection Recall', value: '0.87', target: '> 0.80', status: '✅' },
    { metric: 'F1 Score', value: '0.89', target: '> 0.82', status: '✅' },
    { metric: 'False Alarm Rate', value: '3.2%', target: '< 5%', status: '✅' },
    { metric: 'Inference FPS', value: '18.5', target: '> 15', status: '✅' },
    { metric: 'E2E Latency', value: '35ms', target: '< 500ms', status: '✅' },
    { metric: 'Alert Lead Time', value: '2.4 min', target: '1-5 min', status: '✅' },
  ];

  return (
    <div className="stagger-children">
      <div className="dashboard-grid">
        {/* Cloud vs MEC Comparison */}
        <div className="glass-card panel-wide">
          <div className="card-header">
            <span className="card-title">
              <Radio size={16} />
              Cloud vs Private 5G MEC
            </span>
          </div>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} barGap={8}>
                <XAxis
                  dataKey="metric"
                  tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.75rem',
                    color: 'var(--text-primary)',
                  }}
                />
                <Bar dataKey="cloud" name="Cloud" radius={[4, 4, 0, 0]}>
                  {comparisonData.map((_, i) => (
                    <Cell key={i} fill="rgba(239, 68, 68, 0.6)" />
                  ))}
                </Bar>
                <Bar dataKey="mec" name="5G MEC" radius={[4, 4, 0, 0]}>
                  {comparisonData.map((_, i) => (
                    <Cell key={i} fill="rgba(6, 182, 212, 0.8)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-lg)', marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(239, 68, 68, 0.6)' }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Cloud</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(6, 182, 212, 0.8)' }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Private 5G MEC</span>
            </div>
          </div>
        </div>

        {/* Key Improvements */}
        <div className="glass-card panel-wide">
          <div className="card-header">
            <span className="card-title">
              <Zap size={16} />
              MEC Improvement
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { label: 'Latency Reduction', value: '76.7%', desc: '150ms → 35ms' },
              { label: 'Throughput Gain', value: '260%', desc: '50 → 180 Mbps' },
              { label: 'Packet Loss', value: '96%', desc: '2.5% → 0.1%' },
              { label: 'Cost Savings', value: '80%', desc: '$100 → $20/GB' },
            ].map((item) => (
              <div key={item.label} style={{ padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--safe)', lineHeight: 1 }}>
                  {item.value}
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>{item.label}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Evaluation Metrics Table */}
        <div className="glass-card panel-full">
          <div className="card-header">
            <span className="card-title">
              <Target size={16} />
              Evaluation Metrics
            </span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
                <th>Target</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {evaluationMetrics.map((m) => (
                <tr key={m.metric}>
                  <td style={{ fontWeight: 600 }}>{m.metric}</td>
                  <td className="mono" style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{m.value}</td>
                  <td style={{ color: 'var(--text-tertiary)' }}>{m.target}</td>
                  <td>{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
