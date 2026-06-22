/* CrowdShield AI — Main Application */

import { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/common/Sidebar';
import Header from './components/common/Header';
import Dashboard from './pages/Dashboard';
import LiveMonitoring from './pages/LiveMonitoring';
import DigitalTwin from './pages/DigitalTwin';
import Forecasting from './pages/Forecasting';
import HazardMonitoring from './pages/HazardMonitoring';
import Analytics from './pages/Analytics';
import Alerts from './pages/Alerts';
import Settings from './pages/Settings';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/monitoring': 'Live Monitoring',
  '/digital-twin': 'Digital Twin',
  '/forecasting': 'Forecasting',
  '/hazards': 'Hazard Monitoring',
  '/analytics': 'Analytics',
  '/alerts': 'Alert Center',
  '/settings': 'Settings',
};

function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'CrowdShield AI';

  return (
    <div className="app-layout">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        alertCount={3}
      />

      <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header
          title={title}
          isConnected={true}
          sidebarCollapsed={sidebarCollapsed}
        />

        <main className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/monitoring" element={<LiveMonitoring />} />
            <Route path="/digital-twin" element={<DigitalTwin />} />
            <Route path="/forecasting" element={<Forecasting />} />
            <Route path="/hazards" element={<HazardMonitoring />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
