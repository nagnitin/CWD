import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, Compass, Zap } from 'lucide-react';

// Coordinates centered around Prayagraj Kumbh Mela Triveni Sangam ghats
const DEFAULT_CENTER: L.LatLngExpression = [25.425, 81.890];
const MAP_BOUNDS = L.latLngBounds(
  [25.415, 81.875], // Southwest
  [25.435, 81.905]  // Northeast
);

interface ZoneMetrics {
  zone_id: string;
  bbox: { x1: number; y1: number; x2: number; y2: number };
  person_count: number;
  density: number;
  occupancy: number;
  velocity_avg: number;
  flow_consistency: number;
  pressure_score: number;
  risk_score: number;
  risk_level: string;
}

interface HazardInfo {
  id: string;
  class_name: string;
  bbox: { x1: number; y1: number; x2: number; y2: number };
  confidence: number;
  motion_state: string;
  motion_delta: number;
  motion_velocity: number;
  trajectory: { x: number; y: number }[];
}

interface AlertInfo {
  id: string;
  level: string;
  alert_type: string;
  zone: string | null;
  reason: string;
  recommended_action: string | null;
  persistence_seconds: number;
}

interface DigitalTwinMapProps {
  zones: ZoneMetrics[];
  hazards: HazardInfo[];
  alerts: AlertInfo[];
  forecasts?: {
    [key: string]: {
      zones: ZoneMetrics[];
      heatmap_url: string;
    };
  };
  selectedHorizon: string; // "now", "+1m", "+3m", "+5m"
  showHeatmap: boolean;
  showFlow: boolean;
  showRiskZones: boolean;
  showHazards: boolean;
  showResources: boolean;
  showForecasts: boolean;
}

