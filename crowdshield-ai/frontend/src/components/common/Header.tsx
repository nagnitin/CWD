/* Header — system status, clock, and connection indicator */

import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Radio } from 'lucide-react';

interface HeaderProps {
  title: string;
  isConnected: boolean;
  sidebarCollapsed: boolean;
}

export default function Header({ title, isConnected, sidebarCollapsed }: HeaderProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (d: Date) => {
    return d.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (d: Date) => {
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <header className={`header ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="header-left">
        <h1>{title}</h1>
      </div>

      <div className="header-right">
        <div className="header-mode">
          <Radio size={12} />
          Video Upload Mode
        </div>

        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          <span className="status-dot" />
          {isConnected ? (
            <>
              <Wifi size={13} />
              <span>Live</span>
            </>
          ) : (
            <>
              <WifiOff size={13} />
              <span>Offline</span>
            </>
          )}
        </div>

        <span className="header-clock">
          {formatDate(time)} · {formatTime(time)}
        </span>
      </div>
    </header>
  );
}
