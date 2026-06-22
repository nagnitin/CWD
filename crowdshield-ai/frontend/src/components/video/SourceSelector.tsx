/* SourceSelector Component — toggles between video input modes */

import { Upload, MonitorPlay, Camera, Wifi, Video } from 'lucide-react';
import type { SourceType } from '../../types/video';

interface SourceSelectorProps {
  currentSource: SourceType;
  onSourceChange: (source: SourceType) => void;
}

export default function SourceSelector({
  currentSource,
  onSourceChange,
}: SourceSelectorProps) {
  const sources = [
    { id: 'upload' as SourceType, label: 'Upload Video', icon: <Upload size={14} /> },
    { id: 'sparsh_5g' as SourceType, label: 'Sparsh 5G', icon: <Camera size={14} /> },
    { id: 'rtsp' as SourceType, label: 'RTSP', icon: <Video size={14} /> },
    { id: 'ip_camera' as SourceType, label: 'IP Camera', icon: <Wifi size={14} /> },
    { id: 'webcam' as SourceType, label: 'Webcam', icon: <MonitorPlay size={14} /> },
  ];

  return (
    <div className="source-selector">
      {sources.map((s) => (
        <button
          key={s.id}
          id={`btn-source-${s.id}`}
          className={`source-option ${currentSource === s.id ? 'active' : ''}`}
          onClick={() => onSourceChange(s.id)}
        >
          {s.icon}
          {s.label}
        </button>
      ))}
    </div>
  );
}
