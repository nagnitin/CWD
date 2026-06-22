import { TrendingUp, Check } from 'lucide-react';

interface RiskTrendProps {
  history?: number[]; // list of past 10-20 CRI values
  forecasts?: number[]; // list of predicted values (+1m, +3m, +5m)
}

export default function RiskTrend({
  history = [22, 24, 25, 23, 26, 28, 31, 33, 32, 35, 37],
  forecasts = [41, 46, 54],
}: RiskTrendProps) {
  // Combine data points
  const allPoints = [...history, ...forecasts];
  const totalPoints = allPoints.length;

  // Chart layout dimensions
  const width = 500;
  const height = 180;
  const padding = 25;
  
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Scale coordinates (X: points index, Y: 0-100 CRI value)
  const getX = (idx: number) => padding + (idx / (totalPoints - 1)) * chartWidth;
  const getY = (val: number) => padding + chartHeight - (val / 100) * chartHeight;

  // Build SVG path for history (solid line)
  let historyPath = '';
  history.forEach((val, idx) => {
    const x = getX(idx);
    const y = getY(val);
    if (idx === 0) {
      historyPath = `M ${x} ${y}`;
    } else {
      historyPath += ` L ${x} ${y}`;
    }
  });

  // Build SVG path for forecast (dashed line continuation)
  let forecastPath = '';
  if (history.length > 0) {
    const lastHistIdx = history.length - 1;
    const startX = getX(lastHistIdx);
    const startY = getY(history[lastHistIdx]);
    forecastPath = `M ${startX} ${startY}`;
    
    forecasts.forEach((val, idx) => {
      const x = getX(lastHistIdx + idx + 1);
      const y = getY(val);
      forecastPath += ` L ${x} ${y}`;
    });
  }

  // Generate confidence interval shaded polygon
  // Projections get wider uncertainty intervals over time
  let confidencePath = '';
  if (history.length > 0) {
    const lastHistIdx = history.length - 1;
    const startX = getX(lastHistIdx);
    const startY = getY(history[lastHistIdx]);
    
    // Top boundary coordinates (upper bound)
    let topCoords = `M ${startX} ${startY}`;
    // Bottom boundary coordinates (lower bound, drawn in reverse to close the polygon)
    let bottomCoords = '';

    forecasts.forEach((val, idx) => {
      const stepIdx = lastHistIdx + idx + 1;
      const x = getX(stepIdx);
      
      // Uncertainty width increases with time (e.g. +/- 4 points at step 1, +/- 12 points at step 3)
      const uncertainty = (idx + 1) * 4.5;
      const topY = getY(Math.min(100, val + uncertainty));
      const botY = getY(Math.max(0, val - uncertainty));

      topCoords += ` L ${x} ${topY}`;
      bottomCoords = ` L ${x} ${botY}` + bottomCoords;
    });

    // Link the bounds to form a closed shape
    confidencePath = `${topCoords} ${bottomCoords} L ${startX} ${startY} Z`;
  }

  return (
    <div className="glass-card panel-wide animate-fade-in" style={{ gridColumn: 'span 2' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="card-title">
          <TrendingUp size={16} className="text-cyan" />
          Crowd Risk Index Trend Projections
        </span>
        <span style={{ fontSize: '11px', color: 'var(--safe)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Check size={12} />
          Safe Convergence
        </span>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* SVG Chart Frame */}
        <div style={{ width: '100%', position: 'relative' }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', overflow: 'visible' }}>
            {/* Grid Lines */}
            {[25, 50, 75].map((lvl) => (
              <g key={lvl}>
                <line
                  x1={padding}
                  y1={getY(lvl)}
                  x2={width - padding}
                  y2={getY(lvl)}
                  stroke="rgba(255, 255, 255, 0.04)"
                  strokeWidth="1"
                />
                <text
                  x={padding - 6}
                  y={getY(lvl) + 4}
                  fill="rgba(255, 255, 255, 0.25)"
                  fontSize="8"
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  {lvl}
                </text>
              </g>
            ))}

            {/* Threshold Line at 75 CRI (High risk bound) */}
            <line
              x1={padding}
              y1={getY(75)}
              x2={width - padding}
              y2={getY(75)}
              stroke="rgba(239, 68, 68, 0.18)"
              strokeWidth="1.2"
              strokeDasharray="4,4"
            />
            <text
              x={width - padding - 8}
              y={getY(75) - 6}
              fill="rgba(239, 68, 68, 0.5)"
              fontSize="8"
              fontWeight="600"
              textAnchor="end"
            >
              CRITICAL HAZARD THRESHOLD (75)
            </text>

            {/* Shaded Confidence Interval Zone */}
            {confidencePath && (
              <path
                d={confidencePath}
                fill="rgba(6, 182, 212, 0.05)"
                stroke="none"
              />
            )}

            {/* History path (solid cyan) */}
            {historyPath && (
              <path
                d={historyPath}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                style={{ filter: 'drop-shadow(0 0 4px rgba(6, 182, 212, 0.2))' }}
              />
            )}

            {/* Forecast path (dashed orange/red) */}
            {forecastPath && (
              <path
                d={forecastPath}
                fill="none"
                stroke="var(--moderate)"
                strokeWidth="2.2"
                strokeDasharray="4,3"
                style={{ filter: 'drop-shadow(0 0 3px rgba(234, 179, 8, 0.15))' }}
              />
            )}

            {/* Coordinate dots at forecasts */}
            {forecasts.map((val, idx) => {
              const stepIdx = history.length + idx;
              const x = getX(stepIdx);
              const y = getY(val);
              return (
                <circle
                  key={idx}
                  cx={x}
                  cy={y}
                  r="3.5"
                  fill="var(--moderate)"
                  stroke="var(--bg)"
                  strokeWidth="1"
                />
              );
            })}

            {/* Current point divider marker line */}
            {history.length > 0 && (
              <line
                x1={getX(history.length - 1)}
                y1={padding - 6}
                x2={getX(history.length - 1)}
                y2={height - padding + 6}
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
            )}
            
            {/* Timeline label markers */}
            <text x={getX(0)} y={height - 6} fill="rgba(255,255,255,0.2)" fontSize="8" textAnchor="middle">
              -30s
            </text>
            <text x={getX(history.length - 1)} y={height - 6} fill="var(--accent)" fontSize="8" fontWeight="600" textAnchor="middle">
              NOW
            </text>
            <text x={getX(totalPoints - 1)} y={height - 6} fill="var(--moderate)" fontSize="8" textAnchor="middle">
              +5 Min
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 12, height: 3, background: 'var(--accent)', borderRadius: 1.5 }} />
            <span>Observed History</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 12, height: 3, borderTop: '2.5px dashed var(--moderate)' }} />
            <span>STGCN Model Projection</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 12, height: 8, background: 'rgba(6, 182, 212, 0.08)' }} />
            <span>Uncertainty Bounds</span>
          </div>
        </div>
      </div>
    </div>
  );
}
