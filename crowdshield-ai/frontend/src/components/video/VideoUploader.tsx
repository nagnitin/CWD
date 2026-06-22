/* VideoUploader Component — drag-and-drop video upload with progress bars */

import { useState, useRef } from 'react';
import type { DragEvent } from 'react';
import { Upload, File, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { API_V1 } from '../../config/api';
import type { Video } from '../../types/video';

interface VideoUploaderProps {
  onUploadSuccess: (video: Video) => void;
}

export default function VideoUploader({ onUploadSuccess }: VideoUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<Video | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const uploadFile = (file: File) => {
    // Validate file type
    const allowedExtensions = ['.mp4', '.avi', '.mov', '.mkv'];
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedExtensions.includes(extension)) {
      setError(`Unsupported file format. Please upload: ${allowedExtensions.join(', ')}`);
      return;
    }

    // Validate size (500MB max)
    if (file.size > 500 * 1024 * 1024) {
      setError('File is too large. Maximum size is 500MB.');
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(0);
    setUploadedVideo(null);

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_V1}/videos/upload`, true);

    // Track upload progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      setUploading(false);
      if (xhr.status === 201) {
        try {
          const response = JSON.parse(xhr.responseText) as Video;
          setUploadedVideo(response);
          onUploadSuccess(response);
        } catch (err) {
          setError('Failed to parse upload response.');
        }
      } else {
        setError(`Upload failed with status code: ${xhr.status}`);
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setError('A network error occurred during upload.');
    };

    xhr.send(formData);
  };

  return (
    <div 
      className={`upload-zone-wrapper ${dragActive ? 'drag-active' : ''} ${uploading ? 'uploading' : ''}`}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={!uploading ? triggerFileInput : undefined}
      style={{
        width: '100%',
        minHeight: '260px',
        border: '2px dashed var(--border-color)',
        borderRadius: 'var(--border-radius)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-xl)',
        background: 'rgba(255, 255, 255, 0.01)',
        backdropFilter: 'blur(10px)',
        cursor: uploading ? 'not-allowed' : 'pointer',
        transition: 'all var(--transition-normal)',
      }}
    >
      <input 
        ref={fileInputRef}
        type="file" 
        style={{ display: 'none' }}
        onChange={handleChange}
        accept=".mp4,.avi,.mov,.mkv"
        disabled={uploading}
      />

      {!uploading && !uploadedVideo && !error && (
        <>
          <div className="upload-icon-circle" style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'rgba(6, 182, 212, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'var(--space-md)',
            color: 'var(--accent)',
            boxShadow: '0 0 15px rgba(6, 182, 212, 0.15)',
          }}>
            <Upload size={28} />
          </div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-bright)', marginBottom: 6 }}>
            Drag & drop crowd video file here
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            or click anywhere to browse from local drive
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.35)', marginTop: 20 }}>
            Supports MP4, AVI, MOV, MKV (Max 500MB)
          </div>
        </>
      )}

      {uploading && (
        <div style={{ width: '100%', maxWidth: '380px', textAlign: 'center' }}>
          <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--accent)', marginBottom: 'var(--space-md)' }} />
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-bright)', marginBottom: 8 }}>
            Uploading video stream... {progress}%
          </div>
          <div className="progress-bar-bg" style={{
            width: '100%',
            height: 6,
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 3,
            overflow: 'hidden'
          }}>
            <div className="progress-bar-fill" style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, var(--accent) 0%, var(--primary) 100%)',
              boxShadow: '0 0 10px rgba(6, 182, 212, 0.5)',
              transition: 'width 0.1s ease-out'
            }} />
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 8 }}>
            Extracting metadata (FPS, duration, resolution, codecs)
          </div>
        </div>
      )}

      {uploadedVideo && (
        <div style={{ textAlign: 'center' }}>
          <div className="status-success-circle" style={{
            width: 50,
            height: 50,
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'var(--space-md)',
            color: 'var(--safe)',
            margin: '0 auto var(--space-md) auto'
          }}>
            <CheckCircle size={28} />
          </div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-bright)', marginBottom: 4 }}>
            Upload Completed Successfully!
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <File size={14} />
            {uploadedVideo.original_filename}
          </div>
          <button 
            className="btn btn-outline" 
            style={{ marginTop: 'var(--space-md)', fontSize: '12px', padding: '6px 12px' }}
            onClick={(e) => { e.stopPropagation(); setUploadedVideo(null); setTimeout(() => fileInputRef.current?.click(), 50); }}
          >
            Change Video File
          </button>
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', maxWidth: '350px' }}>
          <div className="status-error-circle" style={{
            width: 50,
            height: 50,
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--critical)',
            margin: '0 auto var(--space-md) auto'
          }}>
            <AlertCircle size={28} />
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-bright)', marginBottom: 8 }}>
            Upload Failed
          </div>
          <div style={{ fontSize: '13px', color: 'var(--critical)', marginBottom: 16 }}>
            {error}
          </div>
          <button 
            className="btn btn-outline" 
            style={{ fontSize: '12px', padding: '6px 12px' }}
            onClick={(e) => { e.stopPropagation(); setError(null); setTimeout(() => fileInputRef.current?.click(), 50); }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
