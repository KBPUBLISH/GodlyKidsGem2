import React, { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useSubscription } from '../../context/SubscriptionContext';
import { getApiBaseUrl } from '../../services/apiService';
import { authService } from '../../services/authService';
import despia from 'despia-native';

interface NotificationToggleProps {
  /** Show pulse animation to draw attention (e.g., on day 5 of trial) */
  showPulse?: boolean;
  /** Custom label text */
  label?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Callback when toggle changes */
  onChange?: (enabled: boolean) => void;
}

const isDespiaNative = (): boolean => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('despia');
};

const NotificationToggle: React.FC<NotificationToggleProps> = ({
  showPulse = false,
  label = 'Daily Reminders',
  size = 'md',
  onChange,
}) => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'default' | 'unknown'>('unknown');
  const { reverseTrial } = useSubscription();
  
  // Check if we should show pulse (day 5 of reverse trial)
  const shouldPulse = showPulse || (
    reverseTrial?.active && 
    reverseTrial?.daysRemaining && 
    reverseTrial.daysRemaining <= 3 &&
    !enabled
  );

  // Fetch current notification settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const user = authService.getUser();
        const userId = user?.id || localStorage.getItem('godlykids_device_id');
        
        if (!userId) {
          setLoading(false);
          return;
        }
        
        const apiUrl = getApiBaseUrl();
        const response = await fetch(`${apiUrl}/api/app-user/notification-settings/${userId}`);
        
        if (response.ok) {
          const data = await response.json();
          setEnabled(data.settings?.enabled ?? false);
        }
      } catch (e) {
        console.error('Error fetching notification settings:', e);
      } finally {
        setLoading(false);
      }
    };
    
    // Check notification permission
    const checkPermission = async () => {
      if (isDespiaNative()) {
        // In Despia, assume notifications are available at OS level
        setPermissionStatus('granted');
      } else if ('Notification' in window) {
        setPermissionStatus(Notification.permission as any);
      } else {
        setPermissionStatus('denied');
      }
    };
    
    fetchSettings();
    checkPermission();
  }, []);

  // Auto-detect timezone and save it
  useEffect(() => {
    const saveTimezone = async () => {
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const user = authService.getUser();
        const userId = user?.id || localStorage.getItem('godlykids_device_id');
        
        if (!userId || !timezone) return;
        
        const apiUrl = getApiBaseUrl();
        await fetch(`${apiUrl}/api/app-user/timezone/${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timezone }),
        });
      } catch (e) {
        // Silent fail - not critical
      }
    };
    
    saveTimezone();
  }, []);

  const handleToggle = async () => {
    // If notifications are denied, open settings
    if (!enabled && permissionStatus === 'denied') {
      if (isDespiaNative()) {
        despia('settingsapp://');
      } else {
        alert('Please enable notifications in your browser settings');
      }
      return;
    }
    
    // If permission not granted, request it first
    if (!enabled && permissionStatus === 'default' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission as any);
      if (permission !== 'granted') {
        return;
      }
    }
    
    const newValue = !enabled;
    setEnabled(newValue);
    
    // Save to backend
    try {
      const user = authService.getUser();
      const userId = user?.id || localStorage.getItem('godlykids_device_id');
      
      if (userId) {
        const apiUrl = getApiBaseUrl();
        await fetch(`${apiUrl}/api/app-user/notifications/${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: newValue }),
        });
      }
    } catch (e) {
      console.error('Error saving notification setting:', e);
    }
    
    onChange?.(newValue);
  };

  const sizeClasses = {
    sm: 'h-5 w-9',
    md: 'h-6 w-11',
    lg: 'h-7 w-14',
  };
  
  const dotSizes = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };
  
  const translateOn = {
    sm: 'translate-x-4',
    md: 'translate-x-5',
    lg: 'translate-x-7',
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 opacity-50">
        <div className={`${sizeClasses[size]} bg-gray-200 rounded-full animate-pulse`} />
        <span className="text-gray-400">{label}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {/* Toggle Switch */}
      <button
        onClick={handleToggle}
        className={`
          relative inline-flex items-center rounded-full transition-colors duration-300
          ${sizeClasses[size]}
          ${enabled ? 'bg-indigo-600' : 'bg-gray-300'}
          ${shouldPulse ? 'animate-pulse ring-2 ring-yellow-400 ring-offset-2' : ''}
        `}
        aria-label={`${enabled ? 'Disable' : 'Enable'} ${label}`}
      >
        <span
          className={`
            inline-block rounded-full bg-white shadow-sm transform transition-transform duration-300
            ${dotSizes[size]}
            ${enabled ? translateOn[size] : 'translate-x-1'}
          `}
        />
        
        {/* Pulse ring animation for attention */}
        {shouldPulse && (
          <span className="absolute inset-0 rounded-full animate-ping bg-yellow-400/50" />
        )}
      </button>
      
      {/* Label */}
      <div className="flex items-center gap-2">
        {enabled ? (
          <Bell className="w-4 h-4 text-indigo-600" />
        ) : (
          <BellOff className="w-4 h-4 text-gray-400" />
        )}
        <span className={enabled ? 'text-gray-800' : 'text-gray-500'}>
          {label}
        </span>
      </div>
      
      {/* Hint text when should pulse */}
      {shouldPulse && (
        <span className="text-xs text-yellow-600 font-medium animate-pulse">
          Turn on for reminders!
        </span>
      )}
    </div>
  );
};

export default NotificationToggle;
