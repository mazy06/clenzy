import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert } from './ui';
import { Button } from './ui';
import { Refresh as RefreshIcon } from '../icons';
import * as Sentry from '@sentry/react';
import { useTranslation } from '../hooks/useTranslation';

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
        <ErrorFallback
          message={this.state.error?.message}
          stack={this.state.error?.stack}
          showStack={import.meta.env.DEV && !!this.state.errorInfo}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Le repli visuel, sorti de la classe : `useTranslation` est un hook, une classe
 * ne peut pas l'appeler. Le composant fonctionnel, si.
 */
function ErrorFallback({ message, stack, showStack, onReset }: {
  message?: string;
  stack?: string;
  showStack: boolean;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
      <Alert variant="destructive" className="mb-3 max-w-[600px]">
        <h6 className="m-0 mb-[0.35em] text-sm font-semibold">
          {t('common.errorOccurred')}
        </h6>
        <p className="m-0 mb-3 text-xs">
          {message || t('common.unexpectedError')}
        </p>
        {showStack && (
          <div className="mt-3 p-3 bg-muted rounded-md font-mono overflow-auto max-h-[200px]">
            <pre className="m-0 text-xs text-muted-foreground whitespace-pre-wrap break-words">
              {stack}
            </pre>
          </div>
        )}
        <Button onClick={onReset} className="mt-3">
          <RefreshIcon size={18} strokeWidth={1.75} />
          {t('common.retry')}
        </Button>
      </Alert>
    </div>
  );
}

export default ErrorBoundary;
