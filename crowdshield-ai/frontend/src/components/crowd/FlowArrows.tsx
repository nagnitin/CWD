/* FlowArrows Component — renders SVG motion vectors on top of the player */

import type { FlowArrow } from '../../types/crowd';

interface FlowArrowsProps {
  arrows: FlowArrow[];
  containerWidth: number;
  containerHeight: number;
  originalWidth?: number;
  originalHeight?: number;
  opacity?: number;
}

export default function FlowArrows({
  arrows = [],
  containerWidth,
  containerHeight,
  originalWidth = 1920,
  originalHeight = 1080,
  opacity = 0.75,
}: FlowArrowsProps) {
  if (arrows.length === 0 || containerWidth === 0 || containerHeight === 0) {
    return null;
  }

  const scaleX = containerWidth / originalWidth;
  const scaleY = containerHeight / originalHeight;

  return (
    <svg
      className="flow-arrows-overlay"
      width={containerWidth}
      height={containerHeight}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 6, // placed on top of heatmap (zIndex 5) but below boxes (zIndex 10)
        opacity: opacity,
        transition: 'opacity 0.2s ease-in-out',
      }}
    >
      <defs>
        {/* Define arrowhead marker */}
        <marker
          id="flow-arrowhead"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--accent)" />
        </marker>
      </defs>

      {arrows.map((arrow, idx) => {
        const sx = arrow.x * scaleX;
        const sy = arrow.y * scaleY;
        
        // Scale the delta vector displacements
        // We amplify the vector drawing length slightly for better visibility
        const amp = 2.0;
        const ex = sx + arrow.dx * scaleX * amp;
        const ey = sy + arrow.dy * scaleY * amp;

        // Color based on velocity magnitude
        const arrowColor = arrow.magnitude > 3.0 
          ? 'var(--accent)' 
          : 'var(--primary)';

        return (
          <g key={idx}>
            {/* Vector line */}
            <line
              x1={sx}
              y1={sy}
              x2={ex}
              y2={ey}
              stroke={arrowColor}
              strokeWidth="1.5"
              markerEnd="url(#flow-arrowhead)"
              style={{
                strokeDasharray: arrow.magnitude < 1.5 ? '2,2' : 'none',
              }}
            />
            {/* Anchor dot */}
            <circle
              cx={sx}
              cy={sy}
              r="2"
              fill={arrowColor}
            />
          </g>
        );
      })}
    </svg>
  );
}
