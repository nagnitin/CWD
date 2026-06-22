import { useState, useEffect } from 'react';
import { Layers, Clock, Play, Pause, Radio } from 'lucide-react';
import DigitalTwinMap from '../components/twin/DigitalTwinMap';
import { useWebSocket } from '../hooks/useWebSocket';

export default function DigitalTwin() {
  // Layer Toggles
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showFlow, setShowFlow] = useState(true);
  const [showRiskZones, setShowRiskZones] = useState(true);
  const [showHazards, setShowHazards] = useState(true);
  const [showResources, setShowResources] = useState(true);
  const [showForecasts, setShowForecasts] = useState(true);

  // Time Scrubbing State
  const [frameIndex, setFrameIndex] = useState(150);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedHorizon, setSelectedHorizon] = useState<'now' | '+1m' | '+3m' | '+5m'>('now');

  // WebSocket Live Connection
  const { isConnected, lastMessage } = useWebSocket({
    url: '/ws/live',
    autoConnect: true,
  });

  const [wsZones, setWsZones] = useState<any[]>([]);
  const [wsHazards, setWsHazards] = useState<any[]>([]);
  const [wsAlerts, setWsAlerts] = useState<any[]>([]);
  const [wsCri, setWsCri] = useState<number | null>(null);

  // Sync state with incoming WebSocket metrics
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'crowd_update') {
      if (lastMessage.video_id === null) {
        setWsCri(0);
        setWsZones([]);
        setWsHazards([]);
        setWsAlerts([]);
        return;
      }
      setWsCri(lastMessage.overall_cri);
      if (lastMessage.zones) {
        const defaultBboxes: Record<string, { x1: number; y1: number; x2: number; y2: number }> = {
          'sector_a_ghat': { x1: 150, y1: 100, x2: 450, y2: 380 },
          'sector_b_plaza': { x1: 500, y1: 200, x2: 850, y2: 520 },
          'sector_c_barricades': { x1: 880, y1: 350, x2: 1200, y2: 650 }
        };
        const mapped = lastMessage.zones.map((z: any) => {
          const cleanId = z.zone_id.toLowerCase().replace(/_/g, '_');
          return {
            ...z,
            zone_id: cleanId,
            bbox: defaultBboxes[cleanId] || { x1: 100, y1: 100, x2: 300, y2: 300 },
            pressure_score: z.pressure_score !== undefined ? z.pressure_score : (lastMessage.metrics?.pressure_score || 0) * (cleanId === 'sector_a_ghat' ? 1.05 : 0.85),
            occupancy: z.occupancy !== undefined ? z.occupancy : (lastMessage.metrics?.occupancy || 0.3) * (cleanId === 'sector_a_ghat' ? 1.1 : 0.9),
            velocity_avg: z.velocity_avg !== undefined ? z.velocity_avg : (lastMessage.metrics?.velocity_avg || 1.5),
            flow_consistency: z.flow_consistency !== undefined ? z.flow_consistency : (lastMessage.metrics?.flow_consistency || 0.8),
          };
        });
        setWsZones(mapped);
      }

      // Sync hazards with dynamic metrics
      const sh = lastMessage.scaffolding_hazard || { state: 'STATIC', displacement: 0.2, velocity: 0.0, severity: 'none' };
      const updatedHazards = [
        {
          id: 'hazard_scaffolding_1',
          class_name: 'scaffolding',
          bbox: {
            x1: 350.0 + (sh.displacement || 0),
            y1: 200.0 + (sh.displacement || 0),
            x2: 470.0 + (sh.displacement || 0) * 1.5,
            y2: 750.0 + (sh.displacement || 0),
          },
          confidence: 0.89,
          motion_state: sh.state || 'STATIC',
          motion_delta: sh.displacement || 0.0,
          motion_velocity: sh.velocity || 0.0,
          trajectory: Array.from({ length: 6 }, (_, i) => ({
            x: 410.0 + ((sh.displacement || 0) * i / 5),
            y: 475.0 + ((sh.displacement || 0) * i / 5)
          }))
        },
        {
          id: 'hazard_barricade_1',
          class_name: 'barricade',
          bbox: { x1: 800.0, y1: 650.0, x2: 950.0, y2: 720.0 },
          confidence: 0.94,
          motion_state: 'STATIC',
          motion_delta: 0.2,
          motion_velocity: 0.0,
          trajectory: [{ x: 875.0, y: 685.0 }]
        }
      ];
      setWsHazards(updatedHazards);

      // Extract and map active alerts from live metrics
      const activeAlerts = [];
      const criScore = lastMessage.overall_cri || 0;
      if (criScore >= 75) {
        activeAlerts.push({
          id: 'alert_cri_critical',
          level: 'critical',
          alert_type: 'stampede_risk',
          zone: 'Global',
          reason: `Critical crowd stampede risk! Overall CRI at ${criScore.toFixed(0)}%.`,
          recommended_action: 'CRITICAL EVACUATION: Initiate orderly, phased evacuation of Sector A immediately.',
          persistence_seconds: 15.0,
        });
      } else if (criScore >= 50) {
        activeAlerts.push({
          id: 'alert_cri_high',
          level: 'high',
          alert_type: 'crowd_pressure',
          zone: 'Global',
          reason: `High crowd risk index detected (CRI: ${criScore.toFixed(0)}%). Monitor Sector A.`,
          recommended_action: 'HIGH PRESSURE: Deploy physical patrols to form pressure-release wedges.',
          persistence_seconds: 10.0,
        });
      }

      if (sh.state === 'CRITICAL' || sh.state === 'ALERTING') {
        activeAlerts.push({
          id: 'alert_haz_critical',
          level: sh.state === 'CRITICAL' ? 'critical' : 'high',
          alert_type: 'hazard_movement',
          zone: 'Infrastructure',
          reason: `CRITICAL COLLAPSE DANGER: Scaffolding displacement at ${sh.displacement.toFixed(1)}px!`,
          recommended_action: 'CRITICAL SAFETY AREA: Cordon off structural zone and restrict entry.',
          persistence_seconds: 15.0,
        });
      }
      setWsAlerts(activeAlerts);
    }
  }, [lastMessage]);

  // Simulation loop (Fallback for offline/standalone mode)
  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setInterval(() => {
        setFrameIndex((prev) => {
          if (prev >= 200) {
            setIsPlaying(false);
            return 200;
          }
          return prev + 2;
        });
      }, 150);
    }
    return () => clearInterval(timer);
  }, [isPlaying]);

  // Compute simulated frame state
  const getSimulatedState = (frame: number) => {
    let driftX = 0;
    let driftY = 0;
    let scaffoldingState = 'STATIC';
    let scaffoldingVel = 0.0;
    let scaffoldingDrift = 0.0;
    let cri = 38.0;

    if (frame > 150) {
      const t = (frame - 150) / 10.0;
      driftX = Math.pow(t, 2.2) * 1.5;
      driftY = Math.pow(t, 2.5) * 2.0;
      scaffoldingDrift = Math.sqrt(driftX * driftX + driftY * driftY);
      
      scaffoldingVel = (t * 2.5) * 0.8;

      if (scaffoldingDrift > 65.0) {
        scaffoldingState = 'CRITICAL';
        cri = 86.5;
      } else if (scaffoldingDrift > 20.0) {
        scaffoldingState = 'ALERTING';
        cri = 68.2;
      } else if (scaffoldingDrift > 4.0) {
        scaffoldingState = 'MONITORING';
        cri = 52.4;
      }
    }

    const zones = [
      {
        zone_id: 'sector_a_ghat',
        bbox: { x1: 150, y1: 100, x2: 450, y2: 380 },
        person_count: Math.round(45 + (frame > 150 ? (frame - 150) * 1.2 : 0)),
        density: 1.2 + (frame > 150 ? (frame - 150) * 0.05 : 0),
        occupancy: 0.35 + (frame > 150 ? (frame - 150) * 0.01 : 0),
        velocity_avg: Math.max(0.6, 2.5 - (frame > 150 ? (frame - 150) * 0.04 : 0)),
        flow_consistency: Math.max(0.2, 0.82 - (frame > 150 ? (frame - 150) * 0.01 : 0)),
        pressure_score: 8.5 + (frame > 150 ? (frame - 150) * 0.6 : 0),
        risk_score: 15.0 + (frame > 150 ? (frame - 150) * 1.3 : 0),
        risk_level: frame > 185 ? 'critical' : frame > 165 ? 'high' : frame > 150 ? 'moderate' : 'safe',
      },
      {
        zone_id: 'sector_b_plaza',
        bbox: { x1: 500, y1: 200, x2: 850, y2: 520 },
        person_count: 85,
        density: 2.1,
        occupancy: 0.58,
        velocity_avg: 1.8,
        flow_consistency: 0.76,
        pressure_score: 14.2,
        risk_score: 34.0,
        risk_level: 'moderate',
      },
      {
        zone_id: 'sector_c_barricades',
        bbox: { x1: 880, y1: 350, x2: 1200, y2: 650 },
        person_count: 22,
        density: 0.6,
        occupancy: 0.18,
        velocity_avg: 3.2,
        flow_consistency: 0.88,
        pressure_score: 4.1,
        risk_score: 8.5,
        risk_level: 'safe',
      }
    ];

    const hazards = [
      {
        id: 'hazard_scaffolding_1',
        class_name: 'scaffolding',
        bbox: {
          x1: 350.0 + driftX,
          y1: 200.0 + driftY,
          x2: 470.0 + driftX * 1.5,
          y2: 750.0 + driftY,
        },
        confidence: 0.89,
        motion_state: scaffoldingState,
        motion_delta: scaffoldingDrift,
        motion_velocity: scaffoldingVel,
        trajectory: Array.from({ length: 6 }, (_, i) => ({
          x: 410.0 + (driftX * i / 5),
          y: 475.0 + (driftY * i / 5)
        }))
      },
      {
        id: 'hazard_barricade_1',
        class_name: 'barricade',
        bbox: { x1: 800.0, y1: 650.0, x2: 950.0, y2: 720.0 },
        confidence: 0.94,
        motion_state: 'STATIC',
        motion_delta: 0.2,
        motion_velocity: 0.0,
        trajectory: [{ x: 875.0, y: 685.0 }]
      }
    ];

    const alerts: any[] = [];
    if (cri >= 80.0) {
      alerts.push({
        id: 'alert_cri_critical',
        level: 'critical',
        alert_type: 'stampede_risk',
        zone: 'Global',
        reason: `Critical crowd stampede risk! Overall CRI at ${cri.toFixed(1)}%.`,
        recommended_action: 'CRITICAL EVACUATION: Initiate orderly, phased evacuation of Sector A immediately.',
        persistence_seconds: (frame - 180) * 0.15,
      });
    } else if (cri >= 60.0) {
      alerts.push({
        id: 'alert_cri_high',
        level: 'high',
        alert_type: 'crowd_pressure',
        zone: 'Global',
        reason: `High crowd risk index detected (CRI: ${cri.toFixed(1)}%). Monitor Sector A.`,
        recommended_action: 'HIGH PRESSURE: Deploy physical patrols to form pressure-release wedges.',
        persistence_seconds: (frame - 165) * 0.15,
      });
    }

    if (scaffoldingState === 'CRITICAL') {
      alerts.push({
        id: 'alert_haz_critical',
        level: 'critical',
        alert_type: 'hazard_movement',
        zone: 'Infrastructure',
        reason: 'CRITICAL COLLAPSE DANGER: Scaffolding (hazard_scaffolding_1) is falling!',
        recommended_action: 'CRITICAL SAFETY AREA: Cordon off the area around the collapsing scaffolding immediately.',
        persistence_seconds: (frame - 182) * 0.15,
      });
    }

    const forecasts = {
      '+1m': {
        zones: zones.map(z => ({
          ...z,
          density: z.density * 1.25,
          risk_score: Math.min(100.0, z.risk_score * 1.25),
        })),
        heatmap_url: ''
      },
      '+3m': {
        zones: zones.map(z => ({
          ...z,
          density: z.density * 1.5,
          risk_score: Math.min(100.0, z.risk_score * 1.5),
        })),
        heatmap_url: ''
      },
      '+5m': {
        zones: zones.map(z => ({
          ...z,
          density: z.density * 1.8,
          risk_score: Math.min(100.0, z.risk_score * 1.8),
        })),
        heatmap_url: ''
      }
    };

    return { zones, hazards, alerts, forecasts, cri };
  };

  // Resolve simulated vs live WebSocket source
  const getTimelineLabel = (index: number) => {
    if (isConnected && wsCri !== null) return 'REAL-TIME VIDEO STREAM';
    if (index <= 150) return 'T - Safe Baseline';
    if (index <= 170) return 'T - Init Movement';
    if (index <= 185) return 'T - Structural Alert';
    return 'T - Collapse Imminent';
  };

  const simData = getSimulatedState(frameIndex);
  
  // Use WebSocket overrides if connected and streaming active processed video metrics
  const activeCri = (isConnected && wsCri !== null) ? wsCri : simData.cri;
  const activeZones = (isConnected && wsZones.length > 0) ? wsZones : simData.zones;
  const activeHazards = (isConnected && wsHazards.length > 0) ? wsHazards : simData.hazards;
  const activeAlerts = (isConnected && wsAlerts.length > 0) ? wsAlerts : simData.alerts;
  const activeForecasts = isConnected ? {
    '+1m': {
      zones: activeZones.map(z => ({ ...z, density: z.density * 1.25, risk_score: Math.min(100.0, z.risk_score * 1.25) })),
      heatmap_url: ''
    },
    '+3m': {
      zones: activeZones.map(z => ({ ...z, density: z.density * 1.5, risk_score: Math.min(100.0, z.risk_score * 1.5) })),
      heatmap_url: ''
    },
    '+5m': {
      zones: activeZones.map(z => ({ ...z, density: z.density * 1.8, risk_score: Math.min(100.0, z.risk_score * 1.8) })),
      heatmap_url: ''
    }
  } : simData.forecasts;

  return (
    <div className="stagger-children space-y-6">
      {/* Top Telemetry Header Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-600/10 border border-cyan-500/20 text-cyan-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Triveni Sangam Digital Twin</h2>
            <p className="text-[10px] text-slate-400 font-mono">{isConnected ? 'LIVE FEED FROM VIDEO PROCESSOR' : '5G MEC EDGE CO-SIMULATOR ACTIVE'}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-wider">CRI Overall</span>
            <span className={`text-base font-extrabold font-mono ${
              activeCri >= 75 ? 'text-rose-500' : activeCri >= 50 ? 'text-amber-500' : activeCri >= 25 ? 'text-yellow-400' : 'text-emerald-400'
            }`}>
              {activeCri.toFixed(1)}%
            </span>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-wider">Active Hazards</span>
            <span className="text-base font-extrabold font-mono text-white">
              {activeHazards.filter(h => h.motion_state !== 'STATIC').length} / {activeHazards.length}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-wider">Confirmed Alerts</span>
            <span className={`text-base font-extrabold font-mono ${activeAlerts.length > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
              {activeAlerts.length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-stretch h-[calc(100vh-230px)]">
        {/* Map Panel Container */}
        <div className="flex flex-col h-full min-h-[500px]">
          <DigitalTwinMap
            zones={activeZones}
            hazards={activeHazards}
            alerts={activeAlerts}
            forecasts={activeForecasts}
            selectedHorizon={selectedHorizon}
            showHeatmap={showHeatmap}
            showFlow={showFlow}
            showRiskZones={showRiskZones}
            showHazards={showHazards}
            showResources={showResources}
            showForecasts={showForecasts}
          />
        </div>

        {/* Sidebar Controls Panel */}
        <div className="flex flex-col gap-6">
          {/* Layer Controls Card */}
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-md flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Twin Overlays</h3>
            </div>
            
            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-xs text-slate-300 group-hover:text-white transition-colors">Base Heatmap</span>
                <input 
                  type="checkbox" 
                  checked={showHeatmap} 
                  onChange={(e) => setShowHeatmap(e.target.checked)} 
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-cyan-500 accent-cyan-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-xs text-slate-300 group-hover:text-white transition-colors">Flow Vectors</span>
                <input 
                  type="checkbox" 
                  checked={showFlow} 
                  onChange={(e) => setShowFlow(e.target.checked)} 
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-cyan-500 accent-cyan-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-xs text-slate-300 group-hover:text-white transition-colors">Risk Boundaries</span>
                <input 
                  type="checkbox" 
                  checked={showRiskZones} 
                  onChange={(e) => setShowRiskZones(e.target.checked)} 
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-cyan-500 accent-cyan-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-xs text-slate-300 group-hover:text-white transition-colors">Structural Hazards</span>
                <input 
                  type="checkbox" 
                  checked={showHazards} 
                  onChange={(e) => setShowHazards(e.target.checked)} 
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-cyan-500 accent-cyan-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-xs text-slate-300 group-hover:text-white transition-colors">Emergency Resources</span>
                <input 
                  type="checkbox" 
                  checked={showResources} 
                  onChange={(e) => setShowResources(e.target.checked)} 
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-cyan-500 accent-cyan-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-xs text-slate-300 group-hover:text-white transition-colors">Risk Projections</span>
                <input 
                  type="checkbox" 
                  checked={showForecasts} 
                  onChange={(e) => setShowForecasts(e.target.checked)} 
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-cyan-500 accent-cyan-500 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Time & Forecast Navigation */}
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-md flex flex-col gap-4 flex-1">
            <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Temporal Projection</h3>
            </div>

            <div className="flex flex-col gap-4 flex-1 justify-between">
              {/* Horizon Tabs */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'now', label: 'Live (Now)' },
                  { id: '+1m', label: '+1 Min' },
                  { id: '+3m', label: '+3 Min' },
                  { id: '+5m', label: '+5 Min' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedHorizon(item.id as any)}
                    className={`p-2 rounded-xl text-center text-xs font-semibold border transition-all cursor-pointer ${
                      selectedHorizon === item.id
                        ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.1)]'
                        : 'bg-slate-950 border-slate-900 hover:bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Offline/Standalone Timeline scrubber */}
              {(!isConnected || wsCri === null) && (
                <div className="space-y-3 border-t border-slate-800/80 pt-4">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-500">TIMELINE INDEX</span>
                    <span className="text-white font-semibold">{getTimelineLabel(frameIndex)}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      {isPlaying ? <Pause className="w-4.5 h-4.5" /> : <Play className="w-4.5 h-4.5" />}
                    </button>

                    <input
                      type="range"
                      min={150}
                      max={200}
                      value={frameIndex}
                      onChange={(e) => {
                        setIsPlaying(false);
                        setFrameIndex(parseInt(e.target.value));
                      }}
                      className="flex-1 h-1.5 rounded-lg bg-slate-850 appearance-none outline-none cursor-pointer accent-cyan-400"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
