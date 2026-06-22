/* HeatmapOverlay Component — renders the transparent crowd density map overlay */

interface HeatmapOverlayProps {
  heatmapUrl?: string;
  opacity?: number; // 0.0 to 1.0
}

export default function HeatmapOverlay({
  heatmapUrl,
  opacity = 0.5,
}: HeatmapOverlayProps) {
  if (!heatmapUrl) return null;

  return (
    <img
      src={heatmapUrl}
      alt="Crowd Density Heatmap"
      className="heatmap-overlay-img"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        opacity: opacity,
        pointerEvents: 'none',
        zIndex: 5, // drawn underneath bounding boxes (which have zIndex 10)
        transition: 'opacity 0.2s ease-in-out',
      }}
    />
  );
}
