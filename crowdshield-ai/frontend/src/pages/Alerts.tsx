import { useState, useEffect } from 'react';
import { Bell, XCircle, Sparkles } from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import ResponseAction from '../components/alerts/ResponseAction';
import { useWebSocket } from '../hooks/useWebSocket';

interface AlertInfo {
  id: string;
  level: string;
  alert_type: string;
  zone: string | null;
  reason: string;
  recommended_action: string | null;
  persistence_seconds: number;
  confirmation_frames: number;
  fused_confidence: number;
  acknowledged: boolean;
  resolved: boolean;
  is_false_alarm: boolean;
  created_at: string;
}

export default function Alerts() {
  const [filter, setFilter] = useState<string>('all');
  
  // Local state for interactive alerts management
  const [activeAlerts, setActiveAlerts] = useState<AlertInfo[]>([]);

  // WebSocket Live alerts connection
  const { isConnected, lastMessage } = useWebSocket({
    url: '/ws/live',
    autoConnect: true,
  });

  useEffect(() => {
    if (lastMessage && lastMessage.type === 'crowd_update') {
      if (lastMessage.video_id === null) {
        setActiveAlerts([]);
        return;
      }

      const sh = lastMessage.scaffolding_hazard;
      const criScore = lastMessage.overall_cri || 0;
      
      const newAlerts: AlertInfo[] = [];

      if (criScore >= 75) {
        newAlerts.push({
          id: `alert_cri_critical_${lastMessage.frame_number}`,
          level: 'critical',
          alert_type: 'stampede_risk',
          zone: 'Sector A_Ghat',
          reason: `Critical crowd stampede risk! Overall CRI at ${criScore.toFixed(0)}%.`,
          recommended_action: 'CRITICAL EVACUATION: Initiate orderly, phased evacuation of Sector A immediately.',
          persistence_seconds: 15.0,
          confirmation_frames: 15,
          fused_confidence: 0.94,
          acknowledged: false,
          resolved: false,
          is_false_alarm: false,
          created_at: new Date().toISOString()
        });
      }

      if (sh && (sh.state === 'CRITICAL' || sh.state === 'ALERTING')) {
        newAlerts.push({
          id: `alert_haz_critical_${lastMessage.frame_number}`,
          level: sh.state === 'CRITICAL' ? 'critical' : 'high',
          alert_type: 'hazard_movement',
          zone: 'Infrastructure',
          reason: `CRITICAL STRUCTURAL HAZARD: Scaffolding displacement at ${sh.displacement.toFixed(1)}px!`,
          recommended_action: 'CRITICAL SAFETY AREA: Cordon off structural zone and restrict entry.',
          persistence_seconds: 15.0,
          confirmation_frames: 10,
          fused_confidence: 0.89,
          acknowledged: false,
          resolved: false,
          is_false_alarm: false,
          created_at: new Date().toISOString()
        });
      }

      if (newAlerts.length > 0) {
        setActiveAlerts(prev => {
          const filteredPrev = prev.filter(p => !newAlerts.some(n => n.alert_type === p.alert_type));
          return [...newAlerts, ...filteredPrev].slice(0, 15);
        });
      }
    }
  }, [lastMessage]);

  // Handlers for Alert actions
  const handleAcknowledge = (alertId: string) => {
    setActiveAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    );
  };

  const handleDeploy = (alertId: string, _actionCode: string) => {
    setActiveAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId ? { ...alert, resolved: true } : alert
      )
    );
  };

  const handleMarkFalseAlarm = (alertId: string) => {
    setActiveAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId ? { ...alert, is_false_alarm: true, resolved: true } : alert
      )
    );
  };

  // Filter Logic
  const getFilteredAlerts = () => {
    return activeAlerts.filter(alert => {
      if (filter === 'all') return !alert.resolved && !alert.is_false_alarm;
      if (filter === 'critical') return alert.level === 'critical' && !alert.resolved;
      if (filter === 'acknowledged') return alert.acknowledged && !alert.resolved;
      if (filter === 'resolved') return alert.resolved;
      return true;
    });
  };

  const filteredAlerts = getFilteredAlerts();

  return (
    <div className="stagger-children">
      {/* Filters HUD */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-600/10 border border-rose-500/20 text-rose-500">
            <Bell className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Emergency Alert Operations</h2>
            <p className="text-[10px] text-slate-400 font-mono">
              {isConnected ? 'LIVE WEBSOCKET THREAT MONITORING ACTIVE' : 'SYSTEM BAYESIAN FUSION CONSOLE'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {[
            { id: 'all', label: 'Active Alerts' },
            { id: 'critical', label: 'Critical Only' },
            { id: 'acknowledged', label: 'Acknowledged' },
            { id: 'resolved', label: 'Resolved Registry' },
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => setFilter(btn.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                filter === btn.id
                  ? 'bg-rose-600/20 border-rose-500 text-rose-300'
                  : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-stretch">
        
        {/* Alerts List */}
        <div className="glass-card flex flex-col gap-4" style={{ minHeight: '500px' }}>
          <div className="card-header border-b border-slate-800/80 pb-3">
            <span className="card-title text-sm font-bold text-white flex items-center gap-2">
              Sensor Alerts Registry
            </span>
          </div>

          <div style={{ padding: 'var(--space-md)' }} className="flex flex-col gap-4 flex-1 overflow-y-auto max-h-[600px]">
            {filteredAlerts.map(alert => (
              <div
                key={alert.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row gap-4 items-start justify-between ${
                  alert.level === 'critical'
                    ? 'bg-rose-950/10 border-rose-500/30'
                    : alert.level === 'high'
                      ? 'bg-amber-950/10 border-amber-500/30'
                      : 'bg-blue-950/10 border-blue-500/20'
                }`}
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold">
                      {alert.id}
                    </span>
                    <StatusBadge status={alert.level} />
                    <span className="text-xs font-bold text-white uppercase font-mono bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800">
                      {alert.alert_type.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {alert.reason}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[10px] text-slate-400 pt-1">
                    <div>Zone: <span className="text-white font-semibold">{alert.zone || 'Global'}</span></div>
                    <div>Confidence: <span className="text-cyan-400 font-semibold">{Math.round(alert.fused_confidence * 100)}%</span></div>
                    <div>Persistence: <span className="text-slate-300 font-semibold">{alert.persistence_seconds.toFixed(1)}s</span></div>
                    <div>Frames: <span className="text-slate-300 font-semibold">{alert.confirmation_frames}f</span></div>
                    <div>Timestamp: <span className="text-slate-500 font-mono">{new Date(alert.created_at).toLocaleTimeString()}</span></div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0 md:self-center">
                  {!alert.acknowledged && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-slate-700 bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    onClick={() => handleMarkFalseAlarm(alert.id)}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    False Alarm
                  </button>
                </div>
              </div>
            ))}

            {filteredAlerts.length === 0 && (
              <div className="flex flex-col items-center justify-center flex-1 py-20 text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-950/40 border border-slate-900 flex items-center justify-center text-slate-600">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-400">No Registry Matches</h3>
                  <p className="text-xs text-slate-600">All alerts in this category are resolved or acknowledged.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fused Decisions Recommendations Engine */}
        <div className="glass-card flex flex-col gap-4">
          <div className="card-header border-b border-slate-800/80 pb-3">
            <span className="card-title text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple" style={{ color: '#8b5cf6' }} />
              Gemini Incident Response Recommendations
            </span>
          </div>

          <div style={{ padding: 'var(--space-md)' }} className="flex flex-col gap-4 overflow-y-auto max-h-[600px]">
            <ResponseAction
              alerts={activeAlerts.filter(a => !a.resolved && a.recommended_action)}
              onAcknowledge={handleAcknowledge}
              onDeploy={handleDeploy}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
