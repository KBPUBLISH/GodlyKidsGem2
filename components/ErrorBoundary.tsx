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
    console.error('🚨 ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleRetry = () => {
    // Reset error state to re-render children
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-gradient-to-b from-[#1a3a52] to-[#0d1f2d] flex flex-col items-center justify-center p-6 z-[9999]">
          <div className="text-6xl mb-4">🌊</div>
          <h1 className="text-white text-2xl font-display font-bold mb-2">
            Oops! Something went wrong
          </h1>
          <p className="text-white/70 text-center mb-6 max-w-xs">
            The app hit a wave! Let's get you back on course.
          </p>
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

