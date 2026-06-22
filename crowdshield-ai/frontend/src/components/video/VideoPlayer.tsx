/* VideoPlayer Component — HTML5 video with custom controls, synced bounding boxes, density heatmaps, and motion vectors */

import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Square, Info } from 'lucide-react';
import type { Video as VideoType } from '../../types/video';
import type { Detection, RiskLevel, FlowArrow } from '../../types/crowd';

// Crowd Overlays
import HeatmapOverlay from '../crowd/HeatmapOverlay';
import FlowArrows from '../crowd/FlowArrows';

interface VideoPlayerProps {
  video: VideoType | null;
  videoUrl?: string;
  detections: Detection[];
  currentFrameNumber: number;
  originalWidth?: number;
  originalHeight?: number;
  riskLevel?: RiskLevel;
  isLiveStream?: boolean;
  heatmapUrl?: string;
  flowArrows?: FlowArrow[];
}

interface FrameData {
  detections: Detection[];
  heatmapUrl?: string;
  flowArrows?: FlowArrow[];
}

export default function VideoPlayer({
  video,
  videoUrl,
  detections = [],
  currentFrameNumber,
  originalWidth = 1920,
  originalHeight = 1080,
  riskLevel = 'safe',
  isLiveStream = false,
  heatmapUrl = '',
  flowArrows = [],
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  // Layer visibility toggles
  const [showDetections, setShowDetections] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showFlow, setShowFlow] = useState(false);
  
  // Layout dimension tracker
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const requestRef = useRef<number | null>(null);

  // Combined frame buffer for frame-accurate timeline scrubbing
  const frameBuffer = useRef<Map<number, FrameData>>(new Map());

  // Buffer incoming frame snapshots
  useEffect(() => {
    if (currentFrameNumber > 0) {
      frameBuffer.current.set(currentFrameNumber, {
        detections: detections || [],
        heatmapUrl: heatmapUrl || undefined,
        flowArrows: flowArrows || [],
      });
    }
  }, [detections, heatmapUrl, flowArrows, currentFrameNumber]);

  // Reset buffer when active video changes
  useEffect(() => {
    frameBuffer.current.clear();
  }, [video?.id]);

  // Extract current frame's visual data based on timeline
  const getActiveFrameData = (): FrameData => {
    if (isLiveStream) {
      return {
        detections: detections || [],
        heatmapUrl: heatmapUrl || undefined,
        flowArrows: flowArrows || [],
      };
    }

    const videoEl = videoRef.current;
    if (!videoEl) return { detections: [] };

    const fps = video?.fps || 30;
    const currentFrame = Math.round(videoEl.currentTime * fps);

    // Scan backwards from current frame to find the nearest keyframe metrics
    let foundFrame = -1;
    for (const frameNum of Array.from(frameBuffer.current.keys()).sort((a, b) => b - a)) {
      if (frameNum <= currentFrame) {
        foundFrame = frameNum;
        break;
      }
    }

    if (foundFrame !== -1) {
      return frameBuffer.current.get(foundFrame) || { detections: [] };
    }

    // Default fallback
    return {
      detections: detections || [],
      heatmapUrl: heatmapUrl || undefined,
      flowArrows: flowArrows || [],
    };
  };

  const activeData = getActiveFrameData();

  // Bounding boxes drawing loop
  const drawOverlay = () => {
    const videoEl = videoRef.current;
    const canvasEl = canvasRef.current;

    if (!videoEl || !canvasEl) return;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const rect = videoEl.getBoundingClientRect();
    
    // Update layout width and height states dynamically
    if (canvasEl.width !== rect.width || canvasEl.height !== rect.height) {
      canvasEl.width = rect.width;
      canvasEl.height = rect.height;
      setDimensions({ width: rect.width, height: rect.height });
    }

    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    if (showDetections) {
      const srcW = video?.width || originalWidth || 1920;
      const srcH = video?.height || originalHeight || 1080;
      const scaleX = canvasEl.width / srcW;
      const scaleY = canvasEl.height / srcH;

      activeData.detections.forEach((det) => {
        const { bbox, track_id, velocity, trajectory } = det;
        if (!bbox) return;

        const x1 = bbox.x1 * scaleX;
        const y1 = bbox.y1 * scaleY;
        const x2 = bbox.x2 * scaleX;
        const y2 = bbox.y2 * scaleY;
        const w = x2 - x1;
        const h = y2 - y1;

        const riskColor = getRiskColorHex(riskLevel);

        // 1. Draw trajectory dots and trail lines
        if (trajectory && trajectory.length > 1) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([2, 2]);

          trajectory.forEach((pt: { x: number; y: number }, idx: number) => {
            const tx = pt.x * scaleX;
            const ty = pt.y * scaleY;
            if (idx === 0) ctx.moveTo(tx, ty);
            else ctx.lineTo(tx, ty);
          });
          ctx.stroke();
          ctx.setLineDash([]);

          trajectory.forEach((pt: { x: number; y: number }) => {
            ctx.beginPath();
            ctx.arc(pt.x * scaleX, pt.y * scaleY, 2, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(6, 182, 212, 0.5)';
            ctx.fill();
          });
        }

        // 2. Bounding boxes
        ctx.strokeStyle = riskColor;
        ctx.lineWidth = 1.8;
        ctx.strokeRect(x1, y1, w, h);

        // Advanced corner borders
        const len = Math.min(8, w / 4);
        ctx.fillStyle = riskColor;
        // Top-left
        ctx.fillRect(x1 - 1, y1 - 1, len, 2.5);
        ctx.fillRect(x1 - 1, y1 - 1, 2.5, len);
        // Top-right
        ctx.fillRect(x2 - len + 1, y1 - 1, len, 2.5);
        ctx.fillRect(x2 - 1, y1 - 1, 2.5, len);
        // Bottom-left
        ctx.fillRect(x1 - 1, y2 - 1.5, len, 2.5);
        ctx.fillRect(x1 - 1, y2 - len + 1, 2.5, len);
        // Bottom-right
        ctx.fillRect(x2 - len + 1, y2 - 1.5, len, 2.5);
        ctx.fillRect(x2 - 1, y2 - len + 1, 2.5, len);

        // 3. Track label pill
        const label = `ID: ${track_id ?? 'N/A'}`;
        ctx.font = 'bold 9px Inter, sans-serif';
        const textWidth = ctx.measureText(label).width;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.fillRect(x1 - 1, y1 - 13, textWidth + 8, 13);

        ctx.fillStyle = '#f8fafc';
        ctx.fillText(label, x1 + 3, y1 - 3);

        // Speed label on bottom of box
        if (velocity && velocity > 0.5) {
          const speedLabel = `${velocity.toFixed(1)} px/f`;
          const speedTextW = ctx.measureText(speedLabel).width;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
          ctx.fillRect(x1 - 1, y2, speedTextW + 6, 12);
          ctx.fillStyle = 'var(--accent)';
          ctx.fillText(speedLabel, x1 + 3, y2 + 9);
        }
      });
    }

    requestRef.current = requestAnimationFrame(drawOverlay);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(drawOverlay);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [detections, heatmapUrl, flowArrows, currentFrameNumber, showDetections, riskLevel, video, isLiveStream]);

  // Video controller handlers
  const handlePlayPause = () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (isPlaying) {
      videoEl.pause();
    } else {
      videoEl.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    videoEl.pause();
    videoEl.currentTime = 0;
    setIsPlaying(false);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  function getRiskColorHex(level: RiskLevel): string {
    switch (level) {
      case 'safe': return '#10b981';
      case 'moderate': return '#eab308';
      case 'high': return '#f97316';
      case 'critical': return '#ef4444';
      default: return '#06b6d4';
    }
  }

  const formatTime = (timeInSecs: number) => {
    const mins = Math.floor(timeInSecs / 60);
    const secs = Math.floor(timeInSecs % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="video-player-container" style={{
      position: 'relative',
      width: '100%',
      background: '#090d16',
      borderRadius: 'var(--border-radius)',
      overflow: 'hidden',
      border: '1px solid var(--border-color)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
    }}>
      {/* Video Viewport Wrapper */}
      <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {videoUrl || (video && video.id) ? (
          <video
            ref={videoRef}
            src={videoUrl || `http://localhost:8000/uploads/${video?.filename}`}
            className="video-element"
            style={{ width: '100%', maxHeight: '480px', objectFit: 'contain' }}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            loop
            muted
            playsInline
          />
        ) : (
          <div style={{ height: '360px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <div className="pulse-circle" style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(6, 182, 212, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', marginBottom: 'var(--space-md)' }}>
              <Play size={24} />
            </div>
            <span>No Stream Active</span>
          </div>
        )}

        {/* Layer 1: Density Heatmap Image */}
        {showHeatmap && (
          <HeatmapOverlay
            heatmapUrl={activeData.heatmapUrl}
            opacity={0.55}
          />
        )}

        {/* Layer 2: Motion Vector SVG Arrows */}
        {showFlow && (
          <FlowArrows
            arrows={activeData.flowArrows || []}
            containerWidth={dimensions.width}
            containerHeight={dimensions.height}
            originalWidth={video?.width || originalWidth}
            originalHeight={video?.height || originalHeight}
            opacity={0.8}
          />
        )}

        {/* Layer 3: Tracking Canvas (Boxes and trails) */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />
      </div>

      {/* Control bar */}
      {(videoUrl || video) && (
        <div className="player-controls" style={{
          padding: '12px 16px',
          background: 'rgba(9, 13, 22, 0.9)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 20,
          position: 'relative'
        }}>
          {/* Progress Slider (Only show when not live streaming) */}
          {!isLiveStream && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleScrub}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  background: 'rgba(255, 255, 255, 0.1)',
                  appearance: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {formatTime(duration)}
              </span>
            </div>
          )}

          {/* Controls toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            {/* Playback actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              {!isLiveStream && (
                <>
                  <button onClick={handlePlayPause} className="control-btn" style={{ background: 'none', border: 'none', color: 'var(--text-bright)', cursor: 'pointer' }}>
                    {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <button onClick={handleStop} className="control-btn" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <Square size={16} />
                  </button>
                </>
              )}

              {/* Dynamic Overlay Layer Toggles */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginLeft: isLiveStream ? 0 : 12, borderLeft: isLiveStream ? 'none' : '1px solid rgba(255,255,255,0.08)', paddingLeft: isLiveStream ? 0 : 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={showDetections}
                    onChange={(e) => setShowDetections(e.target.checked)}
                    style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                  Boxes
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={showHeatmap}
                    onChange={(e) => setShowHeatmap(e.target.checked)}
                    style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                  Heatmap
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={showFlow}
                    onChange={(e) => setShowFlow(e.target.checked)}
                    style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                  Flow Arrows
                </label>
              </div>
            </div>

            {/* Speed adjustments */}
            {!isLiveStream && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {[0.5, 1, 1.5, 2].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => changeSpeed(spd)}
                    style={{
                      background: playbackSpeed === spd ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                      border: playbackSpeed === spd ? '1px solid var(--accent)' : '1px solid transparent',
                      color: playbackSpeed === spd ? 'var(--accent)' : 'var(--text-muted)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontSize: '10px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Metadata panel */}
      {video && (
        <div className="video-metadata-panel" style={{
          padding: '8px 16px',
          background: 'rgba(255, 255, 255, 0.02)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          fontSize: '11px',
          color: 'var(--text-muted)'
        }}>
          <Info size={12} style={{ color: 'var(--accent)' }} />
          <span>FPS: <strong>{video.fps ? Math.round(video.fps) : 'N/A'}</strong></span>
          <span>Resolution: <strong>{video.width && video.height ? `${video.width}x${video.height}` : 'N/A'}</strong></span>
          <span>Codec: <strong>{video.codec ? video.codec.toUpperCase() : 'N/A'}</strong></span>
          <span>Size: <strong>{video.file_size ? `${(video.file_size / (1024 * 1024)).toFixed(1)} MB` : 'N/A'}</strong></span>
        </div>
      )}
    </div>
  );
}
