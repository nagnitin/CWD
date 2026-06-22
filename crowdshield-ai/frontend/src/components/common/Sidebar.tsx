/* Sidebar — premium glassmorphism navigation */

import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  MonitorPlay,
  Globe,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Bell,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { path: '/monitoring', label: 'Live Monitoring', icon: <MonitorPlay size={20} /> },
  { path: '/digital-twin', label: 'Digital Twin', icon: <Globe size={20} /> },
  { path: '/forecasting', label: 'Forecasting', icon: <TrendingUp size={20} /> },
  { path: '/hazards', label: 'Hazard Monitor', icon: <AlertTriangle size={20} /> },
  { path: '/analytics', label: 'Analytics', icon: <BarChart3 size={20} /> },
  { path: '/alerts', label: 'Alerts', icon: <Bell size={20} /> },
  { path: '/settings', label: 'Settings', icon: <Settings size={20} /> },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  alertCount?: number;
}

export default function Sidebar({ collapsed, onToggle, alertCount = 0 }: SidebarProps) {

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <Shield size={20} color="white" />
        </div>
        {!collapsed && (
          <div className="logo-text">
            <h2>CrowdShield</h2>
            <span>AI Platform</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
            end={item.path === '/'}
            title={collapsed ? item.label : undefined}
          >
            <span className="nav-icon">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
            {!collapsed && item.path === '/alerts' && alertCount > 0 && (
              <span className="nav-badge">{alertCount}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <button className="sidebar-toggle" onClick={onToggle} title="Toggle sidebar">
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
