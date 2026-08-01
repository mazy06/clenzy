import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert } from './ui';
import { Button } from './ui';
import { Refresh as RefreshIcon } from '../icons';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Report to Sentry with component stack context
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack || undefined,
        },
      },
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
          <Alert variant="destructive" className="mb-3 max-w-[600px]">
            <h6 className="cn-text-h6 mb-[0.35em]">
              Une erreur s'est produite
            </h6>
            <p className="cn-text-body2 mb-3">
              {this.state.error?.message || "Une erreur inattendue s'est produite"}
            </p>
            {import.meta.env.DEV && this.state.errorInfo && (
              <div className="mt-3 p-3 bg-[var(--hover)] rounded-[1px] text-[0.75rem] font-mono overflow-auto max-h-[200px]">
                <pre className="cn-text-caption whitespace-pre-wrap break-words">
                  {this.state.error?.stack}
                </pre>
              </div>
            )}
            <Button onClick={this.handleReset} className="mt-3">
              <RefreshIcon size={18} strokeWidth={1.75} />
              Réessayer
            </Button>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
