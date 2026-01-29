import React from 'react';
import { Crown } from 'lucide-react';

interface PremiumBadgeProps {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Whether to show text label (default: true) */
  showLabel?: boolean;
}

/**
 * Premium Badge Component
 * Golden crown badge displayed on premium/members-only content
 * Use this on thumbnails to indicate content requires a subscription
 */
const PremiumBadge: React.FC<PremiumBadgeProps> = ({ 
  size = 'sm', 
  className = '',
  showLabel = true 
}) => {
  const sizeStyles = {
    sm: {
      container: 'px-2 py-1 text-[10px]',
      icon: 10,
      gap: 'gap-1',
    },
    md: {
      container: 'px-2.5 py-1.5 text-xs',
      icon: 12,
      gap: 'gap-1',
    },
    lg: {
      container: 'px-3 py-2 text-sm',
      icon: 14,
      gap: 'gap-1.5',
    },
  };

  const styles = sizeStyles[size];

  return (
    <div
      className={`
        bg-gradient-to-r from-[#FFD700] to-[#FFA500] 
        text-[#5c2e0b] font-bold 
        rounded-full 
        flex items-center ${styles.gap}
        shadow-lg
        ${styles.container}
        ${className}
      `}
    >
      <Crown size={styles.icon} />
      {showLabel && <span>PREMIUM</span>}
    </div>
  );
};

export default PremiumBadge;
