import { useState } from 'react';
import { Shield, Check, Flame, AlertCircle, Clock, Zap, MapPin, Send } from 'lucide-react';

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
  created_at: string;
}

interface ResponseActionProps {
  alerts: AlertInfo[];
  onAcknowledge: (alertId: string) => void;
  onDeploy: (alertId: string, actionCode: string) => void;
}

export default function ResponseAction({
  alerts,
  onAcknowledge,
  onDeploy,
}: ResponseActionProps) {
  const [deployingId, setDeployingId] = useState<string | null>(null);

  const getAlertStyles = (level: string) => {
    switch (level) {
      case 'critical':
        return {
          bg: 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50',
          text: 'text-rose-400',
          glow: 'shadow-[0_0_15px_rgba(239,68,68,0.07)]',
          badge: 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        };
      case 'high':
        return {
          bg: 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50',
          text: 'text-amber-400',
          glow: 'shadow-[0_0_15px_rgba(249,115,22,0.07)]',
          badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-950/10 border-yellow-500/20 hover:border-yellow-500/40',
          text: 'text-yellow-400',
          glow: 'shadow-[0_0_15px_rgba(234,179,8,0.05)]',
          badge: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
        };
      default:
        return {
          bg: 'bg-slate-900/40 border-slate-800 hover:border-slate-700',
          text: 'text-slate-400',
          glow: '',
          badge: 'bg-slate-800 border-slate-700 text-slate-300'
        };
    }
  };

  const handleDeployAction = (alertId: string, actionText: string) => {
    // Extract action code (e.g. "open_exit") from recommended action string
    // Format: "CRITICAL EVACUATION [start_evacuation]: ..." or "HIGH DENSITY [divert_crowd]: ..."
    let actionCode = 'deploy_patrol';
    const match = actionText.match(/\[(.*?)\]/);
    if (match && match[1]) {
      actionCode = match[1];
    }
    
    setDeployingId(alertId);
    setTimeout(() => {
      onDeploy(alertId, actionCode);
      setDeployingId(null);
    }, 900);
  };

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-slate-800 bg-slate-950/30 text-center space-y-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 text-slate-500">
          <Shield className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-slate-300">All Safe & Operational</h4>
          <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
            AI monitoring engines are running with zero active alerts or hazards detected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
      {alerts.map(alert => {
        const styles = getAlertStyles(alert.level);
        const isCritical = alert.level === 'critical';
        const isDeployed = alert.resolved; // Resolved maps to deployed in log simulations

        return (
          <div 
            key={alert.id}
            className={`p-5 rounded-2xl border backdrop-blur-md transition-all duration-300 flex flex-col justify-between gap-4 ${styles.bg} ${styles.glow}`}
          >
            {/* Header info */}
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md border text-[9px] font-mono font-bold tracking-wider uppercase ${styles.badge}`}>
                    {alert.level}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                    {alert.alert_type}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white leading-snug">
                  {alert.reason}
                </h4>
              </div>
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-900/60 border border-slate-800/80 text-rose-500">
                {isCritical ? <Flame className="w-4.5 h-4.5 animate-pulse" /> : <AlertCircle className="w-4.5 h-4.5" />}
              </div>
            </div>

            {/* AI Action recommendation panel */}
            {alert.recommended_action && (
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60 flex flex-col gap-2 shadow-inner">
                <div className="flex items-center gap-1.5 text-cyan-400 text-[10px] font-bold font-mono tracking-wide">
                  <Zap className="w-3.5 h-3.5 animate-pulse" />
                  <span>AI EMERGENCY RECOMMENDATION</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {alert.recommended_action}
                </p>
              </div>
            )}

            {/* Telemetry verification metadata */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] text-slate-500 border-t border-slate-800/60 pt-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Sustained: <strong className="text-slate-300">{alert.persistence_seconds.toFixed(1)}s</strong></span>
                </div>
                <div className="flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-slate-500" />
                  <span>Conf. Frames: <strong className="text-slate-300">{alert.confirmation_frames}f</strong></span>
                </div>
                {alert.zone && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span>Sector: <strong className="text-slate-300">{alert.zone}</strong></span>
                  </div>
                )}
              </div>
              
              <div className="text-slate-500">
                Fused Confidence: <strong className="text-cyan-400 font-mono">{(alert.fused_confidence * 100).toFixed(0)}%</strong>
              </div>
            </div>

            {/* Action Triggers */}
            <div className="flex items-center gap-3 border-t border-slate-800/40 pt-3">
              {!alert.acknowledged ? (
                <button
                  onClick={() => onAcknowledge(alert.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm active:scale-98"
                >
                  <Check className="w-4 h-4" />
                  Acknowledge Alert
                </button>
              ) : (
                <div className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-950/20 border border-cyan-800/30 text-xs font-semibold text-cyan-400 select-none">
                  <Check className="w-4 h-4" />
                  Acknowledged
                </div>
              )}

              {alert.recommended_action && (
                <button
                  disabled={isDeployed || deployingId === alert.id}
                  onClick={() => handleDeployAction(alert.id, alert.recommended_action!)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg active:scale-98 border ${
                    isDeployed
                      ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                      : deployingId === alert.id
                        ? 'bg-cyan-600/50 border-cyan-500 text-white animate-pulse'
                        : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 border-cyan-500 text-white hover:shadow-cyan-500/15'
                  }`}
                >
                  {deployingId === alert.id ? (
                    <>
                      <Send className="w-4 h-4 animate-bounce" />
                      Deploying...
                    </>
                  ) : isDeployed ? (
                    <>
                      <Shield className="w-4 h-4 text-emerald-500" />
                      Response Active
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Deploy Action
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