export default function DigitalTwinMap({
  zones,
  hazards,
  alerts,
  forecasts,
  selectedHorizon,
  showHeatmap,
  showFlow,
  showRiskZones,
  showHazards,
  showResources,
  showForecasts,
}: DigitalTwinMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Layers references for dynamic updates
  const heatmapLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const flowLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const riskZonesLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const hazardsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const resourcesLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const forecastLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [isOffline, setIsOffline] = useState(false);

  // Setup custom mock resource database positioned around the Kumbh Mela Ghat map
  const mockResources = [
    { id: 'res_sec_1', type: 'security', name: 'Checkpoint Alpha', coords: [25.4262, 81.8828], status: 'active' },
    { id: 'res_sec_2', type: 'security', name: 'Checkpoint Beta', coords: [25.4248, 81.8962], status: 'active' },
    { id: 'res_med_1', type: 'medical', name: 'First Aid Booth 1', coords: [25.4281, 81.8890], status: 'active' },
    { id: 'res_med_2', type: 'medical', name: 'First Aid Station 2', coords: [25.4215, 81.8845], status: 'active' },
    { id: 'res_exit_1', type: 'exit', name: 'Emergency Exit West', coords: [25.4230, 81.8790], status: 'open' },
    { id: 'res_exit_2', type: 'exit', name: 'Emergency Exit North', coords: [25.4310, 81.8920], status: 'open' },
    { id: 'res_pat_1', type: 'patrol', name: 'Mobile Patrol Red', coords: [25.4240, 81.8885], status: 'deploying' },
  ];

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create Leaflet Map instance
    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 15,
      minZoom: 14,
      maxZoom: 18,
      maxBounds: MAP_BOUNDS,
      zoomControl: false,
    });

    mapRef.current = map;

    // Position Zoom control at top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Try loading OpenStreetMap tiles with connection status checks
    const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    });

    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;

    // Check offline trigger on tile error
    tileLayer.on('tileerror', () => {
      setIsOffline(true);
    });

    // Initialize layer groups
    heatmapLayerGroupRef.current = L.layerGroup().addTo(map);
    flowLayerGroupRef.current = L.layerGroup().addTo(map);
    riskZonesLayerGroupRef.current = L.layerGroup().addTo(map);
    hazardsLayerGroupRef.current = L.layerGroup().addTo(map);
    resourcesLayerGroupRef.current = L.layerGroup().addTo(map);
    forecastLayerGroupRef.current = L.layerGroup().addTo(map);

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Dynamic Layers (Heatmap, flow, risk zones, hazards, resources, forecasts)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous layers
    heatmapLayerGroupRef.current?.clearLayers();
    flowLayerGroupRef.current?.clearLayers();
    riskZonesLayerGroupRef.current?.clearLayers();
    hazardsLayerGroupRef.current?.clearLayers();
    resourcesLayerGroupRef.current?.clearLayers();
    forecastLayerGroupRef.current?.clearLayers();

    // Mapping coefficient: translates frame coordinates (1920x1080) to lat/lng inside bounds
    const mapCoords = (x: number, y: number): L.LatLngExpression => {
      // Norm coordinates between 0 and 1
      const pctX = x / 1280.0;
      const pctY = y / 720.0;

      const lat = 25.433 - pctY * 0.015;  // scale y
      const lng = 81.877 + pctX * 0.025;  // scale x
      return [lat, lng];
    };

    // ─── 1. HEATMAP OVERLAY ───────────────────────────────────────────
    if (showHeatmap && selectedHorizon === 'now') {
      // Render density zones as colored transparent circles for high density
      zones.forEach(zone => {
        const center = mapCoords(
          (zone.bbox.x1 + zone.bbox.x2) / 2,
          (zone.bbox.y1 + zone.bbox.y2) / 2
        );
        const intensity = Math.min(zone.density / 4.5, 1.0); // max 1.0
        
        if (intensity > 0.15) {
          const color = intensity > 0.8 ? '#ef4444' : intensity > 0.5 ? '#f97316' : '#eab308';
          L.circle(center, {
            radius: 40 + intensity * 60,
            fillColor: color,
            fillOpacity: 0.15 + intensity * 0.35,
            stroke: false,
          }).addTo(heatmapLayerGroupRef.current!);
        }
      });
    }

    // ─── 2. FLOW OVERLAY ──────────────────────────────────────────────
    if (showFlow && selectedHorizon === 'now') {
      // Draw simulated or real flow vectors from zone speeds and consistency
      zones.forEach(zone => {
        const center = mapCoords(
          (zone.bbox.x1 + zone.bbox.x2) / 2,
          (zone.bbox.y1 + zone.bbox.y2) / 2
        );
        
        if (zone.velocity_avg > 0.8) {
          // Draw dynamic flowing arrow line
          const start = center as [number, number];
          const end: L.LatLngExpression = [
            start[0] - 0.0008, // directional offset downwards
            start[1] + (zone.flow_consistency > 0.6 ? 0.0012 : -0.0005)
          ];
          
          L.polyline([start, end], {
            color: '#06b6d4',
            weight: 3,
            opacity: 0.8,
            dashArray: '5, 8'
          }).addTo(flowLayerGroupRef.current!);

          // Small arrowhead
          L.circle(end, {
            radius: 8,
            fillColor: '#06b6d4',
            fillOpacity: 1,
            stroke: false
          }).addTo(flowLayerGroupRef.current!);
        }
      });
    }

    // ─── 3. RISK ZONES (POLYGONS) ─────────────────────────────────────
    if (showRiskZones) {
      zones.forEach(zone => {
        const p1 = mapCoords(zone.bbox.x1, zone.bbox.y1);
        const p2 = mapCoords(zone.bbox.x2, zone.bbox.y1);
        const p3 = mapCoords(zone.bbox.x2, zone.bbox.y2);
        const p4 = mapCoords(zone.bbox.x1, zone.bbox.y2);

        let color = '#10b981'; // safe green
        if (zone.risk_level === 'critical') color = '#ef4444';
        else if (zone.risk_level === 'high') color = '#f97316';
        else if (zone.risk_level === 'moderate') color = '#eab308';

        const poly = L.polygon([p1, p2, p3, p4], {
          color: color,
          weight: zone.risk_level !== 'safe' ? 3 : 1,
          fillColor: color,
          fillOpacity: zone.risk_level !== 'safe' ? 0.25 : 0.05,
        });

        // Add detailed hover tooltip
        poly.bindTooltip(
          `<div class="p-2 bg-slate-900/90 text-white backdrop-blur border border-slate-700 rounded-lg shadow-xl text-xs space-y-1">
            <div class="font-bold text-cyan-400">${zone.zone_id.toUpperCase()}</div>
            <div>Risk Index: <span class="font-semibold text-amber-400">${(zone.risk_score || 0).toFixed(1)}%</span></div>
            <div>Density: <span class="font-semibold">${(zone.density || 0).toFixed(2)}/m²</span></div>
            <div>Pressure: <span class="font-semibold">${(zone.pressure_score || 0).toFixed(1)}</span></div>
            <div>Occupancy: <span class="font-semibold">${((zone.occupancy || 0) * 100).toFixed(0)}%</span></div>
          </div>`,
          { permanent: false, direction: 'center', opacity: 0.95 }
        );

        poly.addTo(riskZonesLayerGroupRef.current!);

        // Draw animated bottleneck pulse if risk is critical
        if (zone.risk_level === 'critical') {
          const center = mapCoords(
            (zone.bbox.x1 + zone.bbox.x2) / 2,
            (zone.bbox.y1 + zone.bbox.y2) / 2
          );
          
          // Outer pulsing ring
          const pulseIcon = L.divIcon({
            className: 'custom-pulsing-icon',
            html: `<div class="relative w-8 h-8 rounded-full border border-red-500 bg-red-500/20 animate-ping"></div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });
          L.marker(center, { icon: pulseIcon }).addTo(riskZonesLayerGroupRef.current!);
        }
      });
    }

    // ─── 4. STRUCTURAL HAZARDS OVERLAY ───────────────────────────────
    if (showHazards) {
      hazards.forEach(hazard => {
        const center = mapCoords(
          (hazard.bbox.x1 + hazard.bbox.x2) / 2,
          (hazard.bbox.y1 + hazard.bbox.y2) / 2
        );

        const isCollapsing = hazard.motion_state === 'CRITICAL' || hazard.motion_state === 'ALERTING';
        const ringColor = hazard.motion_state === 'CRITICAL' ? 'border-red-500 bg-red-600' : 'border-amber-500 bg-amber-500';

        const hazardIcon = L.divIcon({
          className: 'custom-hazard-icon',
          html: `
            <div class="relative flex items-center justify-center w-10 h-10">
              ${isCollapsing ? `<div class="absolute inset-0 rounded-full ${ringColor}/30 animate-ping"></div>` : ''}
              <div class="flex items-center justify-center w-8 h-8 rounded-full border border-slate-700 bg-slate-900 text-amber-400 shadow-lg hover:scale-115 transition-transform duration-200">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });

        const marker = L.marker(center, { icon: hazardIcon });
        
        marker.bindTooltip(
          `<div class="p-2.5 bg-slate-950/95 border border-slate-700 rounded-lg shadow-xl text-xs space-y-1.5 min-w-[200px]">
            <div class="flex items-center gap-1.5 font-bold text-rose-500">
              <span class="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
              <span>HAZARD ALERT</span>
            </div>
            <div class="text-white font-medium capitalize">${hazard.class_name} ID: ${hazard.id}</div>
            <div class="grid grid-cols-2 gap-x-2 text-slate-400 border-t border-slate-800 pt-1 mt-1">
              <div>State:</div>
              <div class="font-semibold text-rose-400 capitalize">${hazard.motion_state.toLowerCase()}</div>
              <div>Velocity:</div>
              <div class="font-semibold text-white">${hazard.motion_velocity.toFixed(2)} px/f</div>
              <div>Total Drift:</div>
              <div class="font-semibold text-white">${hazard.motion_delta.toFixed(1)} px</div>
            </div>
          </div>`,
          { direction: 'top', offset: [0, -10], opacity: 0.95 }
        );

        marker.addTo(hazardsLayerGroupRef.current!);
      });
    }

    // ─── 5. EMERGENCY RESOURCES ──────────────────────────────────────
    if (showResources) {
      mockResources.forEach(res => {
        let iconHtml = '';
        let colorClass = '';

        if (res.type === 'security') {
          colorClass = 'bg-blue-600/20 border-blue-500 text-blue-400';
          iconHtml = `
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 13c0 5-3.5 7.5-7.66 9.7a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 .76-.97l8-2a1 1 0 0 1 .48 0l8 2a1 1 0 0 1 .76.97v7Z"/>
            </svg>`;
        } else if (res.type === 'medical') {
          colorClass = 'bg-emerald-600/20 border-emerald-500 text-emerald-400';
          iconHtml = `
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>`;
        } else if (res.type === 'exit') {
          colorClass = 'bg-teal-600/20 border-teal-500 text-teal-400';
          iconHtml = `
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5m4 14l5-5-5-5m5 5H9"/>
            </svg>`;
        } else {
          colorClass = 'bg-violet-600/20 border-violet-500 text-violet-400';
          iconHtml = `
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="8" r="5"/><path d="M3 21v-2a7 7 0 0 1 14 0v2"/>
            </svg>`;
        }

        const resIcon = L.divIcon({
          className: 'custom-resource-icon',
          html: `
            <div class="flex items-center justify-center w-8 h-8 rounded-full border border-slate-700/80 bg-slate-900 text-white shadow-md hover:scale-110 transition-transform duration-150">
              <div class="flex items-center justify-center w-6 h-6 rounded-full border ${colorClass}">
                ${iconHtml}
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const marker = L.marker(res.coords as L.LatLngExpression, { icon: resIcon });
        
        marker.bindTooltip(
          `<div class="p-2 bg-slate-900 border border-slate-700 text-white text-xs rounded shadow-lg">
            <span class="font-bold text-cyan-400 capitalize">${res.type}:</span> ${res.name} (${res.status})
          </div>`,
          { direction: 'top', opacity: 0.9 }
        );

        marker.addTo(resourcesLayerGroupRef.current!);
      });
    }

    // ─── 6. FORECAST LAYER OVERLAY ────────────────────────────────────
    if (showForecasts && selectedHorizon !== 'now' && forecasts) {
      const forecastData = forecasts[selectedHorizon];
      if (forecastData && forecastData.zones) {
        forecastData.zones.forEach(z => {
          const center = mapCoords(
            (z.bbox.x1 + z.bbox.x2) / 2,
            (z.bbox.y1 + z.bbox.y2) / 2
          );
          
          const predictedDensity = z.density;
          if (predictedDensity >= 3.0) {
            // Draw a futuristic forecast bottleneck radar signal
            const pulseIcon = L.divIcon({
              className: 'custom-forecast-pulse',
              html: `
                <div class="relative w-12 h-12 flex items-center justify-center">
                  <div class="absolute inset-0 rounded-full bg-cyan-500/15 border border-cyan-400/50 animate-ping"></div>
                  <div class="w-4 h-4 rounded-full bg-cyan-400 border border-slate-800 shadow-md"></div>
                </div>
              `,
              iconSize: [48, 48],
              iconAnchor: [24, 24]
            });

            const marker = L.marker(center, { icon: pulseIcon });
            
            marker.bindTooltip(
              `<div class="p-2 bg-slate-900 border border-cyan-800 text-white text-xs rounded shadow-lg space-y-1">
                <div class="font-bold text-cyan-400">PREDICTED OVERLOAD (${selectedHorizon})</div>
                <div>Predicted Density: <span class="text-amber-400 font-semibold">${predictedDensity.toFixed(2)}/m²</span></div>
                <div class="text-[10px] text-slate-400">Recommendation generated in response actions.</div>
              </div>`,
              { direction: 'top', opacity: 0.95 }
            );

            marker.addTo(forecastLayerGroupRef.current!);
          }
        });
      }
    }

  }, [
    zones,
    hazards,
    alerts,
    forecasts,
    selectedHorizon,
    showHeatmap,
    showFlow,
    showRiskZones,
    showHazards,
    showResources,
    showForecasts,
  ]);

  return (
    <div className="relative w-full h-full rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
      {/* Map Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Offline Fallback Vector Display */}
      {isOffline && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 border border-amber-950/20 p-6 z-10 text-center space-y-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 shadow-lg animate-pulse">
            <Compass className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 max-w-md">
            <h3 className="text-lg font-bold text-white tracking-wide">MEC Offline Layout Engaged</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              External tile servers are currently unreachable from private 5G MEC nodes. The Digital Twin is utilizing local vector fallbacks to render safety zones and resource tracks.
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-[10px] text-cyan-400 font-mono tracking-wider shadow-inner">
            <Zap className="w-3.5 h-3.5 animate-bounce" />
            LOCAL VECTOR ENGINE RUNNING
          </div>
        </div>
      )}

      {/* Glassmorphic Compass/Scale HUD */}
      <div className="absolute bottom-5 left-5 pointer-events-none select-none flex flex-col gap-1.5 px-4 py-3 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-md shadow-xl z-1">
        <div className="flex items-center gap-2 text-white font-mono text-[10px] tracking-wider text-cyan-400 font-bold">
          <Compass className="w-3.5 h-3.5 animate-spin-slow" />
          <span>PILOT COORDINATES</span>
        </div>
        <div className="text-[10px] font-mono text-slate-400 space-y-0.5">
          <div>LAT: 25.425° N</div>
          <div>LNG: 81.890° E</div>
          <div className="text-[9px] text-slate-500 uppercase mt-1">Zone: Kumbh Ghats, Prayagraj</div>
        </div>
      </div>

      {/* Active Alerts Floating Feed */}
      {alerts.length > 0 && (
        <div className="absolute top-5 left-5 w-72 max-h-48 overflow-y-auto space-y-2 pointer-events-none z-1 pr-2 scrollbar-thin">
          {alerts.map(alert => (
            <div 
              key={alert.id} 
              className={`p-2.5 rounded-xl border backdrop-blur-md shadow-lg pointer-events-auto transition-all duration-300 hover:scale-101 flex gap-2 ${
                alert.level === 'critical' 
                  ? 'bg-rose-950/30 border-rose-500/40 text-rose-200' 
                  : alert.level === 'high' 
                    ? 'bg-amber-950/20 border-amber-500/30 text-amber-200' 
                    : 'bg-blue-950/20 border-blue-500/30 text-blue-200'
              }`}
            >
              <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
                alert.level === 'critical' ? 'text-rose-500' : alert.level === 'high' ? 'text-amber-500' : 'text-blue-500'
              }`} />
              <div className="space-y-0.5">
                <div className="text-[10px] font-bold tracking-wide uppercase font-mono">
                  {alert.alert_type} ({alert.level})
                </div>
                <div className="text-[10px] leading-relaxed text-slate-300">
                  {alert.reason}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
