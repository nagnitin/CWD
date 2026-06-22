/* CameraConfig Component — forms for adding camera feeds and testing connection latency */

import { useState } from 'react';
import { Camera, Settings, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { API_V1 } from '../../config/api';

interface CameraConfigProps {
  onCameraAdded?: () => void;
}

export default function CameraConfig({ onCameraAdded }: CameraConfigProps) {
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('554');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rtspPath, setRtspPath] = useState('stream1');
  const [cameraType, setCameraType] = useState('rtsp');
  
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: 'success' | 'failed' | null;
    message: string;
    latency?: number;
  }>({ status: null, message: '' });

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ip) {
      setTestResult({ status: 'failed', message: 'IP address or hostname is required' });
      return;
    }

    setLoading(true);
    setTestResult({ status: null, message: '' });

    try {
      // Create a temporary camera entry and test it
      const createRes = await fetch(`${API_V1}/cameras/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || 'Test Camera',
          camera_type: cameraType,
          ip_address: ip,
          port: parseInt(port) || 554,
          username,
          password,
          rtsp_path: rtspPath,
        }),
      });

      if (!createRes.ok) {
        throw new Error('Failed to register test camera');
      }

      const camera = await createRes.json();

      // Run connection test
      const testRes = await fetch(`${API_V1}/cameras/${camera.id}/test`, {
        method: 'POST',
      });

      const testData = await testRes.json();

      if (testData.status === 'success') {
        setTestResult({
          status: 'success',
          message: `Connected successfully! Info: ${testData.stream_info.resolution} @ ${testData.stream_info.fps}fps`,
          latency: testData.latency_ms,
        });
        onCameraAdded?.();
      } else {
        setTestResult({
          status: 'failed',
          message: testData.error_message || 'Connection test failed',
        });
      }

      // Cleanup test camera
      await fetch(`${API_V1}/cameras/${camera.id}`, { method: 'DELETE' });

    } catch (err: any) {
      setTestResult({ status: 'failed', message: err.message || 'Error testing camera connection' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card panel-wide animate-fade-in">
      <div className="card-header">
        <span className="card-title">
          <Camera size={16} />
          Camera Connection Config
        </span>
      </div>
      <form onSubmit={handleTestConnection} className="camera-form" style={{ padding: 'var(--space-md)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
          <div className="form-group">
            <label htmlFor="cam-name">Camera Name</label>
            <input
              type="text"
              id="cam-name"
              placeholder="e.g., Entrance Gate 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="cam-type">Source Protocol</label>
            <select
              id="cam-type"
              value={cameraType}
              onChange={(e) => setCameraType(e.target.value)}
            >
              <option value="rtsp">RTSP Stream</option>
              <option value="sparsh_5g">Sparsh 5G camera</option>
              <option value="ip_camera">Generic IP Stream</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="cam-ip">IP Address / Host</label>
            <input
              type="text"
              id="cam-ip"
              placeholder="192.168.1.100"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="cam-port">Port</label>
            <input
              type="text"
              id="cam-port"
              placeholder="554"
              value={port}
              onChange={(e) => setPort(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="cam-user">Username</label>
            <input
              type="text"
              id="cam-user"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="cam-pass">Password</label>
            <input
              type="password"
              id="cam-pass"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="cam-path">RTSP / Stream Path</label>
            <input
              type="text"
              id="cam-path"
              placeholder="h264/ch1/main"
              value={rtspPath}
              onChange={(e) => setRtspPath(e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-md)' }}>
          <button
            type="submit"
            id="btn-test-connection"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Settings size={14} />
                Connect & Test Stream
              </>
            )}
          </button>

          {testResult.status && (
            <div className={`status-message-banner ${testResult.status}`} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 6,
              background: testResult.status === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${testResult.status === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              color: testResult.status === 'success' ? 'var(--safe)' : 'var(--critical)',
              fontSize: '13px',
              flex: 1
            }}>
              {testResult.status === 'success' ? (
                <>
                  <CheckCircle size={16} />
                  <span>{testResult.message} {testResult.latency !== undefined && `(latency: ${testResult.latency}ms)`}</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={16} />
                  <span>{testResult.message}</span>
                </>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
