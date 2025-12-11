import React, { useState, useEffect, useRef } from 'react';

interface LogEntry {
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: Date;
}

// On-screen debug console for mobile debugging
const DebugConsole: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Store original console methods
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    const addLog = (type: LogEntry['type'], ...args: any[]) => {
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2).substring(0, 500);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');

      setLogs(prev => [...prev.slice(-50), { type, message, timestamp: new Date() }]);
    };

    // Override console methods
    console.log = (...args) => {
      originalLog.apply(console, args);
      addLog('log', ...args);
    };

    console.error = (...args) => {
      originalError.apply(console, args);
      addLog('error', ...args);
    };

    console.warn = (...args) => {
      originalWarn.apply(console, args);
      addLog('warn', ...args);
    };

    console.info = (...args) => {
      originalInfo.apply(console, args);
      addLog('info', ...args);
    };

    // Catch global errors
    const handleError = (event: ErrorEvent) => {
      addLog('error', `💥 ${event.message} at ${event.filename}:${event.lineno}`);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      addLog('error', `💥 Unhandled: ${event.reason}`);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    // Initial log
    addLog('info', '🔧 Debug Console Active');

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.info = originalInfo;
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (logContainerRef.current && !isMinimized) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isMinimized]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-2 z-[99999] bg-red-600 text-white text-xs px-2 py-1 rounded-full shadow-lg"
      >
        🔧 Debug
      </button>
    );
  }

  const getColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'info': return 'text-blue-400';
      default: return 'text-green-400';
    }
  };

  return (
    <div 
      className="fixed bottom-20 left-2 right-2 z-[99999] bg-black/95 rounded-lg shadow-2xl border border-white/20 overflow-hidden"
      style={{ maxHeight: isMinimized ? '40px' : '40vh' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-white/10">
        <span className="text-white text-xs font-bold">🔧 Debug Console ({logs.length})</span>
        <div className="flex gap-2">
          <button
            onClick={() => setLogs([])}
            className="text-white/60 text-xs hover:text-white"
          >
            Clear
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-white/60 text-xs hover:text-white"
          >
            {isMinimized ? '▲' : '▼'}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-white/60 text-xs hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Logs */}
      {!isMinimized && (
        <div 
          ref={logContainerRef}
          className="overflow-y-auto p-2 text-xs font-mono"
          style={{ maxHeight: 'calc(40vh - 40px)' }}
        >
          {logs.map((log, i) => (
            <div key={i} className={`${getColor(log.type)} mb-1 break-words`}>
              <span className="text-white/40">
                {log.timestamp.toLocaleTimeString()}
              </span>{' '}
              {log.message}
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-white/40">No logs yet...</div>
          )}
        </div>
      )}
    </div>
  );
};

export default DebugConsole;

