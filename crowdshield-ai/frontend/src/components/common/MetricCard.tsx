/* MetricCard — glassmorphism metric display with trend indicator */

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  colorClass?: string;
}

export default function MetricCard({
  label,
  value,
  icon,
  trend,
  trendValue,
  colorClass = 'accent',
}: MetricCardProps) {
  return (
    <div className="glass-card metric-card animate-slide-in">
      <div className="card-header">
        <span className="card-title">
          {icon && <span className="icon">{icon}</span>}
          {label}
        </span>
      </div>
      <div className={`metric-value ${colorClass}`}>{value}</div>
      {trend && (
        <div className={`metric-trend ${trend}`}>
          {trend === 'up' && <TrendingUp size={14} />}
          {trend === 'down' && <TrendingDown size={14} />}
          {trend === 'stable' && <Minus size={14} />}
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  );
}
