/* Live Monitoring Page — Video feed with detection overlay and crowd metrics */

import { useState, useEffect } from 'react';
import { Play, Cpu, Activity, User, HelpCircle, Layers, Sparkles, Send } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import { API_V1, API_BASE_URL } from '../config/api';
import type { Video, SourceType } from '../types/video';
import type { Detection, ZoneMetrics, RiskLevel, FlowArrow } from '../types/crowd';

// Component Imports
import SourceSelector from '../components/video/SourceSelector';
import VideoUploader from '../components/video/VideoUploader';
import VideoPlayer from '../components/video/VideoPlayer';
import CameraConfig from '../components/video/CameraConfig';
import RiskGauge from '../components/common/RiskGauge';
import MetricCard from '../components/common/MetricCard';
import StatusBadge from '../components/common/StatusBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function LiveMonitoring() {
  const [source, setSource] = useState<SourceType>('upload');
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Gemini Copilot States
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'gemini'; text: string }>>([
    {
      sender: 'gemini',
      text: 'System online. I am connected to the crowd monitoring feed. Ask me any questions about safety protocols, crowd density alerts, or evacuation routing.'
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('');

  // Video list and metrics states
  const [videoList, setVideoList] = useState<Video[]>([]);
  const [videoMetrics, setVideoMetrics] = useState<any[]>([]);

  // Load Gemini API Key and Model on mount
  useEffect(() => {
    const key = localStorage.getItem('GEMINI_API_KEY') || '';
    const mdl = localStorage.getItem('GEMINI_MODEL') || 'gemini-2.5-flash';
    setGeminiApiKey(key);
    setGeminiModel(mdl);

    // Retrieve active video from localStorage
    const savedVideoStr = localStorage.getItem('CS_ACTIVE_VIDEO');
    if (savedVideoStr) {
      try {
        const savedVideo = JSON.parse(savedVideoStr);
        setCurrentVideo(savedVideo);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Fetch list of previously uploaded/processed videos
  useEffect(() => {
    fetch(`${API_V1}/videos/`)
      .then(res => res.json())
      .then(data => {
        if (data && data.videos) {
          setVideoList(data.videos);
        }
      })
      .catch(err => console.error('Failed to fetch videos:', err));
  }, [currentVideo]);

  // Fetch metrics file if video is processed
  useEffect(() => {
    if (source === 'upload' && currentVideo && currentVideo.status === 'processed') {
      fetch(`${API_BASE_URL}/uploads/${currentVideo.id}_metrics.json`)
        .then(res => {
          if (!res.ok) throw new Error('Metrics file not found');
          return res.json();
        })
        .then(data => {
          setVideoMetrics(data);
          console.log(`Loaded ${data.length} frames of telemetry metrics for video.`);
        })
        .catch(err => {
          console.warn('Telemetry metrics file not found/loaded yet:', err);
          setVideoMetrics([]);
        });
    } else {
      setVideoMetrics([]);
    }
  }, [currentVideo, source]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const response = await fetch(`${API_V1}/gemini/copilot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gemini-API-Key': geminiApiKey
        },
        body: JSON.stringify({
          message: userMsg,
          model: geminiModel,
          metrics: {
            total_persons: totalPersons,
            density: density,
            velocity: velocity,
            consistency: consistency,
            pressure: pressure,
            cri: overallCri,
            risk_level: riskLevel
          }
        })
      });

      const data = await response.json();
      if (response.ok && data.reply) {
        setChatMessages(prev => [...prev, { sender: 'gemini', text: data.reply }]);
      } else {
        setChatMessages(prev => [...prev, { sender: 'gemini', text: data.detail || 'Error: Could not retrieve safety advice.' }]);
      }
    } catch (err: any) {
      setChatMessages(prev => [...prev, { sender: 'gemini', text: `Failed to connect: ${err.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Real-time metric states
  const [overallCri, setOverallCri] = useState<number>(0);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('safe');
  const [totalPersons, setTotalPersons] = useState<number>(0);
  const [density, setDensity] = useState<number>(0);
  const [velocity, setVelocity] = useState<number>(0);
  const [consistency, setConsistency] = useState<number>(0);
  const [pressure, setPressure] = useState<number>(0);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [zones, setZones] = useState<ZoneMetrics[]>([]);
  const [frameNumber, setFrameNumber] = useState<number>(0);
  const [heatmapUrl, setHeatmapUrl] = useState<string>('');
  const [flowArrows, setFlowArrows] = useState<FlowArrow[]>([]);

  // WebSocket connection for crowd metrics
  const { isConnected, lastMessage } = useWebSocket({
    url: '/ws/live',
    autoConnect: true,
  });

  const handleFrameUpdate = (frameMetrics: any) => {
    setFrameNumber(frameMetrics.frame_number);
    setOverallCri(frameMetrics.overall_cri);
    setRiskLevel(frameMetrics.risk_level);
    setTotalPersons(frameMetrics.total_persons);
    setDetections(frameMetrics.detections || []);
    setZones(frameMetrics.zones || []);
    setHeatmapUrl(frameMetrics.heatmap_url || '');
    setFlowArrows(frameMetrics.flow_arrows || []);

    if (frameMetrics.metrics) {
      setDensity(frameMetrics.metrics.density);
      setVelocity(frameMetrics.metrics.velocity_avg);
      setConsistency(frameMetrics.metrics.flow_consistency);
      setPressure(frameMetrics.metrics.pressure_score);
    }
  };

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    // Handle progress updates
    if (lastMessage.video_id === currentVideo?.id && lastMessage.progress !== undefined) {
      setProgress(lastMessage.progress);
      if (lastMessage.status === 'processed') {
        setProcessing(false);
        if (currentVideo) {
          setCurrentVideo({ ...currentVideo, status: 'processed', processing_progress: 100 });
        }
      }
      return;
    }

    // Handle crowd metrics updates
    if (lastMessage.type === 'crowd_update') {
      // If we have loaded actual video metrics for local synced playback, ignore websocket telemetry
      if (videoMetrics && videoMetrics.length > 0) {
        return;
      }

      // If we have an uploaded video being processed, filter to only its video_id
      // but allow through if video_id is null (general telemetry) or if no video selected yet
      if (source === 'upload' && currentVideo && lastMessage.video_id !== null && lastMessage.video_id !== currentVideo.id) {
        return;
      }

      setFrameNumber(lastMessage.frame_number);
      setOverallCri(lastMessage.overall_cri);
      setRiskLevel(lastMessage.risk_level);
      setTotalPersons(lastMessage.total_persons);
      setDetections(lastMessage.detections || []);
      setZones(lastMessage.zones || []);
      setHeatmapUrl(lastMessage.heatmap_url || '');
      setFlowArrows(lastMessage.flow_arrows || []);

      if (lastMessage.metrics) {
        setDensity(lastMessage.metrics.density);
        setVelocity(lastMessage.metrics.velocity_avg);
        setConsistency(lastMessage.metrics.flow_consistency);
        setPressure(lastMessage.metrics.pressure_score);
      }
    }
  }, [lastMessage, currentVideo, source, videoMetrics]);

  // Trigger processing on the backend
  const handleStartProcessing = async () => {
    if (!currentVideo) return;

    setProcessing(true);
    setProgress(0);

    try {
      const response = await fetch(`${API_V1}/videos/${currentVideo.id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processing_fps: 10,
          enable_tracking: true,
          enable_density: true,
          enable_flow: true,
          api_key: geminiApiKey,
          model: geminiModel,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start video processing');
      }

      // Update local state status to processing
      setCurrentVideo({
        ...currentVideo,
        status: 'processing',
        processing_progress: 0,
      });

    } catch (err) {
      console.error(err);
      setProcessing(false);
    }
  };

  // Simulated live stream url for RTSP/5G demo
  const getSimulatedStreamUrl = () => {
    if (source === 'sparsh_5g' || source === 'rtsp' || source === 'ip_camera' || source === 'webcam') {
      return 'https://assets.mixkit.co/videos/preview/mixkit-crowd-of-people-walking-on-a-street-34292-large.mp4';
    }
    return undefined;
  };

  return (
    <div className="stagger-children">
      {/* Source Selector */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <SourceSelector currentSource={source} onSourceChange={(src) => {
          setSource(src);
          // Reset metrics on source toggle
          setCurrentVideo(null);
          setProcessing(false);
          setProgress(0);
          setDetections([]);
          setHeatmapUrl('');
          setFlowArrows([]);
        }} />
      </div>

      <div className="dashboard-grid">
        {/* Main Feed Panel */}
        <div className="glass-card panel-wide panel-tall" style={{ gridColumn: 'span 2' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title">
              <Activity size={16} className={isConnected ? 'text-cyan animate-pulse' : 'text-muted'} />
              {source === 'upload' ? 'Video File Feed' : 'Live Camera Feed'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StatusBadge status={isConnected ? 'connected' : 'disconnected'} />
              {source === 'upload' && currentVideo && (
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    setCurrentVideo(null);
                    localStorage.removeItem('CS_ACTIVE_VIDEO');
                    setVideoMetrics([]);
                  }}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  Close Video
                </button>
              )}
              {source === 'upload' && currentVideo && currentVideo.status === 'uploaded' && (
                <button
                  id="btn-process-video"
                  onClick={handleStartProcessing}
                  className="btn btn-primary"
                  style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 6 }}
                  disabled={processing}
                >
                  <Play size={12} />
                  Start AI Pipeline
                </button>
              )}
            </div>
          </div>

          <div style={{ padding: 'var(--space-md)' }}>
            {source === 'upload' ? (
              !currentVideo ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                  <VideoUploader onUploadSuccess={(video) => {
                    setCurrentVideo(video);
                    localStorage.setItem('CS_ACTIVE_VIDEO', JSON.stringify(video));
                  }} />
                  {/* Select previously processed/uploaded videos */}
                  {videoList.length > 0 && (
                    <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-bright)', marginBottom: 8 }}>
                        Or select a previously uploaded video:
                      </label>
                      <select
                        className="form-input"
                        onChange={(e) => {
                          const vid = videoList.find(v => v.id === e.target.value);
                          if (vid) {
                            setCurrentVideo(vid);
                            localStorage.setItem('CS_ACTIVE_VIDEO', JSON.stringify(vid));
                          }
                        }}
                        defaultValue=""
                        style={{ width: '100%', background: 'var(--bg-tertiary)', color: 'var(--text-bright)', border: '1px solid var(--border-color)', borderRadius: '6px', height: '36px', padding: '0 8px', fontSize: '13px' }}
                      >
                        <option value="" disabled>-- Select existing video --</option>
                        {videoList.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.original_filename} ({v.status.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                  <VideoPlayer
                    video={currentVideo}
                    detections={detections}
                    currentFrameNumber={frameNumber}
                    riskLevel={riskLevel}
                    heatmapUrl={heatmapUrl}
                    flowArrows={flowArrows}
                    videoMetrics={videoMetrics}
                    onFrameUpdate={handleFrameUpdate}
                  />
                  {processing && (
                    <div className="glass-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(6, 182, 212, 0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <LoadingSpinner size="sm" />
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-bright)' }}>
                          AI Processing: Running YOLO11 + ByteTrack...
                        </span>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>
                        {progress.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              )
            ) : (
              // IP Cameras / Sparsh 5G / Webcam Feed
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <VideoPlayer
                  video={null}
                  videoUrl={getSimulatedStreamUrl()}
                  detections={detections}
                  currentFrameNumber={frameNumber}
                  riskLevel={riskLevel}
                  isLiveStream={true}
                  heatmapUrl={heatmapUrl}
                  flowArrows={flowArrows}
                />
                <CameraConfig />
              </div>
            )}
          </div>
        </div>

        {/* Analytics Panel */}
        <div className="glass-card panel-tall" style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 1' }}>
          <div className="card-header">
            <span className="card-title">Detection Analytics</span>
          </div>
          <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 'var(--space-md)' }}>
            <RiskGauge value={overallCri} size={140} />

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              <MetricCard
                label="Crowd Count"
                value={totalPersons}
                icon={<User size={14} />}
                colorClass="accent"
              />
              <MetricCard
                label="Crowd Density"
                value={`${density.toFixed(2)} /m²`}
                icon={<Layers size={14} />}
                colorClass="primary"
              />
            </div>
          </div>
        </div>

        {/* Gemini Safety Copilot Panel */}
        <div className="glass-card panel-tall" style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 1', border: '1px solid rgba(139, 92, 246, 0.2)', boxShadow: '0 0 15px rgba(139, 92, 246, 0.05)' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={16} className="text-purple" style={{ color: '#8b5cf6' }} />
              Gemini Safety Copilot
            </span>
            <span style={{ fontSize: '9px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
              ONLINE
            </span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', overflow: 'hidden', padding: 'var(--space-sm)' }}>
            {/* Messages container */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: 'var(--space-sm)', paddingRight: '4px', maxHeight: '280px' }}>
              {chatMessages.map((msg, idx) => (
                <div key={idx} style={{
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: msg.sender === 'user' ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  border: msg.sender === 'user' ? '1px solid rgba(6, 182, 212, 0.25)' : '1px solid var(--border-color)',
                  borderRadius: msg.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  color: 'var(--text-bright)',
                  lineHeight: '1.4',
                  whiteSpace: 'pre-wrap'
                }}>
                  {msg.text}
                </div>
              ))}
              {isTyping && (
                <div style={{
                  alignSelf: 'flex-start',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px 12px 12px 2px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span className="dot animate-bounce" style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-muted)' }} />
                  <span className="dot animate-bounce" style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-muted)', animationDelay: '0.2s' }} />
                  <span className="dot animate-bounce" style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-muted)', animationDelay: '0.4s' }} />
                </div>
              )}
            </div>

            {/* Warn if API Key not configured */}
            {!geminiApiKey && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '8px 10px',
                fontSize: '11px',
                color: 'var(--critical)',
                marginBottom: '10px',
                textAlign: 'center'
              }}>
                Gemini API Key is missing. Please configure it in the <a href="/settings" style={{ color: '#8b5cf6', textDecoration: 'underline', fontWeight: 600 }}>Settings</a> page to activate Copilot.
              </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-input"
                placeholder={geminiApiKey ? "Ask safety copilot..." : "API key required"}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={!geminiApiKey || isTyping}
                style={{ flex: 1, height: '36px', fontSize: '12px', padding: '0 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!geminiApiKey || !chatInput.trim() || isTyping}
                style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Secondary Analytics Row */}
      <div className="dashboard-grid" style={{ marginTop: 'var(--space-lg)' }}>
        <MetricCard
          label="Average Velocity"
          value={`${velocity.toFixed(2)} px/f`}
          icon={<Cpu size={14} />}
          trend="stable"
          trendValue="Dynamic"
          colorClass="info"
        />
        <MetricCard
          label="Flow Consistency"
          value={`${Math.round(consistency * 100)}%`}
          icon={<Activity size={14} />}
          trend={consistency > 0.8 ? 'up' : 'down'}
          trendValue={consistency > 0.8 ? 'Aligned' : 'Turbulent'}
          colorClass="accent"
        />
        <MetricCard
          label="Estimated Pressure"
          value={`${pressure.toFixed(1)} /100`}
          icon={<HelpCircle size={14} />}
          colorClass={pressure > 75 ? 'critical' : pressure > 40 ? 'warning' : 'safe'}
        />
      </div>

      {/* Zone Details & Active Tracks */}
      <div className="dashboard-grid" style={{ marginTop: 'var(--space-lg)' }}>
        {/* Active Zones */}
        <div className="glass-card panel-wide">
          <div className="card-header">
            <span className="card-title">Zone Occupancy</span>
          </div>
          <div style={{ padding: 'var(--space-md)' }}>
            <div className="zones-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {zones.map((zone) => (
                <div key={zone.zone_id} className="zone-row" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 6,
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-bright)', textTransform: 'uppercase', fontSize: '13px' }}>
                      {zone.zone_id.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Density: {zone.density.toFixed(2)}/m²
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-bright)' }}>
                      {zone.person_count} pax
                    </span>
                    <StatusBadge status={zone.risk_level} />
                  </div>
                </div>
              ))}
              {zones.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: 20 }}>
                  Awaiting feed to initialize risk zones
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ByteTrack Multi-Object Tracker */}
        <div className="glass-card panel-wide" style={{ gridColumn: 'span 2' }}>
          <div className="card-header">
            <span className="card-title">ByteTrack Active Tracks</span>
          </div>
          <div style={{ padding: 'var(--space-md)', maxHeight: '220px', overflowY: 'auto' }}>
            <table className="analytics-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ paddingBottom: 8 }}>Track ID</th>
                  <th style={{ paddingBottom: 8 }}>Velocity</th>
                  <th style={{ paddingBottom: 8 }}>Direction</th>
                  <th style={{ paddingBottom: 8 }}>Duration</th>
                  <th style={{ paddingBottom: 8 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {detections.filter(d => d.track_id !== undefined).slice(0, 10).map((det) => (
                  <tr key={det.track_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                    <td style={{ padding: '8px 0', fontWeight: 600, color: 'var(--text-bright)' }}>
                      #{det.track_id}
                    </td>
                    <td style={{ padding: '8px 0', color: 'var(--accent)' }}>
                      {det.velocity?.toFixed(1) || '0.0'} px/f
                    </td>
                    <td style={{ padding: '8px 0' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          display: 'inline-block',
                          transform: `rotate(${det.direction || 0}deg)`,
                          transition: 'transform 0.5s ease',
                          color: 'var(--primary)'
                        }}>
                          ➔
                        </span>
                        {Math.round(det.direction || 0)}°
                      </span>
                    </td>
                    <td style={{ padding: '8px 0', color: 'var(--text-muted)' }}>
                      {(det as any).duration_frames || '1'} frames
                    </td>
                    <td style={{ padding: '8px 0' }}>
                      <span style={{
                        padding: '2px 6px',
                        background: 'rgba(6, 182, 212, 0.1)',
                        border: '1px solid rgba(6, 182, 212, 0.2)',
                        borderRadius: 4,
                        fontSize: '9px',
                        color: 'var(--accent)',
                        textTransform: 'uppercase'
                      }}>
                        tracking
                      </span>
                    </td>
                  </tr>
                ))}
                {detections.filter(d => d.track_id !== undefined).length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                      No active tracks. Upload or configure feed to start multi-object tracking.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
