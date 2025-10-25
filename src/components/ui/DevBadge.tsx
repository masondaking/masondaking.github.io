// src/components/ui/DevBadge.tsx
import { Shield } from 'lucide-react';

interface DevBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function DevBadge({ size = 'sm', showIcon = true, className = '' }: DevBadgeProps) {
  const iconSizes = { sm: 10, md: 12, lg: 14 } as const;
  const sizeMods = { sm: 'dev-badge--sm', md: 'dev-badge--md', lg: 'dev-badge--lg' } as const;

  return (
    <span
      className={`dev-badge ${sizeMods[size]} ${className}`}
      title="Developer"
      aria-label="Developer"
    >
      {showIcon && <Shield size={iconSizes[size]} aria-hidden />}
      <span className="dev-badge__label">DEV</span>
      <span className="dev-badge__dot" aria-hidden />
    </span>
  );
}

// User display component with dev badge
interface UserDisplayProps {
  username: string;
  isDev: boolean;
  showBadge?: boolean;
  className?: string;
}

export function UserDisplay({ username, isDev, showBadge = true, className = '' }: UserDisplayProps) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className="font-medium">{username}</span>
      {isDev && showBadge && <DevBadge size="sm" />}
    </div>
  );
}
