/* Types for video management */

export interface Video {
  id: string;
  filename: string;
  original_filename: string;
  filepath: string;
  file_size: number;
  mime_type?: string;
  duration?: number;
  fps?: number;
  width?: number;
  height?: number;
  bitrate?: number;
  codec?: string;
  total_frames?: number;
  status: VideoStatus;
  processing_progress: number;
  error_message?: string;
  uploaded_at: string;
  processed_at?: string;
}

export type VideoStatus = 'uploaded' | 'processing' | 'processed' | 'failed';

export type SourceType = 'upload' | 'sparsh_5g' | 'rtsp' | 'ip_camera' | 'webcam';
