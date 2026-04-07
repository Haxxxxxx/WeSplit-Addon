/**
 * Error Boundary Component
 * 
 * Catches React errors and displays a user-friendly error UI
 * instead of a white screen of death.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Warning, ArrowClockwise } from '@phosphor-icons/react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col h-[600px] bg-bg items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-error/20 flex items-center justify-center mb-4">
            <Warning size={32} className="text-error" weight="bold" />
          </div>
          <h2 className="text-xl font-bold mb-2 font-archivo">Something went wrong</h2>
          <p className="text-white50 mb-6 max-w-md font-satoshi">
            We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.
          </p>
          {this.state.error && import.meta.env.DEV && (
            <details className="mb-6 text-left max-w-md">
              <summary className="text-white70 text-sm cursor-pointer font-satoshi mb-2">
                Error details (dev only)
              </summary>
              <pre className="text-xs text-white50 bg-white5 p-3 rounded-lg overflow-auto font-mono">
                {this.state.error.toString()}
                {this.state.error.stack && `\n\n${this.state.error.stack}`}
              </pre>
            </details>
          )}
          <button
            onClick={this.handleReset}
            className="btn-primary flex items-center gap-2"
          >
            <ArrowClockwise size={18} />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
