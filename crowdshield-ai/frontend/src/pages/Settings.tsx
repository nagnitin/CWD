import { useState, useEffect } from 'react';
import { Cpu, Shield, Radio, Camera, Save, Sparkles, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { API_V1 } from '../config/api';

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('GEMINI_API_KEY') || '';
    const savedModel = localStorage.getItem('GEMINI_MODEL') || 'gemini-2.5-flash';
    setApiKey(savedKey);
    setModel(savedModel);
  }, []);

  const handleTestConnection = async () => {
    if (!apiKey) {
      setTestStatus('error');
      setTestMessage('API Key is required to test connection.');
      return;
    }
    setTestStatus('testing');
    setTestMessage('');
    try {
      const response = await fetch(`${API_V1}/gemini/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, model }),
      });
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setTestStatus('success');
        setTestMessage(`Connection successful! ${data.message}`);
      } else {
        setTestStatus('error');
        setTestMessage(data.detail || 'Connection failed.');
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err.message || 'Network error occurred.');
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem('GEMINI_API_KEY', apiKey);
    localStorage.setItem('GEMINI_MODEL', model);
    setSaveStatus('Settings saved successfully!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  return (
    <div className="stagger-children">
      <div className="dashboard-grid">
        {/* Gemini AI Settings Card */}
        <div className="glass-card panel-wide" style={{ border: '1px solid rgba(139, 92, 246, 0.25)', boxShadow: '0 0 15px rgba(139, 92, 246, 0.05)', gridColumn: 'span 2' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title" style={{ color: 'var(--text-bright)' }}>
              <Sparkles size={16} className="text-purple" style={{ color: '#8b5cf6' }} />
              Gemini AI Copilot Configuration
            </span>
            <span style={{ fontSize: '9px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, textTransform: 'uppercase' }}>
              Premium AI Features
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div className="form-group">
                <label className="form-label">Gemini API Key</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="AIzaSy..." 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  style={{ border: '1px solid rgba(255, 255, 255, 0.08)' }}
                />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Your key is saved locally in your browser storage.
                </span>
              </div>
              <div className="form-group">
                <label className="form-label">Preferred Model</label>
                <select 
                  className="form-select" 
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  style={{ border: '1px solid rgba(255, 255, 255, 0.08)' }}
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (High Intelligence)</option>
                </select>
              </div>
            </div>

            {/* Test Connection Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginTop: 'var(--space-xs)' }}>
              <button 
                type="button"
                className="btn btn-outline" 
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
                style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {testStatus === 'testing' ? <RefreshCw size={12} className="animate-spin" /> : null}
                Test connection
              </button>

              {testStatus === 'success' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: 'var(--safe)' }}>
                  <CheckCircle size={14} />
                  <span>{testMessage}</span>
                </div>
              )}

              {testStatus === 'error' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: 'var(--critical)' }}>
                  <AlertTriangle size={14} />
                  <span>{testMessage}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Model Settings */}
        <div className="glass-card panel-wide">
          <div className="card-header">
            <span className="card-title">
              <Cpu size={16} />
              AI Model Configuration
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label">Detection Model</label>
              <select className="form-select" defaultValue="yolo11n">
                <option value="yolo11n">YOLO11-Nano (Fast)</option>
                <option value="yolo11s">YOLO11-Small</option>
                <option value="yolo11m">YOLO11-Medium</option>
                <option value="yolo11l">YOLO11-Large (Accurate)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Confidence Threshold</label>
              <input type="number" className="form-input" defaultValue={0.35} step={0.05} min={0.1} max={0.95} />
            </div>
            <div className="form-group">
              <label className="form-label">IoU Threshold</label>
              <input type="number" className="form-input" defaultValue={0.45} step={0.05} min={0.1} max={0.95} />
            </div>
            <div className="form-group">
              <label className="form-label">Processing FPS</label>
              <input type="number" className="form-input" defaultValue={10} min={1} max={30} />
            </div>
            <div className="form-group">
              <label className="form-label">Device</label>
              <select className="form-select" defaultValue="auto">
                <option value="auto">Auto (Best Available)</option>
                <option value="cpu">CPU</option>
                <option value="cuda">CUDA GPU</option>
                <option value="mps">Apple MPS</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tracker</label>
              <select className="form-select" defaultValue="bytetrack">
                <option value="bytetrack">ByteTrack</option>
                <option value="ocsort">OC-SORT</option>
                <option value="deepsort">DeepSORT</option>
              </select>
            </div>
          </div>
        </div>

        {/* Alert Settings */}
        <div className="glass-card panel-wide">
          <div className="card-header">
            <span className="card-title">
              <Shield size={16} />
              Alert & Safety Thresholds
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label">CRI Safe Max</label>
              <input type="number" className="form-input" defaultValue={25} min={0} max={100} />
            </div>
            <div className="form-group">
              <label className="form-label">CRI Moderate Max</label>
              <input type="number" className="form-input" defaultValue={50} min={0} max={100} />
            </div>
            <div className="form-group">
              <label className="form-label">CRI High Max</label>
              <input type="number" className="form-input" defaultValue={75} min={0} max={100} />
            </div>
            <div className="form-group">
              <label className="form-label">Min Confirmation Frames</label>
              <input type="number" className="form-input" defaultValue={5} min={1} max={30} />
            </div>
            <div className="form-group">
              <label className="form-label">Alert Persistence (seconds)</label>
              <input type="number" className="form-input" defaultValue={3.0} step={0.5} min={0.5} max={30} />
            </div>
          </div>
        </div>

        {/* MEC Settings */}
        <div className="glass-card panel-wide">
          <div className="card-header">
            <span className="card-title">
              <Radio size={16} />
              MEC & 5G Configuration
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" style={{ accentColor: 'var(--accent-primary)' }} />
                <span className="form-label" style={{ margin: 0 }}>Enable MEC Deployment</span>
              </label>
            </div>
            <div className="form-group">
              <label className="form-label">MEC Endpoint</label>
              <input type="text" className="form-input" placeholder="http://mec-server:8080" />
            </div>
            <div className="form-group">
              <label className="form-label">Adaptive FPS Mode</label>
              <select className="form-select" defaultValue="enabled">
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled (Fixed FPS)</option>
              </select>
            </div>
            {[
              { label: 'Safe FPS', value: 5 },
              { label: 'Moderate FPS', value: 10 },
              { label: 'High FPS', value: 20 },
              { label: 'Critical FPS', value: 30 },
            ].map((item) => (
              <div key={item.label} className="form-group">
                <label className="form-label">{item.label}</label>
                <input type="number" className="form-input" defaultValue={item.value} min={1} max={60} />
              </div>
            ))}
          </div>
        </div>

        {/* Camera Defaults */}
        <div className="glass-card panel-wide">
          <div className="card-header">
            <span className="card-title">
              <Camera size={16} />
              Default Camera Settings
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label">Default Port</label>
              <input type="number" className="form-input" defaultValue={554} />
            </div>
            <div className="form-group">
              <label className="form-label">Default RTSP Path</label>
              <input type="text" className="form-input" defaultValue="stream1" />
            </div>
            <div className="form-group">
              <label className="form-label">Reconnect Interval (ms)</label>
              <input type="number" className="form-input" defaultValue={5000} />
            </div>
            <div className="form-group">
              <label className="form-label">Max Upload Size (MB)</label>
              <input type="number" className="form-input" defaultValue={500} />
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', marginTop: 'var(--space-lg)' }}>
        {saveStatus && (
          <span style={{ color: 'var(--safe)', fontSize: '13px', fontWeight: 600 }}>{saveStatus}</span>
        )}
        <button className="btn btn-primary" onClick={handleSaveSettings}>
          <Save size={16} />
          Save Settings
        </button>
      </div>
    </div>
  );
}
