/* LoadingSpinner — branded loading animation */

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export default function LoadingSpinner({ size = 'md', text }: LoadingSpinnerProps) {
  return (
    <div className="loading-spinner">
      <div className={`spinner ${size === 'sm' ? 'spinner-sm' : ''}`} />
      {text && <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{text}</span>}
    </div>
  );
}
