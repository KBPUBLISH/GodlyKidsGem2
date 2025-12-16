import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 ErrorBoundary caught an error:', error);
    console.error('🚨 Error message:', error.message);
    console.error('🚨 Error stack:', error.stack);
    console.error('🚨 Component stack:', errorInfo.componentStack);
    
    // Also log to localStorage for debugging on mobile
    try {
      const errorLog = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
      };
      const existingLogs = JSON.parse(localStorage.getItem('error_logs') || '[]');
      existingLogs.push(errorLog);
      // Keep only last 5 errors
      localStorage.setItem('error_logs', JSON.stringify(existingLogs.slice(-5)));
    } catch (e) {
      // Ignore storage errors
    }
  }

  private handleRetry = () => {
    // Reset error state to re-render children
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'Unknown error';
      
      return (
        <div className="fixed inset-0 bg-gradient-to-b from-[#1a3a52] to-[#0d1f2d] flex flex-col items-center justify-center p-6 z-[9999]">
          <div className="text-6xl mb-4">🌊</div>
          <h1 className="text-white text-2xl font-display font-bold mb-2">
            Oops! Something went wrong
          </h1>
          <p className="text-white/70 text-center mb-4 max-w-xs">
            The app hit a wave! Let's get you back on course.
          </p>
          {/* Debug info - tap to expand */}
          <details className="mb-4 max-w-xs w-full">
            <summary className="text-white/50 text-xs text-center cursor-pointer">
              Tap for error details
            </summary>
            <div className="mt-2 p-2 bg-black/30 rounded text-white/60 text-xs overflow-auto max-h-32">
              {errorMessage}
            </div>
          </details>
          <button
            onClick={this.handleRetry}
            className="px-8 py-3 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#3E1F07] font-bold rounded-full shadow-lg active:scale-95 transition-transform"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

