import { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, Activity, RotateCcw, Sparkles, RefreshCw } from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import { API_V1 } from '../config/api';
import { useWebSocket } from '../hooks/useWebSocket';

export default function HazardMonitoring() {
  // Simulation mode
  // 'idle' | 'static_tilt' | 'slow_drift' | 'collapse'
  const [simMode, setSimMode] = useState<'idle' | 'static_tilt' | 'slow_drift' | 'collapse'>('idle');
  const [_ticks, setTicks] = useState<number>(0);
  const [history, setHistory] = useState<{ tick: number; displacement: number; velocity: number }[]>([]);

  // WebSocket Live Connection
  const { isConnected, lastMessage } = useWebSocket({
    url: '/ws/live',
    autoConnect: true,
  });

  // Gemini Structural States
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('');
  const [analysisText, setAnalysisText] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);

  const [wsHazard, setWsHazard] = useState<any>(null);

  const handleIncomingData = (data: any) => {
    if (data.type === 'crowd_update' && data.scaffolding_hazard) {
      // If we have an active video, ignore mock websocket updates where video_id is null
      const savedVideoStr = localStorage.getItem('CS_ACTIVE_VIDEO');
      if (savedVideoStr) {
        try {
          const savedVideo = JSON.parse(savedVideoStr);
          if (savedVideo && savedVideo.status === 'processed' && data.video_id === null) {
            return;
          }
        } catch {}
      }

      const sh = data.scaffolding_hazard;
      setWsHazard(sh);
      setHistory(h => {
        const nextTick = h.length > 0 ? h[h.length - 1].tick + 1 : 1;
        const newHistory = [...h, { tick: nextTick, displacement: sh.displacement || 0, velocity: sh.velocity || 0 }];
        if (newHistory.length > 30) newHistory.shift();
        return newHistory;
      });
    }
  };

  // Sync state with incoming WebSocket metrics
  useEffect(() => {
    if (lastMessage) {
      handleIncomingData(lastMessage);
    }
  }, [lastMessage]);

  // Fetch metrics file and loop it locally to simulate live feed of the active video
  useEffect(() => {
    const savedVideoStr = localStorage.getItem('CS_ACTIVE_VIDEO');
    if (savedVideoStr) {
      try {
        const savedVideo = JSON.parse(savedVideoStr);
        if (savedVideo && savedVideo.status === 'processed') {
          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
          const url = `${apiUrl}/uploads/${savedVideo.id}_metrics.json`;
          
          let isMounted = true;
          let intervalId: any = null;

          fetch(url)
            .then(res => {
              if (!res.ok) throw new Error('Metrics not found');
              return res.json();
            })
            .then(data => {
              if (isMounted && data && data.length > 0) {
                let index = 0;
                intervalId = setInterval(() => {
                  const item = data[index % data.length];
                  handleIncomingData({
                    type: 'crowd_update',
                    video_id: savedVideo.id,
                    frame_number: item.frame_number,
                    scaffolding_hazard: item.scaffolding_hazard || { state: 'STATIC', displacement: 0.0, velocity: 0.0, severity: 'none' }
                  });
                  index++;
                }, 200); // 5 Hz
              }
            })
            .catch(err => {
              console.warn('Failed to load local telemetry loop for hazard active video:', err);
            });

          return () => {
            isMounted = false;
            if (intervalId) clearInterval(intervalId);
          };
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Load API keys on mount
  useEffect(() => {
    setGeminiApiKey(localStorage.getItem('GEMINI_API_KEY') || '');
    setGeminiModel(localStorage.getItem('GEMINI_MODEL') || 'gemini-2.5-flash');
  }, []);

  // Reset simulation when mode changes
  useEffect(() => {
    setTicks(0);
    setHistory([]);
    setAnalysisText(''); // Clear previous analysis
    setWsHazard(null);
  }, [simMode]);

  // Simulation step timer (for manual simulator)
  useEffect(() => {
    if (simMode === 'idle' || isConnected && wsHazard) return;

    const interval = setInterval(() => {
      setTicks(prev => {
        const nextTick = prev + 1;
        
        let displacement = 0;
        let velocity = 0;

        if (simMode === 'static_tilt') {
          displacement = 2.5 + Math.sin(nextTick * 0.8) * 0.3;
          velocity = Math.abs(Math.cos(nextTick * 0.8) * 0.2);
        } else if (simMode === 'slow_drift') {
          displacement = nextTick * 1.2;
          velocity = 1.2 + Math.sin(nextTick) * 0.1;
        } else if (simMode === 'collapse') {
          const t = nextTick / 5.0;
          displacement = Math.pow(t, 2.3) * 3.0;
          velocity = (2.3 * Math.pow(t, 1.3) * 3.0) / 5.0;
        }

        setHistory(h => {
          const newHistory = [...h, { tick: nextTick, displacement, velocity }];
          if (newHistory.length > 30) newHistory.shift();
          return newHistory;
        });

        return nextTick;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [simMode, isConnected, wsHazard]);

  // Calculate current state metrics based on active history or WebSocket
  const currentMetrics = () => {
    if (isConnected && wsHazard) {
      return {
        displacement: wsHazard.displacement || 0,
        velocity: wsHazard.velocity || 0,
        state: wsHazard.state || 'STATIC',
        severity: wsHazard.severity || 'none'
      };
    }

    if (history.length === 0) {
      return { displacement: 0, velocity: 0, state: 'STATIC', severity: 'none' };
    }
    const current = history[history.length - 1];
    const d = current.displacement;
    const v = current.velocity;

    let state = 'STATIC';
    let severity = 'none';

    if (simMode === 'static_tilt') {
      state = 'STATIC';
      severity = 'low';
    } else {
      if (d > 65.0) {
        state = 'CRITICAL';
        severity = 'critical';
      } else if (d > 20.0) {
        state = 'ALERTING';
        severity = 'high';
      } else if (d > 4.0) {
        state = 'MONITORING';
        severity = 'moderate';
      }
    }

    return { displacement: d, velocity: v, state, severity };
  };

  const metrics = currentMetrics();

  // Run Gemini Hazard Telemetry Assessment
  const handleAnalyzeStructuralHazard = async () => {
    if (!geminiApiKey) return;
    setAnalyzing(true);
    setAnalysisText('');

    try {
      const response = await fetch(`${API_V1}/gemini/hazard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gemini-API-Key': geminiApiKey
        },
        body: JSON.stringify({
          displacement: metrics.displacement,
          velocity: metrics.velocity,
          state: metrics.state,
          severity: metrics.severity,
          model: geminiModel
        })
      });
      const data = await response.json();
      if (response.ok && data.reply) {
        setAnalysisText(data.reply);
      } else {
        setAnalysisText(data.detail || 'Failed to generate structural advisory.');
      }
    } catch (err: any) {
      setAnalysisText(`Error generating report: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  // Draw custom SVG chart lines
  const renderChart = () => {
    if (history.length < 2) {
      return (
        <svg className="w-full h-40 bg-slate-950/40 border border-slate-900 rounded-xl">
          <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fill="#64748b" className="text-xs font-mono">
            Awaiting Simulation Data...
          </text>
        </svg>
      );
    }

    const width = 500;
    const height = 140;
    const padding = 20;

    const maxD = Math.max(80, ...history.map(h => h.displacement));
    const pointsD = history.map((h, i) => {
      const x = padding + (i / (history.length - 1)) * (width - 2 * padding);
      const y = height - padding - (h.displacement / maxD) * (height - 2 * padding);
      return `${x},${y}`;
    }).join(' ');

    const pointsV = history.map((h, i) => {
      const x = padding + (i / (history.length - 1)) * (width - 2 * padding);
      const y = height - padding - (h.velocity / (maxD / 10)) * (height - 2 * padding);
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full bg-slate-950/20 border border-slate-900/60 rounded-2xl shadow-inner">
        {/* Grids */}
        {[0.25, 0.5, 0.75].map((pct, idx) => (
          <line
            key={idx}
            x1={padding}
            y1={padding + pct * (height - 2 * padding)}
            x2={width - padding}
            y2={padding + pct * (height - 2 * padding)}
            stroke="#1e293b"
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        ))}

        {/* Displacement line */}
        <polyline
          fill="none"
          stroke="#f97316"
          strokeWidth={2.5}
          points={pointsD}
          className="transition-all duration-300"
        />

        {/* Velocity line */}
        <polyline
          fill="none"
          stroke="#06b6d4"
          strokeWidth={1.5}
          strokeDasharray="3,3"
          points={pointsV}
          className="transition-all duration-300"
        />

        {/* Labels */}
        <text x={padding + 5} y={padding + 10} fill="#f97316" className="text-[9px] font-mono font-bold">DISPLACEMENT (px)</text>
        <text x={width - padding - 100} y={padding + 10} fill="#06b6d4" className="text-[9px] font-mono font-bold">VELOCITY (px/f)</text>
      </svg>
    );
  };

  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, idx) => {
      if (line.startsWith('### ')) {
        return (
          <h4 key={idx} style={{ 
            color: 'var(--text-bright)', 
            marginTop: '20px', 
            marginBottom: '10px', 
            fontSize: '13px', 
            fontWeight: 700, 
            borderBottom: '1px solid rgba(255,255,255,0.06)', 
            paddingBottom: '4px' 
          }}>
            {line.replace('### ', '')}
          </h4>
        );
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <li key={idx} style={{ 
            marginLeft: '16px', 
            color: 'var(--text-muted)', 
            fontSize: '12px', 
            marginBottom: '6px',
            listStyleType: 'square'
          }}>
            {line.substring(2)}
          </li>
        );
      }
      if (/^\d+\.\s/.test(line)) {
        const content = line.replace(/^\d+\.\s/, '');
        return (
          <div key={idx} style={{ display: 'flex', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: 1.4 }}>
            <strong style={{ color: 'var(--accent)' }}>{line.match(/^\d+/)?.[0]}.</strong>
            <span>{content}</span>
          </div>
        );
      }
      if (line.trim() === '') {
        return <div key={idx} style={{ height: '6px' }} />;
      }
      return (
        <p key={idx} style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5, margin: '6px 0' }}>
          {line}
        </p>
      );
    });
  };

  return (
    <div className="stagger-children space-y-6">
      {/* Simulation triggers card */}
      <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono">Structural Motion Simulator</h3>
          <p className="text-xs text-slate-400">{isConnected && wsHazard ? 'Live Edge Video Feed Active (Simulator Bypassed)' : 'Trigger physical displacement profiles to observe state machine graduation.'}</p>
        </div>

        {(!isConnected || !wsHazard) && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSimMode('static_tilt')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                simMode === 'static_tilt'
                  ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
              }`}
            >
              Static Tilt (No Movement)
            </button>
            
            <button
              onClick={() => setSimMode('slow_drift')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                simMode === 'slow_drift'
                  ? 'bg-yellow-600/20 border-yellow-500 text-yellow-300'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
              }`}
            >
              Slow Progressive Drift
            </button>

            <button
              onClick={() => setSimMode('collapse')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                simMode === 'collapse'
                  ? 'bg-rose-600/20 border-rose-500 text-rose-300 animate-pulse'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
              }`}
            >
              Rapid Collapse Motion
            </button>

            {simMode !== 'idle' && (
              <button
                onClick={() => setSimMode('idle')}
                className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Reset"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* State Machine Status */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-md flex flex-col justify-between gap-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="card-title text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4.5 h-4.5 text-cyan-400" />
              Motion State Machine
            </span>
            <span className="text-[10px] font-mono text-slate-500">{isConnected && wsHazard ? 'LIVE WEBSOCKET STREAM' : 'REAL-TIME SEVERITY FLOW'}</span>
          </div>

          <div className="flex flex-col gap-4 py-2">
            {['STATIC', 'MONITORING', 'ALERTING', 'CRITICAL'].map((state) => {
              const active = metrics.state === state;
              let borderClass = 'border-slate-800 bg-slate-950/40 text-slate-500';
              if (active) {
                if (state === 'STATIC') borderClass = 'border-blue-500 bg-blue-950/20 text-blue-400';
                else if (state === 'MONITORING') borderClass = 'border-yellow-500 bg-yellow-950/20 text-yellow-400';
                else if (state === 'ALERTING') borderClass = 'border-amber-500 bg-amber-950/20 text-amber-400';
                else if (state === 'CRITICAL') borderClass = 'border-rose-500 bg-rose-950/20 text-rose-400 shadow-[0_0_15px_rgba(239,68,68,0.08)]';
              }

              return (
                <div 
                  key={state} 
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all duration-300 ${borderClass}`}
                >
                  <span className="text-xs font-bold font-mono tracking-wider">{state}</span>
                  {active ? (
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono text-slate-600">INACTIVE</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom Displacement Chart Card */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-md flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="card-title text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4.5 h-4.5 text-cyan-400" />
              Structural Telemetry Chart
            </span>
            <span className="text-[10px] font-mono text-slate-500">30-FRAME TRACKS</span>
          </div>

          <div className="h-44 flex items-center justify-center">
            {renderChart()}
          </div>
        </div>
      </div>

      {/* Table grid */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-md flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <span className="card-title text-sm font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />
            Detected Hazards Registry
          </span>
          <span className="text-[10px] font-mono text-slate-400">FILTERS CONFIRMED IN SECONDS</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 font-mono font-bold tracking-wider">
                <th className="py-3 px-2">Type</th>
                <th className="py-3 px-2">Hazard ID</th>
                <th className="py-3 px-2">Motion State</th>
                <th className="py-3 px-2">Displacement</th>
                <th className="py-3 px-2">Velocity</th>
                <th className="py-3 px-2">Confidence</th>
                <th className="py-3 px-2">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-slate-300">
              <tr className="hover:bg-slate-900/20 transition-colors">
                <td className="py-3 px-2 font-bold text-white">Scaffolding</td>
                <td className="py-3 px-2 font-mono text-slate-400">hazard_scaffolding_1</td>
                <td className="py-3 px-2">
                  <StatusBadge status={metrics.state === 'STATIC' ? 'info' : metrics.state.toLowerCase()} />
                </td>
                <td className="py-3 px-2 font-mono font-semibold text-orange-400">{metrics.displacement.toFixed(1)} px</td>
                <td className="py-3 px-2 font-mono text-cyan-400">{metrics.velocity.toFixed(2)} px/f</td>
                <td className="py-3 px-2 font-mono">89%</td>
                <td className="py-3 px-2">
                  <StatusBadge status={metrics.severity === 'none' ? 'safe' : metrics.severity} />
                </td>
              </tr>
              <tr className="hover:bg-slate-900/20 transition-colors opacity-75">
                <td className="py-3 px-2 font-bold text-white">Barricade</td>
                <td className="py-3 px-2 font-mono text-slate-400">hazard_barricade_1</td>
                <td className="py-3 px-2">
                  <StatusBadge status="info" />
                </td>
                <td className="py-3 px-2 font-mono font-semibold text-slate-400">0.2 px</td>
                <td className="py-3 px-2 font-mono text-slate-500">0.00 px/f</td>
                <td className="py-3 px-2 font-mono">94%</td>
                <td className="py-3 px-2">
                  <StatusBadge status="safe" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Gemini Structural Advisor Card */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-md flex flex-col gap-4" style={{ border: '1px solid rgba(139, 92, 246, 0.25)', boxShadow: '0 0 15px rgba(139, 92, 246, 0.05)' }}>
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <span className="card-title text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4.5 h-4.5 text-purple" style={{ color: '#8b5cf6' }} />
            Gemini Structural Safety Analyst
          </span>
          <span style={{ fontSize: '9px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
            INTELLIGENT DIAGNOSIS
          </span>
        </div>

        <div>
          {!geminiApiKey ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: 6, padding: '12px' }}>
              <AlertTriangle className="w-4.5 h-4.5 text-rose-400" style={{ color: 'var(--critical)' }} />
              <span style={{ fontSize: '13px', color: 'var(--text-bright)' }}>
                Gemini API Key is missing. Please configure it in the <a href="/settings" style={{ color: '#8b5cf6', textDecoration: 'underline', fontWeight: 600 }}>Settings</a> page to unlock structural advisories.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Evaluates the current scaffolding drift and displacement dynamics using Gemini Vision capabilities to predict collapse mechanical failure modes.
                </span>
                <button 
                  onClick={handleAnalyzeStructuralHazard}
                  className="btn btn-primary"
                  disabled={analyzing}
                  style={{ fontSize: '12px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)', border: 'none' }}
                >
                  {analyzing ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {analyzing ? 'Evaluating Telemetry...' : 'Analyze Structural Motion'}
                </button>
              </div>

              {analysisText && (
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  border: '1px solid rgba(255, 255, 255, 0.05)', 
                  borderRadius: 8, 
                  padding: '16px 20px',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}>
                  {renderMarkdown(analysisText)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
