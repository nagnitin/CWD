/* StatusBadge — color-coded risk/status pills */

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const getClass = () => {
    switch (status.toLowerCase()) {
      case 'safe':
      case 'connected':
      case 'processed':
      case 'resolved':
        return 'safe';
      case 'moderate':
      case 'processing':
      case 'monitoring':
        return 'moderate';
      case 'high':
      case 'alerting':
      case 'warning':
        return 'high';
      case 'critical':
      case 'failed':
      case 'disconnected':
        return 'critical';
      case 'info':
      case 'uploaded':
        return 'info';
      default:
        return 'info';
    }
  };

  return (
    <span className={`status-badge ${getClass()} ${className}`}>
      <span className="status-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
      {status}
    </span>
  );
}
